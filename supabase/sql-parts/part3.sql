  LOOP
    EXECUTE format(
      'CREATE POLICY %I_platform_all ON public.%I FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner())',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY %I_tenant_select ON public.%I FOR SELECT USING (company_id = public.get_user_company_id() AND soft_delete = FALSE)',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY %I_tenant_insert ON public.%I FOR INSERT WITH CHECK (company_id = public.get_user_company_id())',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY %I_tenant_update ON public.%I FOR UPDATE USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id())',
      t, t
    );
  END LOOP;
END $$;

-- Parcels & driver assignments â€” role-scoped (excluded from generic tenant loop)
CREATE POLICY parcels_platform_all ON public.parcels
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

CREATE POLICY parcels_tenant_insert ON public.parcels
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY parcels_tenant_update ON public.parcels
  FOR UPDATE USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY driver_assignments_platform_all ON public.driver_assignments
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

CREATE POLICY driver_assignments_tenant ON public.driver_assignments
  FOR ALL USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Subscriptions: company admin read
CREATE POLICY subscriptions_company_admin ON public.subscriptions
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() IN ('company_admin', 'finance')
  );

-- Parcels: branch-scoped read for receptionist / branch manager
CREATE POLICY parcels_branch_scope ON public.parcels
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() IN ('company_admin', 'finance', 'dispatcher', 'customer_support', 'auditor')
  );

CREATE POLICY parcels_branch_limited ON public.parcels
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() IN ('branch_manager', 'receptionist')
    AND (
      origin_branch_id IN (SELECT public.get_user_branch_ids())
      OR destination_branch_id IN (SELECT public.get_user_branch_ids())
      OR current_branch_id IN (SELECT public.get_user_branch_ids())
    )
  );

-- Drivers: only assigned parcels
CREATE POLICY parcels_driver ON public.parcels
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() = 'driver'
    AND EXISTS (
      SELECT 1 FROM public.driver_assignments da
      WHERE da.parcel_id = parcels.id
        AND da.driver_id = public.get_driver_id()
        AND da.soft_delete = FALSE
    )
  );

-- Customers: own parcels only (customer portal)
CREATE POLICY parcels_customer ON public.parcels
  FOR SELECT USING (
    sender_customer_id = public.get_customer_id()
    OR receiver_phone IN (
      SELECT phone FROM public.customers WHERE id = public.get_customer_id()
    )
  );

-- Public tracking by tracking number (anon read via edge function or limited view)
CREATE POLICY parcel_tracking_public ON public.parcel_tracking
  FOR SELECT USING (is_public = TRUE AND soft_delete = FALSE);

CREATE POLICY parcel_tracking_tenant ON public.parcel_tracking
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Notifications
CREATE POLICY notifications_user ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notifications_platform ON public.notifications
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

CREATE POLICY notifications_tenant ON public.notifications
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Audit logs
CREATE POLICY audit_logs_platform ON public.audit_logs
  FOR ALL USING (public.is_platform_owner());

CREATE POLICY audit_logs_company ON public.audit_logs
  FOR SELECT USING (company_id = public.get_user_company_id());

-- System logs â€” platform only
CREATE POLICY system_logs_platform ON public.system_logs
  FOR ALL USING (public.is_platform_owner());

-- Sessions
CREATE POLICY sessions_self ON public.sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY sessions_platform ON public.sessions
  FOR ALL USING (public.is_platform_owner());

-- Email logs
CREATE POLICY email_logs_platform ON public.email_logs
  FOR ALL USING (public.is_platform_owner());

CREATE POLICY email_logs_tenant ON public.email_logs
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Customers self-access
CREATE POLICY customers_self ON public.customers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY receivers_customer ON public.receivers
  FOR SELECT USING (customer_id = public.get_customer_id());

-- Driver assignments
CREATE POLICY driver_assignments_driver ON public.driver_assignments
  FOR SELECT USING (driver_id = public.get_driver_id());

-- Grant usage to authenticated and service_role
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;



-- ========== 20260312000009_storage_realtime.sql ==========

-- =============================================================================
-- ParcelOS â€” Storage Buckets & Realtime Publications
-- =============================================================================

