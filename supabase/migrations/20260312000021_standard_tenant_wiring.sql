-- Standard multi-tenant wiring: brand columns, public portal, guest register, RLS harden

-- ---------------------------------------------------------------------------
-- Brand / portal columns (were only in FULL_SCHEMA paste, not migrations)
-- ---------------------------------------------------------------------------
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

-- Branding updates go through update_my_company_brand (SECURITY DEFINER), not broad table UPDATE
DROP POLICY IF EXISTS companies_staff_update ON public.companies;

-- ---------------------------------------------------------------------------
-- Price chart storage
-- ---------------------------------------------------------------------------
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

DROP POLICY IF EXISTS storage_price_charts_delete ON storage.objects;
CREATE POLICY storage_price_charts_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'price-charts'
    AND public.can_access_company(public.storage_company_id(name))
  );

-- Private bucket upserts
DROP POLICY IF EXISTS storage_tenant_update ON storage.objects;
CREATE POLICY storage_tenant_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('parcel-images', 'receipts', 'documents', 'proof-of-delivery')
    AND public.can_access_company(public.storage_company_id(name))
  )
  WITH CHECK (
    bucket_id IN ('parcel-images', 'receipts', 'documents', 'proof-of-delivery')
    AND public.can_access_company(public.storage_company_id(name))
  );

-- ---------------------------------------------------------------------------
-- Public portal read (anon + authenticated)
-- ---------------------------------------------------------------------------
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
    soft_delete = FALSE
    AND EXISTS (
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

-- Global reference catalogs visible to all staff
DROP POLICY IF EXISTS parcel_status_tenant_select ON public.parcel_status;
CREATE POLICY parcel_status_tenant_select ON public.parcel_status
  FOR SELECT TO authenticated
  USING (
    soft_delete = FALSE
    AND (
      company_id IS NULL
      OR company_id = public.get_user_company_id()
      OR public.is_platform_owner()
    )
  );

DROP POLICY IF EXISTS parcel_categories_tenant_select ON public.parcel_categories;
CREATE POLICY parcel_categories_tenant_select ON public.parcel_categories
  FOR SELECT TO authenticated
  USING (
    soft_delete = FALSE
    AND (
      company_id IS NULL
      OR company_id = public.get_user_company_id()
      OR public.is_platform_owner()
    )
  );

-- ---------------------------------------------------------------------------
-- Resolve company for /c/{slug} and custom domains
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Guest portal registration (single SECURITY DEFINER path)
-- ---------------------------------------------------------------------------
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
  p_currency_code CHAR(3) DEFAULT 'ZMW'
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
BEGIN
  IF public.is_company_locked(p_company_id) THEN
    RAISE EXCEPTION 'Company is not accepting registrations';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.companies c
    JOIN public.company_settings s ON s.company_id = c.id
    WHERE c.id = p_company_id
      AND c.soft_delete = FALSE
      AND c.status IN ('active', 'trial', 'past_due')
      AND s.allow_guest_registration = TRUE
      AND s.soft_delete = FALSE
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

  SELECT tracking_prefix INTO v_prefix
  FROM public.company_settings
  WHERE company_id = p_company_id
  LIMIT 1;

  v_tracking := upper(coalesce(nullif(trim(v_prefix), ''), 'POS'))
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
  END IF;

  INSERT INTO public.parcels (
    company_id, tracking_number, customer_id,
    sender_name, sender_phone, sender_email,
    receiver_name, receiver_phone,
    origin_branch_id, destination_branch_id, current_branch_id,
    status, payment_status, shipping_amount_cents, currency_code,
    description, declared_value_cents, category_id, weight_kg, metadata
  ) VALUES (
    p_company_id, v_tracking, v_customer_id,
    trim(p_sender_name), trim(p_sender_phone), nullif(trim(coalesce(p_sender_email, '')), ''),
    trim(p_receiver_name), trim(p_receiver_phone),
    p_origin_branch_id, p_destination_branch_id, p_origin_branch_id,
    'waiting_for_dropoff', 'unpaid', 0, coalesce(p_currency_code, 'ZMW'),
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
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, INT, UUID, NUMERIC, CHAR
) TO anon, authenticated, service_role;

-- Keep permissive guest insert as backup for older clients
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

DROP POLICY IF EXISTS customers_guest_insert ON public.customers;
CREATE POLICY customers_guest_insert ON public.customers
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    is_guest = TRUE
    AND NOT public.is_company_locked(company_id)
    AND EXISTS (
      SELECT 1 FROM public.companies c
      JOIN public.company_settings s ON s.company_id = c.id
      WHERE c.id = company_id
        AND c.soft_delete = FALSE
        AND c.status IN ('active', 'trial', 'past_due')
        AND s.allow_guest_registration = TRUE
    )
  );

