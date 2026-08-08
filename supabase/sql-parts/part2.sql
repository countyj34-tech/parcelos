  UNIQUE (company_id, name)
);

CREATE INDEX idx_parcel_categories_company ON public.parcel_categories(company_id);

-- Reference table defining workflow steps (global + company overrides)
CREATE TABLE public.parcel_status (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  code            parcel_status_code NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  is_terminal     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_parcel_status_company ON public.parcel_status(company_id);
CREATE UNIQUE INDEX uq_parcel_status_code ON public.parcel_status (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::UUID), code);

CREATE TABLE public.parcels (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tracking_number       TEXT NOT NULL,
  barcode               TEXT,
  qr_code_url           TEXT,
  sender_customer_id    UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  sender_name           TEXT NOT NULL,
  sender_phone          TEXT NOT NULL,
  sender_email          CITEXT,
  receiver_id           UUID REFERENCES public.receivers(id) ON DELETE SET NULL,
  receiver_name         TEXT NOT NULL,
  receiver_phone        TEXT NOT NULL,
  receiver_email        CITEXT,
  origin_branch_id      UUID NOT NULL REFERENCES public.branches(id),
  destination_branch_id UUID NOT NULL REFERENCES public.branches(id),
  current_branch_id     UUID REFERENCES public.branches(id),
  category_id           UUID REFERENCES public.parcel_categories(id) ON DELETE SET NULL,
  status                parcel_status_code NOT NULL DEFAULT 'waiting_for_dropoff',
  payment_status        parcel_payment_status NOT NULL DEFAULT 'unpaid',
  weight_kg             NUMERIC(10, 3),
  declared_value_cents  BIGINT DEFAULT 0,
  shipping_amount_cents BIGINT NOT NULL DEFAULT 0,
  currency_code         CHAR(3) NOT NULL,
  description           TEXT,
  label_printed_at      TIMESTAMPTZ,
  received_at           TIMESTAMPTZ,
  dispatched_at         TIMESTAMPTZ,
  ready_at              TIMESTAMPTZ,
  collected_at          TIMESTAMPTZ,
  proof_of_delivery_url TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES public.users(id),
  updated_by            UUID REFERENCES public.users(id),
  soft_delete           BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (company_id, tracking_number)
);

CREATE INDEX idx_parcels_company ON public.parcels(company_id);
CREATE INDEX idx_parcels_tracking ON public.parcels(tracking_number);
CREATE INDEX idx_parcels_status ON public.parcels(company_id, status);
CREATE INDEX idx_parcels_origin ON public.parcels(origin_branch_id);
CREATE INDEX idx_parcels_destination ON public.parcels(destination_branch_id);
CREATE INDEX idx_parcels_created ON public.parcels(company_id, created_at DESC);
CREATE INDEX idx_parcels_sender_phone ON public.parcels(company_id, sender_phone);
CREATE INDEX idx_parcels_receiver_phone ON public.parcels(company_id, receiver_phone);