-- Storage buckets (company-isolated via RLS on storage.objects)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('company-logos', 'company-logos', TRUE, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('parcel-images', 'parcel-images', FALSE, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('receipts', 'receipts', FALSE, 5242880, ARRAY['application/pdf', 'image/png', 'image/jpeg']),
  ('documents', 'documents', FALSE, 20971520, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('proof-of-delivery', 'proof-of-delivery', FALSE, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage path convention: {company_id}/{entity}/{filename}
CREATE OR REPLACE FUNCTION public.storage_company_id(object_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(split_part(object_name, '/', 1), '')::UUID;
$$;

-- Company logos: public read, company admin write
CREATE POLICY storage_logos_select ON storage.objects
  FOR SELECT USING (bucket_id = 'company-logos');

CREATE POLICY storage_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND public.can_access_company(public.storage_company_id(name))
  );

CREATE POLICY storage_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND public.can_access_company(public.storage_company_id(name))
  );

-- Tenant-private buckets
CREATE POLICY storage_tenant_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('parcel-images', 'receipts', 'documents', 'proof-of-delivery')
    AND (
      public.is_platform_owner()
      OR public.can_access_company(public.storage_company_id(name))
    )
  );

CREATE POLICY storage_tenant_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('parcel-images', 'receipts', 'documents', 'proof-of-delivery')
    AND public.can_access_company(public.storage_company_id(name))
  );

CREATE POLICY storage_tenant_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('parcel-images', 'receipts', 'documents', 'proof-of-delivery')
    AND public.can_access_company(public.storage_company_id(name))
  );

-- Realtime: parcel tracking, notifications, dispatch
ALTER PUBLICATION supabase_realtime ADD TABLE public.parcel_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parcels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_assignments;



-- ========== 20260312000010_seed_reference_data.sql ==========

-- =============================================================================
-- ParcelOS â€” Seed Reference Data (roles, permissions, plans, feature flags)
-- =============================================================================

