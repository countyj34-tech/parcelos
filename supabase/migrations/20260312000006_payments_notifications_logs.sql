-- =============================================================================
-- ParcelOS — Payments, Notifications, Logs, Support
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
