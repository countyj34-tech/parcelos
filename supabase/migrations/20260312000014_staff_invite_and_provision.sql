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
