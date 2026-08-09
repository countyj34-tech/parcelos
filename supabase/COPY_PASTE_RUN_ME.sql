-- ParcelOS — paste ALL into Supabase SQL Editor, then Run
-- Includes migrations 12..17 + grant for activate


-- ##### supabase\migrations\20260312000012_register_courier_company.sql #####
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


-- ##### supabase\migrations\20260312000013_scale_indexes.sql #####
-- Scale indexes for multi-company parcel/payment lookups

CREATE INDEX IF NOT EXISTS idx_parcels_company_payment
  ON public.parcels (company_id, payment_status)
  WHERE soft_delete = FALSE;

CREATE INDEX IF NOT EXISTS idx_parcels_company_status_created
  ON public.parcels (company_id, status, created_at DESC)
  WHERE soft_delete = FALSE;

CREATE INDEX IF NOT EXISTS idx_parcels_company_sender_phone
  ON public.parcels (company_id, sender_phone)
  WHERE soft_delete = FALSE;

CREATE INDEX IF NOT EXISTS idx_payments_company_paid_at
  ON public.payments (company_id, paid_at DESC)
  WHERE soft_delete = FALSE;

CREATE INDEX IF NOT EXISTS idx_staff_company_active
  ON public.staff (company_id, is_active)
  WHERE soft_delete = FALSE;

CREATE INDEX IF NOT EXISTS idx_customers_company_created
  ON public.customers (company_id, created_at DESC)
  WHERE soft_delete = FALSE;


-- ##### supabase\migrations\20260312000014_staff_invite_and_provision.sql #####
-- Staff provisioning, invites, and company-admin helpers (no service-role required in the browser)

