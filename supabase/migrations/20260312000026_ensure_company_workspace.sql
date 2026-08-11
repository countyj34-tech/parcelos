-- Stronger workspace repair: claim company by staff / created_by / email,
-- ensure public.users + staff rows exist, and fix get_my_workspace when users join fails.

CREATE OR REPLACE FUNCTION public.ensure_public_user_row()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, raw_user_meta_data->>'full_name'
  INTO v_email, v_name
  FROM auth.users
  WHERE id = v_uid;

  INSERT INTO public.users (id, email, full_name, email_verified, user_type, is_active)
  VALUES (
    v_uid,
    COALESCE(v_email, v_uid::text || '@users.local'),
    COALESCE(nullif(trim(v_name), ''), split_part(COALESCE(v_email, 'owner'), '@', 1)),
    TRUE,
    'staff',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email = COALESCE(EXCLUDED.email, public.users.email),
      is_active = TRUE,
      soft_delete = FALSE,
      updated_at = NOW();

  RETURN v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_public_user_row() TO authenticated;

CREATE OR REPLACE FUNCTION public.repair_my_company_link()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_company UUID;
  v_role_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.ensure_public_user_row();

  SELECT email INTO v_email FROM public.users WHERE id = v_uid;

  -- 1) Already staff
  SELECT s.company_id INTO v_company
  FROM public.staff s
  WHERE s.user_id = v_uid
    AND s.is_active = TRUE
    AND s.soft_delete = FALSE
  ORDER BY s.created_at ASC
  LIMIT 1;

  -- 2) Company this auth user created
  IF v_company IS NULL THEN
    SELECT c.id INTO v_company
    FROM public.companies c
    WHERE c.created_by = v_uid
      AND c.soft_delete = FALSE
    ORDER BY c.created_at ASC
    LIMIT 1;
  END IF;

  -- 3) Company registered with this email (orphan from failed staff insert)
  IF v_company IS NULL AND v_email IS NOT NULL THEN
    SELECT c.id INTO v_company
    FROM public.companies c
    WHERE lower(c.email::text) = lower(v_email)
      AND c.soft_delete = FALSE
    ORDER BY c.created_at ASC
    LIMIT 1;
  END IF;

  IF v_company IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE code = 'company_admin' LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'company_admin role missing — run seed migrations';
  END IF;

  INSERT INTO public.staff (company_id, user_id, role_id, is_active, soft_delete)
  VALUES (v_company, v_uid, v_role_id, TRUE, FALSE)
  ON CONFLICT (company_id, user_id) DO UPDATE
    SET
      role_id = COALESCE(EXCLUDED.role_id, public.staff.role_id),
      is_active = TRUE,
      soft_delete = FALSE,
      updated_at = NOW();

  UPDATE public.users
  SET
    company_id = v_company,
    user_type = 'staff',
    is_active = TRUE,
    soft_delete = FALSE,
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN v_company;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_my_company_link() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_workspace()
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  company_slug TEXT,
  subdomain TEXT,
  tagline TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  support_phone TEXT,
  support_email CITEXT,
  role_code TEXT,
  full_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_company := public.repair_my_company_link();
  IF v_company IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    c.subdomain,
    c.tagline,
    c.logo_url,
    c.primary_color,
    c.secondary_color,
    COALESCE(c.support_phone, c.phone),
    COALESCE(c.support_email, c.email),
    COALESCE(r.code, 'company_admin'),
    COALESCE(u.full_name, '')
  FROM public.companies c
  LEFT JOIN public.users u ON u.id = v_uid
  LEFT JOIN public.staff s
    ON s.user_id = v_uid
   AND s.company_id = c.id
   AND s.is_active = TRUE
   AND s.soft_delete = FALSE
  LEFT JOIN public.roles r ON r.id = s.role_id
  WHERE c.id = v_company
    AND c.soft_delete = FALSE
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_workspace() TO authenticated;

-- One-click: create company if none, otherwise repair/claim
CREATE OR REPLACE FUNCTION public.ensure_my_courier_company(
  p_company_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
  v_name TEXT;
  v_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_company := public.repair_my_company_link();
  IF v_company IS NOT NULL THEN
    RETURN v_company;
  END IF;

  SELECT email, full_name INTO v_email, v_name FROM public.users WHERE id = v_uid;
  v_name := COALESCE(nullif(trim(p_full_name), ''), v_name);
  v_company := public.register_courier_company(
    COALESCE(nullif(trim(p_company_name), ''), 'My Courier Company'),
    nullif(trim(p_phone), ''),
    v_name,
    v_email
  );

  RETURN v_company;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_courier_company(TEXT, TEXT, TEXT) TO authenticated;