-- Realtime-friendly tracking events (public tracking page)
CREATE TABLE public.parcel_tracking (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parcel_id       UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  status          parcel_status_code NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  branch_id       UUID REFERENCES public.branches(id),
  location_label  TEXT,
  latitude        NUMERIC(10, 7),
  longitude       NUMERIC(10, 7),
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_parcel_tracking_parcel ON public.parcel_tracking(parcel_id, occurred_at DESC);
CREATE INDEX idx_parcel_tracking_company ON public.parcel_tracking(company_id);

-- Immutable audit trail of status transitions
CREATE TABLE public.parcel_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parcel_id       UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  from_status     parcel_status_code,
  to_status       parcel_status_code NOT NULL,
  notes           TEXT,
  changed_by      UUID REFERENCES public.users(id),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_parcel_history_parcel ON public.parcel_history(parcel_id, changed_at DESC);
CREATE INDEX idx_parcel_history_company ON public.parcel_history(company_id);

CREATE TABLE public.parcel_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parcel_id       UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  note            TEXT NOT NULL,
  is_internal     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_parcel_notes_parcel ON public.parcel_notes(parcel_id);

CREATE TABLE public.driver_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parcel_id       UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  driver_id       UUID NOT NULL REFERENCES public.drivers(id),
  vehicle_id      UUID REFERENCES public.vehicles(id),
  status          driver_assignment_status NOT NULL DEFAULT 'assigned',
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_driver_assignments_parcel ON public.driver_assignments(parcel_id);
CREATE INDEX idx_driver_assignments_driver ON public.driver_assignments(driver_id);
CREATE INDEX idx_driver_assignments_company ON public.driver_assignments(company_id);

-- FK from shipping_rates to parcel_categories (deferred from prior migration)
ALTER TABLE public.shipping_rates
  ADD CONSTRAINT fk_shipping_rates_category
  FOREIGN KEY (category_id) REFERENCES public.parcel_categories(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Trigger: record parcel history + tracking on status change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_parcel_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.parcel_history (
      company_id, parcel_id, from_status, to_status, changed_by
    ) VALUES (
      NEW.company_id, NEW.id, OLD.status, NEW.status, NEW.updated_by
    );

    INSERT INTO public.parcel_tracking (
      company_id, parcel_id, status, title, branch_id, created_by, occurred_at
    ) VALUES (
      NEW.company_id,
      NEW.id,
      NEW.status,
      INITCAP(REPLACE(NEW.status::TEXT, '_', ' ')),
      NEW.current_branch_id,
      NEW.updated_by,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_parcels_status_history
  AFTER UPDATE OF status ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.record_parcel_status_change();

CREATE TRIGGER trg_parcel_categories_updated_at BEFORE UPDATE ON public.parcel_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_parcel_status_updated_at BEFORE UPDATE ON public.parcel_status
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_parcels_updated_at BEFORE UPDATE ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_parcel_notes_updated_at BEFORE UPDATE ON public.parcel_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_driver_assignments_updated_at BEFORE UPDATE ON public.driver_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- ========== 20260312000006_payments_notifications_logs.sql ==========

-- =============================================================================
-- ParcelOS â€” Payments, Notifications, Logs, Support
-- =============================================================================

CREATE TABLE public.payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parcel_id           UUID REFERENCES public.parcels(id) ON DELETE SET NULL,
  customer_id         UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  payment_method_id   UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  method_type         payment_method_type NOT NULL,
  amount_cents        BIGINT NOT NULL,
  currency_code       CHAR(3) NOT NULL,
  reference           TEXT,
  receipt_url         TEXT,
  status              TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'partial')),
  paid_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES public.users(id),
  updated_by          UUID REFERENCES public.users(id),
  soft_delete         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_payments_company ON public.payments(company_id);
CREATE INDEX idx_payments_parcel ON public.payments(parcel_id);
CREATE INDEX idx_payments_paid_at ON public.payments(company_id, paid_at DESC);

CREATE TABLE public.notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  channel         notification_channel NOT NULL DEFAULT 'in_app',
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  status          notification_status NOT NULL DEFAULT 'pending',
  read_at         TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_notifications_company ON public.notifications(company_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);

CREATE TABLE public.sms_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parcel_id       UUID REFERENCES public.parcels(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  message         TEXT NOT NULL,
  provider        TEXT,
  provider_ref    TEXT,
  status          notification_status NOT NULL DEFAULT 'pending',
  cost_cents      BIGINT DEFAULT 0,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_sms_logs_company ON public.sms_logs(company_id);
CREATE INDEX idx_sms_logs_sent ON public.sms_logs(company_id, sent_at DESC);

CREATE TABLE public.email_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  recipient_email CITEXT NOT NULL,
  subject         TEXT NOT NULL,
  template        TEXT,
  status          notification_status NOT NULL DEFAULT 'pending',
  provider_ref    TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_email_logs_company ON public.email_logs(company_id);

CREATE TABLE public.audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  actor_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_email     TEXT,
  action          audit_action NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID,
  description     TEXT NOT NULL,
  ip_address      INET,
  user_agent      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_audit_logs_company ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

CREATE TABLE public.system_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  level           log_level NOT NULL DEFAULT 'info',
  source          TEXT NOT NULL,
  message         TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_system_logs_level ON public.system_logs(level, created_at DESC);
CREATE INDEX idx_system_logs_company ON public.system_logs(company_id);

CREATE TABLE public.support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ticket_number   TEXT NOT NULL,
  ticket_type     ticket_type NOT NULL DEFAULT 'support',
  subject         TEXT NOT NULL,
  description     TEXT,
  status          ticket_status NOT NULL DEFAULT 'open',
  priority        ticket_priority NOT NULL DEFAULT 'medium',
  assigned_to     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reporter_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reporter_email  CITEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (company_id, ticket_number)
);

CREATE INDEX idx_support_tickets_company ON public.support_tickets(company_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_assigned ON public.support_tickets(assigned_to);

CREATE TABLE public.storage_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bucket          TEXT NOT NULL,
  file_count      BIGINT NOT NULL DEFAULT 0,
  bytes_used      BIGINT NOT NULL DEFAULT 0,
  images_bytes    BIGINT NOT NULL DEFAULT 0,
  documents_bytes BIGINT NOT NULL DEFAULT 0,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_storage_usage_company ON public.storage_usage(company_id, recorded_at DESC);

CREATE TABLE public.api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  key_prefix      TEXT NOT NULL,
  key_hash        TEXT NOT NULL,
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_api_keys_company ON public.api_keys(company_id);
CREATE INDEX idx_api_keys_prefix ON public.api_keys(key_prefix);

CREATE TABLE public.sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ip_address      INET,
  user_agent      TEXT,
  device_label    TEXT,
  login_as        BOOLEAN NOT NULL DEFAULT FALSE,
  impersonated_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_sessions_user ON public.sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_company ON public.sessions(company_id);

CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_storage_usage_updated_at BEFORE UPDATE ON public.storage_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_api_keys_updated_at BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- ========== 20260312000007_rls_helpers.sql ==========

-- =============================================================================
-- ParcelOS â€” RLS Helper Functions
-- Security-definer functions used by all Row Level Security policies.
-- =============================================================================

-- Returns TRUE when the authenticated user is an active platform owner (MTHUNZI).
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_users pu
    JOIN public.roles r ON r.id = pu.role_id
    WHERE pu.auth_user_id = auth.uid()
      AND pu.is_active = TRUE
      AND pu.soft_delete = FALSE
      AND r.code = 'platform_owner'
  );
$$;

-- Returns the company_id for the authenticated staff user.
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.company_id
  FROM public.users u
  WHERE u.id = auth.uid()
    AND u.is_active = TRUE
    AND u.soft_delete = FALSE
  LIMIT 1;
$$;

-- Returns role code for authenticated staff within their company.
CREATE OR REPLACE FUNCTION public.get_user_role_code()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.code
  FROM public.staff s
  JOIN public.roles r ON r.id = s.role_id
  WHERE s.user_id = auth.uid()
    AND s.is_active = TRUE
    AND s.soft_delete = FALSE
  LIMIT 1;
$$;

-- Branch IDs the user may access (all branches for company admin, assigned for branch roles).
CREATE OR REPLACE FUNCTION public.get_user_branch_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id
  FROM public.branches b
  JOIN public.staff s ON s.company_id = b.company_id
  JOIN public.roles r ON r.id = s.role_id
  WHERE s.user_id = auth.uid()
    AND s.is_active = TRUE
    AND s.soft_delete = FALSE
    AND b.soft_delete = FALSE
    AND (
      r.code IN ('company_admin', 'finance', 'customer_support', 'auditor', 'dispatcher')
      OR EXISTS (
        SELECT 1 FROM public.staff_branch_assignments sba
        WHERE sba.staff_id = s.id AND sba.branch_id = b.id
      )
    );
$$;

-- Customer record linked to auth user (customer portal).
CREATE OR REPLACE FUNCTION public.get_customer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.customers c
  WHERE c.user_id = auth.uid()
    AND c.soft_delete = FALSE
  LIMIT 1;
$$;

-- Driver record for authenticated user.
CREATE OR REPLACE FUNCTION public.get_driver_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id
  FROM public.drivers d
  JOIN public.staff s ON s.id = d.staff_id
  WHERE s.user_id = auth.uid()
    AND d.soft_delete = FALSE
    AND s.soft_delete = FALSE
  LIMIT 1;
$$;

-- Generic tenant isolation check.
CREATE OR REPLACE FUNCTION public.can_access_company(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_owner()
    OR public.get_user_company_id() = p_company_id;
$$;

-- Write audit log entry (callable from app / edge functions).
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_company_id UUID,
  p_action audit_action,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM public.users WHERE id = auth.uid();

  INSERT INTO public.audit_logs (
    company_id, actor_id, actor_email, action,
    entity_type, entity_id, description, metadata
  ) VALUES (
    p_company_id, auth.uid(), v_email, p_action,
    p_entity_type, p_entity_id, p_description, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.is_platform_owner IS 'Platform owner (MTHUNZI-TECH-LABS) bypasses tenant RLS.';
COMMENT ON FUNCTION public.get_user_company_id IS 'Returns tenant company_id for authenticated staff.';
COMMENT ON FUNCTION public.can_access_company IS 'TRUE if user is platform owner or belongs to company.';



-- ========== 20260312000008_rls_policies.sql ==========

-- =============================================================================
-- ParcelOS â€” Row Level Security Policies
-- Every tenant table is isolated by company_id. Platform owner bypasses RLS.
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_branch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Macro: tenant table policies (SELECT/INSERT/UPDATE for company isolation)
-- Platform owner gets full access via is_platform_owner()
-- ---------------------------------------------------------------------------

-- Companies
CREATE POLICY companies_platform_all ON public.companies
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

CREATE POLICY companies_staff_select ON public.companies
  FOR SELECT USING (id = public.get_user_company_id());

-- Users
CREATE POLICY users_self ON public.users
  FOR SELECT USING (id = auth.uid() OR public.is_platform_owner());

CREATE POLICY users_company_admin ON public.users
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() = 'company_admin'
  );

CREATE POLICY users_self_update ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY users_platform_all ON public.users
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Platform users â€” platform only
CREATE POLICY platform_users_all ON public.platform_users
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Reference data readable by authenticated users
CREATE POLICY roles_read ON public.roles FOR SELECT TO authenticated USING (soft_delete = FALSE);
CREATE POLICY permissions_read ON public.permissions FOR SELECT TO authenticated USING (soft_delete = FALSE);
CREATE POLICY role_permissions_read ON public.role_permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY subscription_plans_read ON public.subscription_plans FOR SELECT TO authenticated USING (is_active = TRUE AND soft_delete = FALSE);
CREATE POLICY feature_flags_read ON public.feature_flags FOR SELECT TO authenticated USING (soft_delete = FALSE);

CREATE POLICY subscription_plans_platform ON public.subscription_plans
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

CREATE POLICY feature_flags_platform ON public.feature_flags
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Helper to apply standard tenant policies
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'company_settings', 'subscriptions', 'company_feature_flags', 'domains',
    'branches', 'staff', 'staff_branch_assignments', 'customers', 'receivers',
    'vehicles', 'drivers', 'shipping_rates', 'payment_methods',
    'parcel_categories', 'parcel_status',
    'parcel_tracking', 'parcel_history', 'parcel_notes',
    'payments', 'sms_logs', 'support_tickets', 'storage_usage', 'api_keys'
  ]
