-- Self-service: authenticated user creates their courier company + becomes company admin.
-- Called from the app after signUp / first sign-in when no staff row exists yet.

CREATE OR REPLACE FUNCTION public.slugify_company_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.register_courier_company(
  p_company_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_name TEXT;
  v_company_name TEXT;
  v_slug TEXT;
  v_base_slug TEXT;
  v_code TEXT;
  v_company_id UUID;
  v_role_id UUID;
  v_plan_id UUID;
  v_trial_end TIMESTAMPTZ := now() + interval '14 days';
  v_n INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_company_name := nullif(trim(p_company_name), '');
  IF v_company_name IS NULL THEN
    RAISE EXCEPTION 'Company name is required';
  END IF;

  -- Already provisioned
  IF EXISTS (
    SELECT 1 FROM public.staff
    WHERE user_id = v_uid AND is_active = TRUE AND soft_delete = FALSE
  ) THEN
    SELECT company_id INTO v_company_id
    FROM public.staff
    WHERE user_id = v_uid AND is_active = TRUE AND soft_delete = FALSE
    LIMIT 1;
    RETURN v_company_id;
  END IF;

  SELECT email, full_name INTO v_email, v_name FROM public.users WHERE id = v_uid;
  v_email := COALESCE(nullif(trim(p_email), ''), v_email);
  v_name := COALESCE(nullif(trim(p_full_name), ''), v_name, split_part(COALESCE(v_email, 'owner'), '@', 1));

  v_base_slug := public.slugify_company_name(v_company_name);
  IF v_base_slug IS NULL OR v_base_slug = '' THEN
    v_base_slug := 'courier';
  END IF;
  v_slug := v_base_slug;

  WHILE EXISTS (SELECT 1 FROM public.companies WHERE slug = v_slug OR subdomain = v_slug || '.parcelos.africa') LOOP
    v_n := v_n + 1;
    v_slug := v_base_slug || '-' || v_n::TEXT;
  END LOOP;

  v_code := upper(substr(regexp_replace(v_company_name, '[^A-Za-z0-9]', '', 'g'), 1, 3));
  IF length(v_code) < 2 THEN
    v_code := 'CO';
  END IF;
  IF EXISTS (SELECT 1 FROM public.companies WHERE code = v_code) THEN
    v_code := upper(substr(v_slug, 1, 3)) || substr(replace(v_uid::TEXT, '-', ''), 1, 2);
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE code = 'company_admin' LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'company_admin role missing — run seed migrations';
  END IF;

  INSERT INTO public.companies (
    name, code, slug, country_code, currency_code, phone, email,
    subdomain, default_language, timezone, status, trial_ends_at,
    primary_color, secondary_color, created_by
  )
  VALUES (
    v_company_name,
    v_code,
    v_slug,
    'ZM',
    'ZMW',
    nullif(trim(p_phone), ''),
    v_email,
    v_slug || '.parcelos.africa',
    'en',
    'Africa/Lusaka',
    'trial',
    v_trial_end,
    '#0F766E',
    '#F59E0B',
    v_uid
  )
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_settings (company_id, tracking_prefix, created_by)
  VALUES (v_company_id, 'POS', v_uid);

  INSERT INTO public.domains (
    company_id, hostname, domain_type, is_primary, ssl_status, verified, created_by
  )
  VALUES (
    v_company_id, v_slug || '.parcelos.africa', 'subdomain', TRUE, 'active', TRUE, v_uid
  );

  INSERT INTO public.branches (
    company_id, code, name, city, country_code, is_head_office, created_by
  )
  VALUES (
    v_company_id, 'HQ', v_company_name || ' — Head Office', 'Lusaka', 'ZM', TRUE, v_uid
  );

  SELECT id INTO v_plan_id FROM public.subscription_plans WHERE code = 'starter' AND is_active = TRUE LIMIT 1;
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.subscription_plans WHERE is_active = TRUE ORDER BY created_at LIMIT 1;
  END IF;

  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      company_id, plan_id, status, trial_ends_at, current_period_end, created_by
    )
    VALUES (
      v_company_id, v_plan_id, 'trialing', v_trial_end, v_trial_end, v_uid
    );
  END IF;

  UPDATE public.users
  SET
    company_id = v_company_id,
    user_type = 'staff',
    full_name = v_name,
    phone = COALESCE(nullif(trim(p_phone), ''), phone)
  WHERE id = v_uid;

  INSERT INTO public.staff (company_id, user_id, role_id, is_active)
  VALUES (v_company_id, v_uid, v_role_id, TRUE)
  ON CONFLICT (company_id, user_id) DO UPDATE
    SET role_id = EXCLUDED.role_id, is_active = TRUE, soft_delete = FALSE;

  INSERT INTO public.audit_logs (company_id, actor_id, action, entity_type, entity_id, description)
  VALUES (
    v_company_id,
    v_uid,
    'create',
    'company',
    v_company_id,
    'Company registered via self-service signup'
  );

  RETURN v_company_id;
END;
$$;

COMMENT ON FUNCTION public.register_courier_company IS
  'Self-service signup: create courier company and make caller company_admin.';

GRANT EXECUTE ON FUNCTION public.register_courier_company(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.slugify_company_name(TEXT) TO authenticated;