DROP POLICY IF EXISTS parcel_tracking_guest_insert ON public.parcel_tracking;
CREATE POLICY parcel_tracking_guest_insert ON public.parcel_tracking
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    is_public = TRUE
    AND NOT public.is_company_locked(company_id)
    AND EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = parcel_id
        AND p.company_id = company_id
        AND p.soft_delete = FALSE
    )
  );

-- ---------------------------------------------------------------------------
-- Role-gated writes for sensitive tenant tables
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS staff_tenant_insert ON public.staff;
DROP POLICY IF EXISTS staff_tenant_update ON public.staff;
-- Staff writes go through invite/provision RPCs (SECURITY DEFINER)

DROP POLICY IF EXISTS subscriptions_tenant_insert ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_tenant_update ON public.subscriptions;
-- Subscription mutations via billing RPCs / platform only

DROP POLICY IF EXISTS api_keys_tenant_insert ON public.api_keys;
DROP POLICY IF EXISTS api_keys_tenant_update ON public.api_keys;
CREATE POLICY api_keys_admin_write ON public.api_keys
  FOR ALL TO authenticated
  USING (
    public.is_platform_owner()
    OR (
      company_id = public.get_user_company_id()
      AND public.get_user_role_code() = 'company_admin'
    )
  )
  WITH CHECK (
    public.is_platform_owner()
    OR (
      company_id = public.get_user_company_id()
      AND public.get_user_role_code() = 'company_admin'
    )
  );

DROP POLICY IF EXISTS domains_tenant_insert ON public.domains;
DROP POLICY IF EXISTS domains_tenant_update ON public.domains;
CREATE POLICY domains_admin_write ON public.domains
  FOR ALL TO authenticated
  USING (
    public.is_platform_owner()
    OR (
      company_id = public.get_user_company_id()
      AND public.get_user_role_code() = 'company_admin'
    )
  )
  WITH CHECK (
    public.is_platform_owner()
    OR (
      company_id = public.get_user_company_id()
      AND public.get_user_role_code() = 'company_admin'
    )
  );

DROP POLICY IF EXISTS company_settings_tenant_insert ON public.company_settings;
DROP POLICY IF EXISTS company_settings_tenant_update ON public.company_settings;
CREATE POLICY company_settings_admin_write ON public.company_settings
  FOR ALL TO authenticated
  USING (
    public.is_platform_owner()
    OR (
      company_id = public.get_user_company_id()
      AND public.get_user_role_code() IN ('company_admin', 'branch_manager')
    )
  )
  WITH CHECK (
    public.is_platform_owner()
    OR (
      company_id = public.get_user_company_id()
      AND public.get_user_role_code() IN ('company_admin', 'branch_manager')
    )
  );

-- Parcel writes: ops roles only (not drivers rewriting arbitrary parcels)
DROP POLICY IF EXISTS parcels_tenant_insert ON public.parcels;
DROP POLICY IF EXISTS parcels_tenant_update ON public.parcels;

CREATE POLICY parcels_ops_insert ON public.parcels
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() IN (
      'company_admin', 'branch_manager', 'receptionist', 'dispatcher', 'finance'
    )
  );

CREATE POLICY parcels_ops_update ON public.parcels
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() IN (
      'company_admin', 'branch_manager', 'receptionist', 'dispatcher', 'finance'
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() IN (
      'company_admin', 'branch_manager', 'receptionist', 'dispatcher', 'finance'
    )
  );

CREATE POLICY parcels_driver_update_assigned ON public.parcels
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() = 'driver'
    AND EXISTS (
      SELECT 1
      FROM public.driver_assignments da
      JOIN public.drivers d ON d.id = da.driver_id
      JOIN public.staff s ON s.id = d.staff_id
      WHERE da.parcel_id = parcels.id
        AND da.soft_delete = FALSE
        AND s.user_id = auth.uid()
        AND da.status IN ('assigned', 'accepted', 'in_transit', 'picked_up')
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() = 'driver'
  );

-- Demo brand defaults
UPDATE public.companies
SET
  tagline = COALESCE(tagline, 'Fast. Reliable. Everywhere.'),
  support_phone = COALESCE(support_phone, phone),
  support_email = COALESCE(support_email, email),
  tracking_domain = COALESCE(tracking_domain, 'track.swiftlogistics.zm'),
  hero_image_url = COALESCE(hero_image_url, '/images/hero-courier-ops.jpg'),
  price_chart_url = COALESCE(price_chart_url, '/images/price-chart-sample.svg')
WHERE slug = 'swift-logistics';
