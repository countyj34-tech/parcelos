-- =============================================================================
-- ParcelOS — Bootstrap helpers & demo company seed
-- =============================================================================

-- Link an existing Supabase Auth user as platform owner by email.
CREATE OR REPLACE FUNCTION public.bootstrap_platform_admin(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID;
  v_role_id UUID;
  v_id UUID;
BEGIN
  SELECT id INTO v_auth_id FROM auth.users WHERE email = p_email LIMIT 1;
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Auth user not found for email: %', p_email;
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE code = 'platform_owner';

  INSERT INTO public.platform_users (auth_user_id, email, full_name, role_id)
  VALUES (v_auth_id, p_email, split_part(p_email, '@', 1), v_role_id)
  ON CONFLICT (auth_user_id) DO UPDATE SET is_active = TRUE, soft_delete = FALSE
  RETURNING id INTO v_id;

  UPDATE public.users SET user_type = 'platform' WHERE id = v_auth_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.bootstrap_platform_admin IS
  'Run after creating auth user: SELECT bootstrap_platform_admin(''admin@mthunzi.tech'');';

-- Demo courier company (Swift Logistics) — branches only; link staff after auth signup
INSERT INTO public.companies (
  id, name, code, slug, country_code, currency_code, phone, email,
  subdomain, status, primary_color, secondary_color
)
SELECT
  'a1111111-1111-1111-1111-111111111111'::UUID,
  'Swift Logistics',
  'SWL',
  'swift-logistics',
  'ZM',
  'ZMW',
  '+260 211 234 500',
  'hello@swiftlogistics.zm',
  'swift.parcelos.africa',
  'active',
  '#0F766E',
  '#F59E0B'
WHERE NOT EXISTS (SELECT 1 FROM public.companies WHERE slug = 'swift-logistics');

INSERT INTO public.company_settings (company_id, tracking_prefix)
SELECT 'a1111111-1111-1111-1111-111111111111'::UUID, 'POS'
WHERE EXISTS (SELECT 1 FROM public.companies WHERE id = 'a1111111-1111-1111-1111-111111111111'::UUID)
  AND NOT EXISTS (SELECT 1 FROM public.company_settings WHERE company_id = 'a1111111-1111-1111-1111-111111111111'::UUID);

INSERT INTO public.branches (company_id, code, name, city, country_code, is_head_office)
SELECT v.company_id, v.code, v.name, v.city, 'ZM', v.is_hq
FROM (VALUES
  ('a1111111-1111-1111-1111-111111111111'::UUID, 'LUS-CAI', 'Lusaka — Cairo Road', 'Lusaka', TRUE),
  ('a1111111-1111-1111-1111-111111111111'::UUID, 'LUS-KAB', 'Lusaka — Kabulonga', 'Lusaka', FALSE),
  ('a1111111-1111-1111-1111-111111111111'::UUID, 'NDO-BRD', 'Ndola — Broadway', 'Ndola', FALSE)
) AS v(company_id, code, name, city, is_hq)
WHERE EXISTS (SELECT 1 FROM public.companies WHERE id = 'a1111111-1111-1111-1111-111111111111'::UUID)
  AND NOT EXISTS (SELECT 1 FROM public.branches WHERE company_id = v.company_id AND code = v.code);

INSERT INTO public.domains (company_id, hostname, domain_type, is_primary, ssl_status, verified)
SELECT 'a1111111-1111-1111-1111-111111111111'::UUID, 'swift.parcelos.africa', 'subdomain', TRUE, 'active', TRUE
WHERE EXISTS (SELECT 1 FROM public.companies WHERE id = 'a1111111-1111-1111-1111-111111111111'::UUID)
  AND NOT EXISTS (SELECT 1 FROM public.domains WHERE company_id = 'a1111111-1111-1111-1111-111111111111'::UUID);

-- Helper: link auth user to Swift Logistics as company admin
CREATE OR REPLACE FUNCTION public.bootstrap_company_admin(
  p_email TEXT,
  p_company_id UUID DEFAULT 'a1111111-1111-1111-1111-111111111111'::UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID;
  v_role_id UUID;
  v_staff_id UUID;
BEGIN
  SELECT id INTO v_auth_id FROM auth.users WHERE email = p_email LIMIT 1;
  IF v_auth_id IS NULL THEN RAISE EXCEPTION 'Auth user not found: %', p_email; END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE code = 'company_admin';

  UPDATE public.users
  SET company_id = p_company_id, user_type = 'staff', full_name = COALESCE(full_name, split_part(p_email, '@', 1))
  WHERE id = v_auth_id;

  INSERT INTO public.staff (company_id, user_id, role_id)
  VALUES (p_company_id, v_auth_id, v_role_id)
  ON CONFLICT (company_id, user_id) DO UPDATE SET is_active = TRUE, soft_delete = FALSE
  RETURNING id INTO v_staff_id;

  RETURN v_staff_id;
END;
$$;

COMMENT ON FUNCTION public.bootstrap_company_admin IS
  'After signup: SELECT bootstrap_company_admin(''linda@swiftlogistics.zm'');';
