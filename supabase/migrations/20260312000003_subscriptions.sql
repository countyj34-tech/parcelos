-- =============================================================================
-- ParcelOS — Subscriptions & Plans
-- =============================================================================

CREATE TABLE public.subscription_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT,
  price_cents       BIGINT NOT NULL DEFAULT 0,
  currency_code     CHAR(3) NOT NULL DEFAULT 'USD',
  billing_interval  billing_interval NOT NULL DEFAULT 'monthly',
  max_branches      INT,
  max_users         INT,
  max_storage_gb    INT NOT NULL DEFAULT 10,
  max_sms_monthly   INT NOT NULL DEFAULT 1000,
  features          JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE public.subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id             UUID NOT NULL REFERENCES public.subscription_plans(id),
  status              subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at       TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end  TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at        TIMESTAMPTZ,
  auto_renew          BOOLEAN NOT NULL DEFAULT TRUE,
  custom_price_cents  BIGINT,
  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES public.users(id),
  updated_by          UUID REFERENCES public.users(id),
  soft_delete         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_subscriptions_company ON public.subscriptions(company_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON public.subscriptions(current_period_end);

-- Only one active subscription per company
CREATE UNIQUE INDEX uq_subscriptions_active_company
  ON public.subscriptions(company_id)
  WHERE status IN ('trialing', 'active', 'past_due') AND soft_delete = FALSE;

CREATE TRIGGER trg_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