CREATE TABLE IF NOT EXISTS public.staff_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email           CITEXT NOT NULL,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  role_code       TEXT NOT NULL DEFAULT 'receptionist',
  branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by      UUID REFERENCES public.users(id),
  accepted_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (company_id, email)
);

ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_invites_tenant ON public.staff_invites
  FOR ALL USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY staff_invites_platform ON public.staff_invites
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Public lookup by token (for accept invite page — limited columns via RPC)
CREATE OR REPLACE FUNCTION public.lookup_staff_invite(p_token TEXT)
RETURNS TABLE (
  email TEXT,
  full_name TEXT,
  company_name TEXT,
  role_code TEXT,
  expired BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.email::TEXT,
    i.full_name,
    c.name,
    i.role_code,
    (i.accepted_at IS NOT NULL OR i.expires_at < now() OR i.soft_delete) AS expired
  FROM public.staff_invites i
  JOIN public.companies c ON c.id = i.company_id
  WHERE i.token = p_token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_staff_invite(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_staff_invite(
  p_email TEXT,
  p_full_name TEXT,
  p_role_code TEXT DEFAULT 'receptionist',
  p_phone TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (invite_id UUID, token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
  v_id UUID;
  v_token TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager') AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Only company admins can invite staff';
  END IF;

  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN RAISE EXCEPTION 'No company context'; END IF;

  INSERT INTO public.staff_invites (company_id, email, full_name, phone, role_code, branch_id, invited_by)
  VALUES (
    v_company,
    lower(trim(p_email)),
    trim(p_full_name),
    nullif(trim(p_phone), ''),
    coalesce(nullif(trim(p_role_code), ''), 'receptionist'),
    p_branch_id,
    v_uid
  )
  ON CONFLICT (company_id, email) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        role_code = EXCLUDED.role_code,
        branch_id = EXCLUDED.branch_id,
        token = encode(gen_random_bytes(24), 'hex'),
        accepted_at = NULL,
        expires_at = now() + interval '7 days',
        soft_delete = FALSE,
        invited_by = v_uid
  RETURNING id, staff_invites.token INTO v_id, v_token;

  RETURN QUERY SELECT v_id, v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_staff_invite(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- Provision auth user + staff in one step (admin sets a temporary password)
CREATE OR REPLACE FUNCTION public.provision_company_staff(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role_code TEXT DEFAULT 'receptionist',
  p_phone TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
  v_role_id UUID;
  v_new_id UUID;
  v_email TEXT := lower(trim(p_email));
  v_staff_id UUID;
  v_instance UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(coalesce(p_password, '')) < 8 THEN RAISE EXCEPTION 'Password must be at least 8 characters'; END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager') AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Only company admins can create staff';
  END IF;

  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN RAISE EXCEPTION 'No company context'; END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE code = coalesce(nullif(trim(p_role_code), ''), 'receptionist') LIMIT 1;
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'Unknown role'; END IF;

  SELECT id INTO v_new_id FROM auth.users WHERE email = v_email LIMIT 1;

  IF v_new_id IS NULL THEN
    SELECT id INTO v_instance FROM auth.instances LIMIT 1;
    v_new_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      coalesce(v_instance, '00000000-0000-0000-0000-000000000000'::UUID),
      v_new_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', trim(p_full_name)),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_new_id,
      v_new_id,
      jsonb_build_object('sub', v_new_id::text, 'email', v_email),
      'email',
      v_email,
      now(),
      now(),
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.users (id, email, full_name, phone, user_type, company_id, email_verified)
  VALUES (
    v_new_id,
    v_email,
    trim(p_full_name),
    nullif(trim(p_phone), ''),
    'staff',
    v_company,
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    company_id = v_company,
    user_type = 'staff',
    soft_delete = FALSE,
    is_active = TRUE;

  INSERT INTO public.staff (company_id, user_id, role_id, phone, is_active)
  VALUES (v_company, v_new_id, v_role_id, nullif(trim(p_phone), ''), TRUE)
  ON CONFLICT (company_id, user_id) DO UPDATE
    SET role_id = EXCLUDED.role_id,
        phone = COALESCE(EXCLUDED.phone, public.staff.phone),
        is_active = TRUE,
        soft_delete = FALSE
  RETURNING id INTO v_staff_id;

  IF p_branch_id IS NOT NULL THEN
    INSERT INTO public.staff_branch_assignments (company_id, staff_id, branch_id, is_primary, created_by)
    VALUES (v_company, v_staff_id, p_branch_id, TRUE, v_uid)
    ON CONFLICT (staff_id, branch_id) DO UPDATE SET soft_delete = FALSE, is_primary = TRUE;
  END IF;

  RETURN v_staff_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_company_staff(TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_staff_invite(
  p_token TEXT,
  p_password TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_inv public.staff_invites%ROWTYPE;
  v_uid UUID := auth.uid();
  v_role_id UUID;
  v_staff_id UUID;
  v_new_id UUID;
  v_instance UUID;
  v_email TEXT;
BEGIN
  SELECT * INTO v_inv FROM public.staff_invites WHERE token = p_token AND soft_delete = FALSE LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF v_inv.accepted_at IS NOT NULL OR v_inv.expires_at < now() THEN RAISE EXCEPTION 'Invite expired'; END IF;
  IF length(coalesce(p_password, '')) < 8 THEN RAISE EXCEPTION 'Password must be at least 8 characters'; END IF;

  v_email := lower(v_inv.email::TEXT);
  SELECT id INTO v_role_id FROM public.roles WHERE code = v_inv.role_code LIMIT 1;
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'Unknown role on invite'; END IF;

  IF v_uid IS NOT NULL THEN
    IF lower(coalesce(auth.jwt() ->> 'email', '')) <> v_email THEN
      RAISE EXCEPTION 'Sign in with the invited email';
    END IF;
    v_new_id := v_uid;
  ELSE
    SELECT id INTO v_new_id FROM auth.users WHERE email = v_email LIMIT 1;
    IF v_new_id IS NULL THEN
      SELECT id INTO v_instance FROM auth.instances LIMIT 1;
      v_new_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        coalesce(v_instance, '00000000-0000-0000-0000-000000000000'::UUID),
        v_new_id, 'authenticated', 'authenticated', v_email,
        crypt(p_password, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_inv.full_name),
        now(), now(), '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (
        v_new_id, v_new_id,
        jsonb_build_object('sub', v_new_id::text, 'email', v_email),
        'email', v_email, now(), now(), now()
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  INSERT INTO public.users (id, email, full_name, phone, user_type, company_id, email_verified)
  VALUES (v_new_id, v_email, v_inv.full_name, v_inv.phone, 'staff', v_inv.company_id, TRUE)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    company_id = v_inv.company_id,
    user_type = 'staff',
    is_active = TRUE,
    soft_delete = FALSE;

  INSERT INTO public.staff (company_id, user_id, role_id, phone, is_active)
  VALUES (v_inv.company_id, v_new_id, v_role_id, v_inv.phone, TRUE)
  ON CONFLICT (company_id, user_id) DO UPDATE
    SET role_id = EXCLUDED.role_id, is_active = TRUE, soft_delete = FALSE
  RETURNING id INTO v_staff_id;

  IF v_inv.branch_id IS NOT NULL THEN
    INSERT INTO public.staff_branch_assignments (company_id, staff_id, branch_id, is_primary)
    VALUES (v_inv.company_id, v_staff_id, v_inv.branch_id, TRUE)
    ON CONFLICT (staff_id, branch_id) DO UPDATE SET soft_delete = FALSE, is_primary = TRUE;
  END IF;

  UPDATE public.staff_invites SET accepted_at = now() WHERE id = v_inv.id;
  RETURN v_staff_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_staff_invite(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_staff_active(p_staff_id UUID, p_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager') AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.staff
  SET is_active = p_active
  WHERE id = p_staff_id AND company_id = public.get_user_company_id();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_staff_active(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_staff_branch(p_staff_id UUID, p_branch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
BEGIN
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager') AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.staff_branch_assignments
  SET is_primary = FALSE
  WHERE staff_id = p_staff_id AND company_id = v_company;

  INSERT INTO public.staff_branch_assignments (company_id, staff_id, branch_id, is_primary)
  VALUES (v_company, p_staff_id, p_branch_id, TRUE)
  ON CONFLICT (staff_id, branch_id) DO UPDATE SET soft_delete = FALSE, is_primary = TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_staff_branch(UUID, UUID) TO authenticated;


-- ##### supabase\migrations\20260312000015_saas_billing_lock_drivers.sql #####
-- Commercial SaaS hardening: lock, billing columns, driver assign, messaging settings

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_sender_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS notify_on_receive BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_dispatch BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_ready BOOLEAN NOT NULL DEFAULT TRUE;

-- Lifecycle kill switch (platform)
CREATE OR REPLACE FUNCTION public.set_company_lifecycle(
  p_company_id UUID,
  p_status company_status,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.companies;
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Platform owner access required';
  END IF;

  UPDATE public.companies
  SET
    status = p_status,
    paused_at = CASE WHEN p_status = 'paused' THEN NOW() ELSE paused_at END,
    suspended_at = CASE WHEN p_status = 'suspended' THEN NOW() ELSE suspended_at END,
    disconnected_at = CASE WHEN p_status = 'disconnected' THEN NOW() ELSE disconnected_at END,
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE id = p_company_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_company_lifecycle(UUID, company_status, TEXT) TO authenticated;

-- Lock when paused/suspended/disconnected/expired OR trial date passed
CREATE OR REPLACE FUNCTION public.is_company_locked(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = p_company_id
      AND c.soft_delete = FALSE
      AND (
        c.status IN ('paused', 'suspended', 'disconnected', 'expired')
        OR (
          c.status = 'trial'
          AND c.trial_ends_at IS NOT NULL
          AND c.trial_ends_at < now()
        )
        OR EXISTS (
          SELECT 1 FROM public.subscriptions s
          WHERE s.company_id = c.id
            AND s.soft_delete = FALSE
            AND s.status IN ('expired', 'cancelled')
            AND NOT EXISTS (
              SELECT 1 FROM public.subscriptions s2
              WHERE s2.company_id = c.id
                AND s2.soft_delete = FALSE
                AND s2.status IN ('active', 'trialing')
            )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_locked(UUID) TO anon, authenticated, service_role;

-- Expire due trials (call from cron / edge)
CREATE OR REPLACE FUNCTION public.expire_due_trials()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired', updated_at = now()
  WHERE status = 'trialing'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < now()
    AND soft_delete = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.companies c
  SET status = 'expired', updated_at = now()
  WHERE c.status = 'trial'
    AND c.trial_ends_at IS NOT NULL
    AND c.trial_ends_at < now()
    AND c.soft_delete = FALSE;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_due_trials() TO service_role;

CREATE OR REPLACE FUNCTION public.get_company_billing_state(p_company_id UUID DEFAULT NULL)
RETURNS TABLE (
  company_id UUID,
  company_status TEXT,
  trial_ends_at TIMESTAMPTZ,
  days_left INT,
  locked BOOLEAN,
  plan_code TEXT,
  plan_name TEXT,
  plan_price_cents INT,
  currency_code TEXT,
  subscription_status TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := coalesce(p_company_id, public.get_user_company_id());
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No company';
  END IF;
  IF auth.uid() IS NOT NULL
     AND NOT public.is_platform_owner()
     AND public.get_user_company_id() IS DISTINCT FROM v_company THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.status::TEXT,
    c.trial_ends_at,
    CASE
      WHEN c.trial_ends_at IS NULL THEN NULL
      ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.trial_ends_at - now())) / 86400.0)::INT)
    END,
    public.is_company_locked(c.id),
    p.code,
    p.name,
    p.price_cents,
    p.currency_code,
    s.status::TEXT,
    coalesce(s.stripe_customer_id, c.stripe_customer_id),
    s.stripe_subscription_id,
    s.current_period_end
  FROM public.companies c
  LEFT JOIN LATERAL (
    SELECT * FROM public.subscriptions sx
    WHERE sx.company_id = c.id AND sx.soft_delete = FALSE
    ORDER BY sx.created_at DESC
    LIMIT 1
  ) s ON TRUE
  LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
  WHERE c.id = v_company;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_billing_state(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_driver_to_parcels(
  p_parcel_ids UUID[],
  p_driver_id UUID,
  p_vehicle_id UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_uid UUID := auth.uid();
  v_id UUID;
  v_n INT := 0;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager', 'dispatcher')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = p_driver_id AND d.company_id = v_company AND d.soft_delete = FALSE
  ) THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;

  FOREACH v_id IN ARRAY p_parcel_ids LOOP
    INSERT INTO public.driver_assignments (
      company_id, parcel_id, driver_id, vehicle_id, assigned_at, created_by
    )
    VALUES (v_company, v_id, p_driver_id, p_vehicle_id, now(), v_uid);

    UPDATE public.parcels
    SET status = 'dispatched', updated_at = now()
    WHERE id = v_id AND company_id = v_company;

    INSERT INTO public.parcel_tracking (
      company_id, parcel_id, status, title, description, occurred_at, is_public
    ) VALUES (
      v_company, v_id, 'dispatched', 'Dispatched',
      'Assigned to driver and left origin branch.', now(), TRUE
    );

    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_driver_to_parcels(UUID[], UUID, UUID) TO authenticated;

-- List drivers for dispatch UI
CREATE OR REPLACE FUNCTION public.list_company_drivers()
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  available BOOLEAN,
  license_number TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    coalesce(u.full_name, u.email, 'Driver') AS name,
    coalesce(s.phone, u.phone) AS phone,
    d.is_available AS available,
    d.license_number
  FROM public.drivers d
  JOIN public.staff s ON s.id = d.staff_id
  JOIN public.users u ON u.id = s.user_id
  WHERE d.company_id = public.get_user_company_id()
    AND d.soft_delete = FALSE
  ORDER BY u.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.list_company_drivers() TO authenticated;

-- Promote staff member with driver role into drivers table
CREATE OR REPLACE FUNCTION public.ensure_driver_profile(p_staff_id UUID, p_license TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_driver UUID;
BEGIN
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager', 'dispatcher') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  INSERT INTO public.drivers (company_id, staff_id, license_number, is_available)
  SELECT v_company, p_staff_id, nullif(trim(p_license), ''), TRUE
  FROM public.staff s
  WHERE s.id = p_staff_id AND s.company_id = v_company AND s.soft_delete = FALSE
  ON CONFLICT (company_id, staff_id) DO UPDATE
    SET soft_delete = FALSE, is_available = TRUE, license_number = COALESCE(EXCLUDED.license_number, public.drivers.license_number)
  RETURNING id INTO v_driver;

  RETURN v_driver;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_driver_profile(UUID, TEXT) TO authenticated;


-- ##### supabase\migrations\20260312000016_genesyspay_billing.sql #####
-- GenesysPay SaaS billing (Zambia ZMW) — replaces Stripe as primary path

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS genesys_tx_ref TEXT,
  ADD COLUMN IF NOT EXISTS genesys_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.saas_payment_intents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id             UUID NOT NULL REFERENCES public.subscription_plans(id),
  tx_ref              TEXT NOT NULL UNIQUE,
  amount_major        NUMERIC(12, 2) NOT NULL,
  currency_code       CHAR(3) NOT NULL DEFAULT 'ZMW',
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'submitted', 'success', 'failed', 'cancelled')),
  channel             TEXT,
  method              TEXT,
  phone_number        TEXT,
  genesys_transaction_id TEXT,
  provider_payload    JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by          UUID REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_saas_payment_intents_company ON public.saas_payment_intents(company_id);
CREATE INDEX IF NOT EXISTS idx_saas_payment_intents_status ON public.saas_payment_intents(status);

ALTER TABLE public.saas_payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saas_payment_intents_tenant ON public.saas_payment_intents;
CREATE POLICY saas_payment_intents_tenant ON public.saas_payment_intents
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR public.is_platform_owner());

DROP POLICY IF EXISTS saas_payment_intents_platform ON public.saas_payment_intents;
CREATE POLICY saas_payment_intents_platform ON public.saas_payment_intents
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Zambia pricing in ngwee (1/100 ZMW). API amount = price_cents / 100.
UPDATE public.subscription_plans
SET
  currency_code = 'ZMW',
  price_cents = CASE code
    WHEN 'starter' THEN 49900          -- K499 / month
    WHEN 'professional' THEN 99900     -- K999 / month
    ELSE price_cents
  END,
  updated_at = NOW()
WHERE code IN ('starter', 'professional') AND soft_delete = FALSE;

-- Create pending intent + return checkout fields (edge fills Genesys keys)
CREATE OR REPLACE FUNCTION public.create_saas_payment_intent(p_plan_code TEXT DEFAULT 'starter')
RETURNS TABLE (
  intent_id UUID,
  tx_ref TEXT,
  amount_major NUMERIC,
  currency_code TEXT,
  plan_code TEXT,
  plan_name TEXT,
  company_id UUID,
  company_name TEXT,
  payer_email TEXT,
  payer_name TEXT,
  payer_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
  v_plan RECORD;
  v_user RECORD;
  v_company_name TEXT;
  v_ref TEXT;
  v_amount NUMERIC(12, 2);
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN RAISE EXCEPTION 'No company'; END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager', 'finance')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE code = p_plan_code AND is_active = TRUE AND soft_delete = FALSE
  LIMIT 1;

  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Unknown plan'; END IF;

  SELECT u.email, u.full_name, u.phone, c.name, c.phone AS company_phone
  INTO v_user
  FROM public.users u
  JOIN public.companies c ON c.id = v_company
  WHERE u.id = v_uid;

  v_company_name := v_user.name;
  v_amount := ROUND(v_plan.price_cents::NUMERIC / 100.0, 2);
  v_ref := 'POS-' || replace(v_company::TEXT, '-', '') || '-' || to_char(NOW(), 'YYMMDDHH24MISS') || '-' || substr(md5(random()::TEXT), 1, 6);

  INSERT INTO public.saas_payment_intents (
    company_id, plan_id, tx_ref, amount_major, currency_code, status, created_by
  ) VALUES (
    v_company, v_plan.id, v_ref, v_amount, coalesce(v_plan.currency_code, 'ZMW'), 'pending', v_uid
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT
    v_id,
    v_ref,
    v_amount,
    coalesce(v_plan.currency_code, 'ZMW')::TEXT,
    v_plan.code::TEXT,
    v_plan.name::TEXT,
    v_company,
    v_company_name::TEXT,
    v_user.email::TEXT,
    coalesce(v_user.full_name, v_company_name)::TEXT,
    coalesce(nullif(trim(v_user.phone), ''), nullif(trim(v_user.company_phone), ''))::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_saas_payment_intent(TEXT) TO authenticated;

-- Activate workspace after GenesysPay SUCCESS (service role / webhook)
CREATE OR REPLACE FUNCTION public.activate_subscription_from_genesys(
  p_tx_ref TEXT,
  p_transaction_id TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent public.saas_payment_intents%ROWTYPE;
  v_period_end TIMESTAMPTZ := NOW() + interval '30 days';
BEGIN
  SELECT * INTO v_intent
  FROM public.saas_payment_intents
  WHERE tx_ref = p_tx_ref AND soft_delete = FALSE
  FOR UPDATE;

  IF v_intent.id IS NULL THEN
    RAISE EXCEPTION 'Payment intent not found';
  END IF;

  IF v_intent.status = 'success' THEN
    RETURN TRUE; -- idempotent
  END IF;

  UPDATE public.saas_payment_intents
  SET
    status = 'success',
    genesys_transaction_id = coalesce(p_transaction_id, genesys_transaction_id),
    provider_payload = coalesce(p_payload, provider_payload),
    updated_at = NOW()
  WHERE id = v_intent.id;

  UPDATE public.companies
  SET status = 'active', updated_at = NOW()
  WHERE id = v_intent.company_id;

  UPDATE public.subscriptions
  SET
    plan_id = v_intent.plan_id,
    status = 'active',
    current_period_start = NOW(),
    current_period_end = v_period_end,
    genesys_tx_ref = p_tx_ref,
    genesys_transaction_id = p_transaction_id,
    last_paid_at = NOW(),
    updated_at = NOW()
  WHERE id = (
    SELECT id FROM public.subscriptions
    WHERE company_id = v_intent.company_id AND soft_delete = FALSE
    ORDER BY created_at DESC
    LIMIT 1
  );

  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (
      company_id, plan_id, status, current_period_start, current_period_end,
      genesys_tx_ref, genesys_transaction_id, last_paid_at
    ) VALUES (
      v_intent.company_id, v_intent.plan_id, 'active', NOW(), v_period_end,
      p_tx_ref, p_transaction_id, NOW()
    );
  END IF;

  INSERT INTO public.audit_logs (company_id, action, entity_type, entity_id, description)
  VALUES (
    v_intent.company_id, 'update', 'subscription', v_intent.company_id,
    'GenesysPay subscription activated: ' || p_tx_ref
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_subscription_from_genesys(TEXT, TEXT, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_saas_payment_failed(
  p_tx_ref TEXT,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.saas_payment_intents
  SET status = 'failed', provider_payload = coalesce(p_payload, provider_payload), updated_at = NOW()
  WHERE tx_ref = p_tx_ref AND status <> 'success' AND soft_delete = FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_saas_payment_failed(TEXT, JSONB) TO service_role;


-- ##### supabase\migrations\20260312000017_platform_payment_accounts.sql #####
-- Platform owner payout details (MTN, Airtel, banks) + manual SaaS pay claims

CREATE TABLE IF NOT EXISTS public.platform_payment_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            TEXT NOT NULL CHECK (kind IN ('mobile_money', 'bank')),
  provider        TEXT NOT NULL,          -- mtn | airtel | zamtel | uba | access | stanbic | ...
  label           TEXT NOT NULL,          -- display name e.g. "MTN Mobile Money"
  account_name    TEXT NOT NULL,          -- registered name
  account_number  TEXT NOT NULL,          -- phone or bank account number
  bank_branch     TEXT,
  sort_code       TEXT,
  instructions    TEXT,                   -- e.g. "Send as Payment / Merchant"
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_payment_accounts_provider_number
  ON public.platform_payment_accounts (provider, account_number)
  WHERE soft_delete = FALSE;

ALTER TABLE public.platform_payment_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_payment_accounts_read ON public.platform_payment_accounts;
CREATE POLICY platform_payment_accounts_read ON public.platform_payment_accounts
  FOR SELECT TO authenticated
  USING (is_active = TRUE AND soft_delete = FALSE);

DROP POLICY IF EXISTS platform_payment_accounts_platform ON public.platform_payment_accounts;
CREATE POLICY platform_payment_accounts_platform ON public.platform_payment_accounts
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Seed placeholders only when empty (owner edits real numbers in Admin → Billing)
INSERT INTO public.platform_payment_accounts (kind, provider, label, account_name, account_number, instructions, sort_order)
SELECT * FROM (VALUES
  ('mobile_money'::TEXT, 'mtn'::TEXT, 'MTN Mobile Money'::TEXT, 'Mthunzi Tech Labs'::TEXT, '097XXXXXXX'::TEXT, 'Send money · put the payment reference in the message'::TEXT, 1),
  ('mobile_money', 'airtel', 'Airtel Money', 'Mthunzi Tech Labs', '096XXXXXXX', 'Send money · put the payment reference in the message', 2),
  ('mobile_money', 'zamtel', 'Zamtel Kwacha', 'Mthunzi Tech Labs', '095XXXXXXX', 'Send money · put the payment reference in the message', 3),
  ('bank', 'uba', 'UBA Bank Zambia', 'Mthunzi Tech Labs', '0000000000', 'Bank transfer · put the payment reference in the narration', 10),
  ('bank', 'access', 'Access Bank Zambia', 'Mthunzi Tech Labs', '0000000000', 'Bank transfer · put the payment reference in the narration', 11)
) AS v(kind, provider, label, account_name, account_number, instructions, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.platform_payment_accounts WHERE soft_delete = FALSE LIMIT 1);

ALTER TABLE public.saas_payment_intents
  ADD COLUMN IF NOT EXISTS payment_path TEXT DEFAULT 'genesys'
    CHECK (payment_path IN ('genesys', 'manual')),
  ADD COLUMN IF NOT EXISTS paid_via_account_id UUID REFERENCES public.platform_payment_accounts(id),
  ADD COLUMN IF NOT EXISTS payer_note TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Public read for company admins paying
CREATE OR REPLACE FUNCTION public.list_platform_payment_accounts()
RETURNS SETOF public.platform_payment_accounts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.platform_payment_accounts
  WHERE is_active = TRUE AND soft_delete = FALSE
  ORDER BY sort_order, label;
$$;

GRANT EXECUTE ON FUNCTION public.list_platform_payment_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_platform_payment_account(
  p_id UUID DEFAULT NULL,
  p_kind TEXT DEFAULT 'mobile_money',
  p_provider TEXT DEFAULT 'mtn',
  p_label TEXT DEFAULT '',
  p_account_name TEXT DEFAULT '',
  p_account_number TEXT DEFAULT '',
  p_bank_branch TEXT DEFAULT NULL,
  p_sort_code TEXT DEFAULT NULL,
  p_instructions TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_sort_order INT DEFAULT 0
)
RETURNS public.platform_payment_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.platform_payment_accounts;
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Platform owner access required';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.platform_payment_accounts
    SET
      kind = p_kind,
      provider = lower(trim(p_provider)),
      label = trim(p_label),
      account_name = trim(p_account_name),
      account_number = trim(p_account_number),
      bank_branch = nullif(trim(p_bank_branch), ''),
      sort_code = nullif(trim(p_sort_code), ''),
      instructions = nullif(trim(p_instructions), ''),
      is_active = p_is_active,
      sort_order = p_sort_order,
      updated_at = NOW(),
      soft_delete = FALSE
    WHERE id = p_id
    RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
    RETURN v_row;
  END IF;

  INSERT INTO public.platform_payment_accounts (
    kind, provider, label, account_name, account_number, bank_branch, sort_code, instructions, is_active, sort_order
  ) VALUES (
    p_kind, lower(trim(p_provider)), trim(p_label), trim(p_account_name), trim(p_account_number),
    nullif(trim(p_bank_branch), ''), nullif(trim(p_sort_code), ''), nullif(trim(p_instructions), ''),
    p_is_active, p_sort_order
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_platform_payment_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INT) TO authenticated;

-- Start manual payment: returns ref + amount + accounts to pay into
CREATE OR REPLACE FUNCTION public.create_manual_saas_payment(
  p_plan_code TEXT DEFAULT 'starter',
  p_account_id UUID DEFAULT NULL
)
RETURNS TABLE (
  intent_id UUID,
  tx_ref TEXT,
  amount_major NUMERIC,
  currency_code TEXT,
  plan_code TEXT,
  plan_name TEXT,
  company_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
  v_plan RECORD;
  v_company_name TEXT;
  v_ref TEXT;
  v_amount NUMERIC(12, 2);
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN RAISE EXCEPTION 'No company'; END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager', 'finance')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans
  WHERE code = p_plan_code AND is_active AND NOT soft_delete LIMIT 1;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Unknown plan'; END IF;

  SELECT name INTO v_company_name FROM public.companies WHERE id = v_company;
  v_amount := ROUND(v_plan.price_cents::NUMERIC / 100.0, 2);
  v_ref := 'POS-' || upper(substr(replace(v_company::TEXT, '-', ''), 1, 6)) || '-' || to_char(NOW(), 'DDMM') || '-' || substr(md5(random()::TEXT), 1, 4);

  INSERT INTO public.saas_payment_intents (
    company_id, plan_id, tx_ref, amount_major, currency_code, status,
    payment_path, paid_via_account_id, channel, method, created_by
  ) VALUES (
    v_company, v_plan.id, v_ref, v_amount, coalesce(v_plan.currency_code, 'ZMW'), 'pending',
    'manual', p_account_id, 'manual', 'direct_transfer', v_uid
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_ref, v_amount, coalesce(v_plan.currency_code, 'ZMW')::TEXT,
    v_plan.code::TEXT, v_plan.name::TEXT, v_company_name::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_manual_saas_payment(TEXT, UUID) TO authenticated;

-- Tenant: I have paid (awaiting platform confirm)
CREATE OR REPLACE FUNCTION public.claim_manual_saas_payment(
  p_tx_ref TEXT,
  p_account_id UUID DEFAULT NULL,
  p_payer_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'No company'; END IF;

  UPDATE public.saas_payment_intents
  SET
    status = 'submitted',
    paid_via_account_id = coalesce(p_account_id, paid_via_account_id),
    payer_note = nullif(trim(p_payer_note), ''),
    claimed_at = NOW(),
    updated_at = NOW()
  WHERE tx_ref = p_tx_ref
    AND company_id = v_company
    AND payment_path = 'manual'
    AND status IN ('pending', 'submitted')
    AND soft_delete = FALSE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payment reference not found'; END IF;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_manual_saas_payment(TEXT, UUID, TEXT) TO authenticated;

-- Platform owner confirms MoMo/bank payment → activate
CREATE OR REPLACE FUNCTION public.confirm_manual_saas_payment(p_tx_ref TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Platform owner access required';
  END IF;

  UPDATE public.saas_payment_intents
  SET confirmed_by = auth.uid(), confirmed_at = NOW(), updated_at = NOW()
  WHERE tx_ref = p_tx_ref AND payment_path = 'manual' AND soft_delete = FALSE;

  RETURN public.activate_subscription_from_genesys(p_tx_ref, 'manual:' || p_tx_ref, jsonb_build_object('path', 'manual'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_manual_saas_payment(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_pending_manual_saas_payments()
RETURNS TABLE (
  id UUID,
  tx_ref TEXT,
  amount_major NUMERIC,
  currency_code TEXT,
  status TEXT,
  company_id UUID,
  company_name TEXT,
  plan_name TEXT,
  account_label TEXT,
  payer_note TEXT,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.tx_ref,
    i.amount_major,
    i.currency_code,
    i.status,
    i.company_id,
    c.name,
    p.name,
    a.label,
    i.payer_note,
    i.claimed_at,
    i.created_at
  FROM public.saas_payment_intents i
  JOIN public.companies c ON c.id = i.company_id
  JOIN public.subscription_plans p ON p.id = i.plan_id
  LEFT JOIN public.platform_payment_accounts a ON a.id = i.paid_via_account_id
  WHERE public.is_platform_owner()
    AND i.payment_path = 'manual'
    AND i.status IN ('pending', 'submitted')
    AND i.soft_delete = FALSE
  ORDER BY i.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_pending_manual_saas_payments() TO authenticated;


GRANT EXECUTE ON FUNCTION public.activate_subscription_from_genesys(TEXT, TEXT, JSONB) TO authenticated;