INSERT INTO public.roles (code, name, description, scope) VALUES
  ('platform_owner', 'Platform Owner', 'MTHUNZI-TECH-LABS super admin', 'platform'),
  ('company_admin', 'Company Admin', 'Full access within courier company', 'company'),
  ('branch_manager', 'Branch Manager', 'Branch-scoped management', 'branch'),
  ('receptionist', 'Receptionist', 'Reception and parcel intake', 'branch'),
  ('dispatcher', 'Dispatcher', 'Dispatch and routing operations', 'company'),
  ('finance', 'Finance', 'Billing and financial reports', 'company'),
  ('customer_support', 'Customer Support', 'Customer and ticket support', 'company'),
  ('driver', 'Driver', 'Assigned delivery operations', 'branch'),
  ('customer', 'Customer', 'Customer portal access', 'customer'),
  ('guest', 'Guest', 'Guest parcel registration', 'guest'),
  ('auditor', 'Auditor', 'Read-only audit access', 'company')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.permissions (code, name, module) VALUES
  ('parcels.create', 'Create parcels', 'parcels'),
  ('parcels.read', 'View parcels', 'parcels'),
  ('parcels.update', 'Update parcels', 'parcels'),
  ('parcels.delete', 'Delete parcels', 'parcels'),
  ('parcels.dispatch', 'Dispatch parcels', 'parcels'),
  ('payments.collect', 'Collect payments', 'payments'),
  ('payments.refund', 'Process refunds', 'payments'),
  ('reports.view', 'View reports', 'reports'),
  ('staff.manage', 'Manage staff', 'staff'),
  ('branches.manage', 'Manage branches', 'branches'),
  ('settings.manage', 'Manage company settings', 'settings'),
  ('companies.manage', 'Manage companies (platform)', 'platform'),
  ('subscriptions.manage', 'Manage subscriptions', 'platform'),
  ('audit.view', 'View audit logs', 'audit')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.subscription_plans (code, name, price_cents, currency_code, max_branches, max_users, max_storage_gb, max_sms_monthly, features, sort_order) VALUES
  ('starter', 'Starter', 99000, 'USD', 1, 8, 10, 1000, '["Parcel ops","SMS","Customer portal"]', 1),
  ('professional', 'Professional', 249000, 'USD', 10, NULL, 50, 5000, '["Dispatch","WhatsApp","Reports","Multi-branch"]', 2),
  ('enterprise', 'Enterprise', 0, 'USD', NULL, NULL, 500, 50000, '["API","SSO","SLA","Dedicated support"]', 3),
  ('custom', 'Custom', 0, 'USD', NULL, NULL, 1000, 100000, '["Bespoke integrations"]', 4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.feature_flags (key, label, description, enabled) VALUES
  ('ussd', 'USSD', 'USSD parcel tracking and registration', TRUE),
  ('whatsapp', 'WhatsApp', 'WhatsApp notifications', TRUE),
  ('ai_reports', 'AI Reports', 'AI-powered analytics reports', FALSE),
  ('barcode', 'Barcode', 'Barcode label generation', TRUE),
  ('qr_code', 'QR Code', 'QR code on labels and tracking', TRUE),
  ('driver_app', 'Driver App', 'Mobile driver application', TRUE),
  ('public_api', 'Public API', 'REST API for integrations', TRUE),
  ('customer_portal', 'Customer Portal', 'White-label customer portal', TRUE),
  ('loyalty', 'Loyalty', 'Customer loyalty programme', FALSE),
  ('pwa_install', 'PWA Install Prompt', 'Progressive web app install', TRUE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.parcel_status (company_id, code, label, sort_order, is_terminal)
SELECT NULL, v.code, v.label, v.sort_order, v.is_terminal
FROM (VALUES
  ('waiting_for_dropoff'::parcel_status_code, 'Waiting For Drop-off', 1, FALSE),
  ('reception_verification', 'Reception Verification', 2, FALSE),
  ('awaiting_payment', 'Awaiting Payment', 3, FALSE),
  ('label_printed', 'Label Printed', 4, FALSE),
  ('received', 'Received', 5, FALSE),
  ('dispatched', 'Dispatched', 6, FALSE),
  ('in_transit', 'In Transit', 7, FALSE),
  ('at_destination_branch', 'Destination Branch', 8, FALSE),
  ('ready_for_collection', 'Ready For Collection', 9, FALSE),
  ('collected', 'Collected', 10, TRUE),
  ('cancelled', 'Cancelled', 11, TRUE),
  ('returned', 'Returned', 12, TRUE)
) AS v(code, label, sort_order, is_terminal)
WHERE NOT EXISTS (
  SELECT 1 FROM public.parcel_status ps
  WHERE ps.company_id IS NULL AND ps.code = v.code
);



-- ========== 20260312000011_bootstrap_and_demo_seed.sql ==========

-- =============================================================================
-- ParcelOS â€” Bootstrap helpers & demo company seed
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

-- Demo courier company (Swift Logistics) â€” branches only; link staff after auth signup
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
  ('a1111111-1111-1111-1111-111111111111'::UUID, 'LUS-CAI', 'Lusaka â€” Cairo Road', 'Lusaka', TRUE),
  ('a1111111-1111-1111-1111-111111111111'::UUID, 'LUS-KAB', 'Lusaka â€” Kabulonga', 'Lusaka', FALSE),
  ('a1111111-1111-1111-1111-111111111111'::UUID, 'NDO-BRD', 'Ndola â€” Broadway', 'Ndola', FALSE)
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


-- =============================================================================
-- ADDITIONS — branding, price chart, kill switch, public portal helpers
-- =============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS price_chart_url TEXT,
  ADD COLUMN IF NOT EXISTS support_phone TEXT,
  ADD COLUMN IF NOT EXISTS support_email CITEXT,
  ADD COLUMN IF NOT EXISTS tracking_domain TEXT;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS fee_confirmed_at_dropoff BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS require_destination BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS require_receiver BOOLEAN NOT NULL DEFAULT TRUE;

-- Price chart images (public read for customers)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'price-charts',
  'price-charts',
  TRUE,
  4194304,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS storage_price_charts_select ON storage.objects;
CREATE POLICY storage_price_charts_select ON storage.objects
  FOR SELECT USING (bucket_id = 'price-charts');

DROP POLICY IF EXISTS storage_price_charts_insert ON storage.objects;
CREATE POLICY storage_price_charts_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'price-charts'
    AND public.can_access_company(public.storage_company_id(name))
  );

DROP POLICY IF EXISTS storage_price_charts_update ON storage.objects;
CREATE POLICY storage_price_charts_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'price-charts'
    AND public.can_access_company(public.storage_company_id(name))
  );

-- Public company branding for portal (anon can read active brands only)
DROP POLICY IF EXISTS companies_public_portal ON public.companies;
CREATE POLICY companies_public_portal ON public.companies
  FOR SELECT TO anon, authenticated
  USING (
    soft_delete = FALSE
    AND status IN ('active', 'trial', 'past_due')
  );

DROP POLICY IF EXISTS company_settings_public_portal ON public.company_settings;
CREATE POLICY company_settings_public_portal ON public.company_settings
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_settings.company_id
        AND c.soft_delete = FALSE
        AND c.status IN ('active', 'trial', 'past_due')
    )
  );

DROP POLICY IF EXISTS branches_public_portal ON public.branches;
CREATE POLICY branches_public_portal ON public.branches
  FOR SELECT TO anon, authenticated
  USING (
    soft_delete = FALSE
    AND is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = branches.company_id
        AND c.soft_delete = FALSE
        AND c.status IN ('active', 'trial', 'past_due')
    )
  );

