-- Hotfix: guest register wrote nonexistent parcels.customer_id
-- Schema column is sender_customer_id (migration 05).

CREATE OR REPLACE FUNCTION public.register_guest_parcel(
  p_company_id UUID,
  p_sender_name TEXT,
  p_sender_phone TEXT,
  p_receiver_name TEXT,
  p_receiver_phone TEXT,
  p_origin_branch_id UUID,
  p_destination_branch_id UUID DEFAULT NULL,
  p_sender_email TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_instructions TEXT DEFAULT NULL,
  p_declared_value_cents INT DEFAULT 0,
  p_category_id UUID DEFAULT NULL,
  p_weight_kg NUMERIC DEFAULT NULL,
  p_currency_code TEXT DEFAULT 'ZMW'
)
RETURNS TABLE (id UUID, tracking_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tracking TEXT;
  v_parcel_id UUID;
  v_customer_id UUID;
  v_prefix TEXT := 'POS';
  v_dest UUID;
  v_status TEXT;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company is required';
  END IF;

  IF public.is_company_locked(p_company_id) THEN
    RAISE EXCEPTION 'Company is not accepting registrations (paused or expired)';
  END IF;

  SELECT c.status::TEXT INTO v_status
  FROM public.companies c
  WHERE c.id = p_company_id
    AND c.soft_delete = FALSE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  IF v_status NOT IN ('active', 'trial', 'past_due') THEN
    RAISE EXCEPTION 'Company is not accepting registrations (status: %)', v_status;
  END IF;

  PERFORM public.ensure_company_settings(p_company_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_settings s
    WHERE s.company_id = p_company_id
      AND s.soft_delete = FALSE
      AND s.allow_guest_registration = TRUE
  ) THEN
    RAISE EXCEPTION 'Guest registration is not allowed for this company';
  END IF;

  IF nullif(trim(p_sender_name), '') IS NULL OR nullif(trim(p_sender_phone), '') IS NULL THEN
    RAISE EXCEPTION 'Sender name and phone are required';
  END IF;
  IF nullif(trim(p_receiver_name), '') IS NULL OR nullif(trim(p_receiver_phone), '') IS NULL THEN
    RAISE EXCEPTION 'Receiver name and phone are required';
  END IF;
  IF p_origin_branch_id IS NULL THEN
    RAISE EXCEPTION 'Origin branch is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = p_origin_branch_id
      AND b.company_id = p_company_id
      AND b.soft_delete = FALSE
      AND b.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Origin branch is invalid for this company';
  END IF;

  v_dest := p_destination_branch_id;
  IF v_dest IS NULL THEN
    v_dest := p_origin_branch_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = v_dest
      AND b.company_id = p_company_id
      AND b.soft_delete = FALSE
      AND b.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Destination branch is invalid for this company';
  END IF;

  SELECT coalesce(nullif(trim(tracking_prefix), ''), 'POS') INTO v_prefix
  FROM public.company_settings
  WHERE company_id = p_company_id
  LIMIT 1;

  v_tracking := upper(v_prefix)
    || '-' || to_char(NOW(), 'YYMMDD')
    || '-' || upper(substr(md5(random()::TEXT), 1, 6));

  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.company_id = p_company_id
    AND c.phone = trim(p_sender_phone)
    AND c.soft_delete = FALSE
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      company_id, full_name, phone, email, is_guest
    ) VALUES (
      p_company_id,
      trim(p_sender_name),
      trim(p_sender_phone),
      nullif(trim(coalesce(p_sender_email, '')), ''),
      TRUE
    )
    RETURNING customers.id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET
      full_name = trim(p_sender_name),
      email = COALESCE(nullif(trim(coalesce(p_sender_email, '')), ''), email),
      updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  INSERT INTO public.parcels (
    company_id, tracking_number, sender_customer_id,
    sender_name, sender_phone, sender_email,
    receiver_name, receiver_phone,
    origin_branch_id, destination_branch_id, current_branch_id,
    status, payment_status, shipping_amount_cents, currency_code,
    description, declared_value_cents, category_id, weight_kg, metadata
  ) VALUES (
    p_company_id, v_tracking, v_customer_id,
    trim(p_sender_name), trim(p_sender_phone), nullif(trim(coalesce(p_sender_email, '')), ''),
    trim(p_receiver_name), trim(p_receiver_phone),
    p_origin_branch_id, v_dest, p_origin_branch_id,
    'waiting_for_dropoff', 'unpaid', 0, upper(substr(coalesce(nullif(trim(p_currency_code), ''), 'ZMW'), 1, 3)),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_declared_value_cents, 0),
    p_category_id,
    p_weight_kg,
    CASE WHEN nullif(trim(coalesce(p_instructions, '')), '') IS NULL THEN '{}'::JSONB
         ELSE jsonb_build_object('instructions', trim(p_instructions)) END
  )
  RETURNING parcels.id INTO v_parcel_id;

  INSERT INTO public.parcel_tracking (
    company_id, parcel_id, status, title, description, occurred_at, is_public
  ) VALUES (
    p_company_id, v_parcel_id, 'waiting_for_dropoff',
    'Waiting for Drop-off',
    'Parcel registered — bring it to the branch for weighing and payment.',
    NOW(), TRUE
  );

  RETURN QUERY SELECT v_parcel_id, v_tracking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_guest_parcel(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, INT, UUID, NUMERIC, TEXT
) TO anon, authenticated, service_role;
