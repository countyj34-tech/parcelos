-- Real customer accounts: provision users.user_type + customers row after Auth sign-up

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT := COALESCE(NEW.raw_user_meta_data->>'user_type', 'staff');
  v_company UUID := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID;
  v_phone TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  v_name TEXT := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
BEGIN
  INSERT INTO public.users (
    id, email, full_name, phone, email_verified, user_type, company_id, is_active
  ) VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_phone,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE),
    CASE WHEN v_type = 'customer' THEN 'customer'::public.user_type ELSE 'staff'::public.user_type END,
    CASE WHEN v_type = 'customer' THEN v_company ELSE NULL END,
    TRUE
  )
  ON CONFLICT (id) DO UPDATE
    SET
      full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
      phone = COALESCE(EXCLUDED.phone, public.users.phone),
      user_type = CASE
        WHEN v_type = 'customer' THEN 'customer'::public.user_type
        ELSE public.users.user_type
      END,
      company_id = CASE
        WHEN v_type = 'customer' AND v_company IS NOT NULL THEN v_company
        ELSE public.users.company_id
      END,
      updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_my_customer_profile(
  p_company_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_customer_id UUID;
  v_name TEXT := NULLIF(trim(COALESCE(p_full_name, '')), '');
  v_phone TEXT := NULLIF(trim(COALESCE(p_phone, '')), '');
  v_email TEXT := NULLIF(trim(COALESCE(p_email, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company is required';
  END IF;
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Phone is required';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  IF public.is_company_locked(p_company_id) THEN
    RAISE EXCEPTION 'Company is not accepting customers right now';
  END IF;

  UPDATE public.users
  SET
    user_type = 'customer',
    company_id = p_company_id,
    full_name = v_name,
    phone = v_phone,
    updated_at = NOW()
  WHERE id = v_uid;

  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.company_id = p_company_id
    AND c.soft_delete = FALSE
    AND (c.user_id = v_uid OR c.phone = v_phone)
  ORDER BY CASE WHEN c.user_id = v_uid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      company_id, user_id, full_name, phone, email, is_guest
    ) VALUES (
      p_company_id, v_uid, v_name, v_phone, v_email, FALSE
    )
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET
      user_id = v_uid,
      full_name = v_name,
      phone = v_phone,
      email = COALESCE(v_email, email),
      is_guest = FALSE,
      soft_delete = FALSE,
      updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  RETURN v_customer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_customer_profile(UUID, TEXT, TEXT, TEXT)
  TO authenticated, service_role;