-- Resolve tenant by slug / subdomain / hostname (used by /c/{slug} and custom domains)
CREATE OR REPLACE FUNCTION public.resolve_company_public(p_key TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  code TEXT,
  tagline TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  hero_image_url TEXT,
  price_chart_url TEXT,
  support_phone TEXT,
  support_email CITEXT,
  subdomain TEXT,
  tracking_domain TEXT,
  currency_code CHAR(3),
  country_code CHAR(2),
  status company_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.name, c.slug, c.code, c.tagline, c.logo_url,
    c.primary_color, c.secondary_color, c.hero_image_url, c.price_chart_url,
    COALESCE(c.support_phone, c.phone) AS support_phone,
    COALESCE(c.support_email, c.email) AS support_email,
    c.subdomain, c.tracking_domain, c.currency_code, c.country_code, c.status
  FROM public.companies c
  WHERE c.soft_delete = FALSE
    AND (
      c.slug = lower(trim(p_key))
      OR c.subdomain = lower(trim(p_key))
      OR EXISTS (
        SELECT 1 FROM public.domains d
        WHERE d.company_id = c.id
          AND d.soft_delete = FALSE
          AND d.hostname = lower(trim(p_key))
      )
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_company_public(TEXT) TO anon, authenticated, service_role;

-- Kill switch (platform owner only)
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

  PERFORM public.write_audit_log(
    p_company_id,
    CASE
      WHEN p_status IN ('suspended', 'paused', 'disconnected') THEN 'suspend'::audit_action
      WHEN p_status = 'active' THEN 'reactivate'::audit_action
      ELSE 'update'::audit_action
    END,
    'company',
    p_company_id,
    COALESCE(p_reason, 'Lifecycle status set to ' || p_status::TEXT),
    jsonb_build_object('status', p_status::TEXT)
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_company_lifecycle(UUID, company_status, TEXT) TO authenticated;

-- True when company portal/workspace must be locked
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
      AND c.status IN ('paused', 'suspended', 'disconnected', 'expired')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_locked(UUID) TO anon, authenticated, service_role;

-- Guest / customer parcel registration (portal) when company is live
DROP POLICY IF EXISTS parcels_guest_insert ON public.parcels;
CREATE POLICY parcels_guest_insert ON public.parcels
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    NOT public.is_company_locked(company_id)
    AND EXISTS (
      SELECT 1 FROM public.companies c
      JOIN public.company_settings s ON s.company_id = c.id
      WHERE c.id = company_id
        AND c.soft_delete = FALSE
        AND c.status IN ('active', 'trial', 'past_due')
        AND s.allow_guest_registration = TRUE
    )
  );

-- Public track by tracking number (read-only)
CREATE OR REPLACE FUNCTION public.track_parcel_public(p_tracking TEXT)
RETURNS TABLE (
  tracking_number TEXT,
  status parcel_status_code,
  payment_status parcel_payment_status,
  sender_name TEXT,
  receiver_name TEXT,
  company_name TEXT,
  company_slug TEXT,
  origin_branch TEXT,
  destination_branch TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.tracking_number,
    p.status,
    p.payment_status,
    p.sender_name,
    p.receiver_name,
    c.name,
    c.slug,
    ob.name,
    db.name,
    p.updated_at
  FROM public.parcels p
  JOIN public.companies c ON c.id = p.company_id
  LEFT JOIN public.branches ob ON ob.id = p.origin_branch_id
  LEFT JOIN public.branches db ON db.id = p.destination_branch_id
  WHERE p.tracking_number = upper(trim(p_tracking))
    AND p.soft_delete = FALSE
    AND c.soft_delete = FALSE
    AND NOT public.is_company_locked(c.id)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.track_parcel_public(TEXT) TO anon, authenticated, service_role;

-- Update Swift demo branding fields if present
UPDATE public.companies
SET
  tagline = COALESCE(tagline, 'Fast. Reliable. Everywhere.'),
  support_phone = COALESCE(support_phone, phone),
  support_email = COALESCE(support_email, email),
  tracking_domain = COALESCE(tracking_domain, 'track.swiftlogistics.zm'),
  hero_image_url = COALESCE(hero_image_url, '/images/hero-courier-ops.jpg'),
  price_chart_url = COALESCE(price_chart_url, '/images/price-chart-sample.svg')
WHERE slug = 'swift-logistics';

-- =============================================================================
-- DONE. Next steps (run separately after creating Auth users):
--   SELECT public.bootstrap_platform_admin('YOUR_SUPER_ADMIN_EMAIL');
--   SELECT public.bootstrap_company_admin('COMPANY_ADMIN_EMAIL');
-- =============================================================================
