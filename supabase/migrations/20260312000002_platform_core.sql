-- =============================================================================
-- ParcelOS — Platform Core (roles, permissions, companies, users)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Roles & permissions (global reference data)
-- ---------------------------------------------------------------------------
CREATE TABLE public.roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  scope         TEXT NOT NULL DEFAULT 'company'
    CHECK (scope IN ('platform', 'company', 'branch', 'customer', 'guest')),
  is_system     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE public.permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  module        TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE public.role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON public.role_permissions(role_id);

-- ---------------------------------------------------------------------------
-- Platform owner staff (MTHUNZI-TECH-LABS — bypasses tenant RLS)
-- ---------------------------------------------------------------------------
CREATE TABLE public.platform_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email         CITEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role_id       UUID NOT NULL REFERENCES public.roles(id),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID,
  updated_by    UUID,
  soft_delete   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_platform_users_auth ON public.platform_users(auth_user_id);

-- ---------------------------------------------------------------------------
-- Courier companies (tenants)
-- ---------------------------------------------------------------------------
CREATE TABLE public.companies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  code                TEXT NOT NULL UNIQUE,
  slug                TEXT NOT NULL UNIQUE,
  registration_number TEXT,
  country_code        CHAR(2) NOT NULL,
  currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
  phone               TEXT,
  email               CITEXT,
  website             TEXT,
  logo_url            TEXT,
  primary_color       TEXT DEFAULT '#0F766E',
  secondary_color     TEXT DEFAULT '#F59E0B',
  favicon_url         TEXT,
  subdomain           TEXT NOT NULL UNIQUE,
  default_language    TEXT NOT NULL DEFAULT 'en',
  timezone            TEXT NOT NULL DEFAULT 'Africa/Lusaka',
  status              company_status NOT NULL DEFAULT 'trial',
  trial_ends_at       TIMESTAMPTZ,
  suspended_at        TIMESTAMPTZ,
  paused_at           TIMESTAMPTZ,
  disconnected_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  updated_by          UUID,
  soft_delete         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_companies_status ON public.companies(status) WHERE soft_delete = FALSE;
CREATE INDEX idx_companies_country ON public.companies(country_code);
CREATE INDEX idx_companies_slug ON public.companies(slug);

-- ---------------------------------------------------------------------------
-- Company settings (1:1)
-- ---------------------------------------------------------------------------
CREATE TABLE public.company_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  tracking_prefix         TEXT NOT NULL DEFAULT 'POS',
  auto_sms_notifications  BOOLEAN NOT NULL DEFAULT TRUE,
  require_payment_at_reception BOOLEAN NOT NULL DEFAULT TRUE,
  allow_guest_registration BOOLEAN NOT NULL DEFAULT TRUE,
  allow_customer_accounts BOOLEAN NOT NULL DEFAULT TRUE,
  receipt_footer          TEXT,
  terms_url               TEXT,
  privacy_url             TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by              UUID,
  updated_by              UUID,
  soft_delete             BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_company_settings_company ON public.company_settings(company_id);

-- ---------------------------------------------------------------------------
-- Application users (extends Supabase auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           CITEXT NOT NULL,
  full_name       TEXT,
  phone           TEXT,
  avatar_url      TEXT,
  user_type       user_type NOT NULL DEFAULT 'staff',
  company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_users_company ON public.users(company_id) WHERE soft_delete = FALSE;
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_type ON public.users(user_type);

-- ---------------------------------------------------------------------------
-- Feature flags (global + per-company overrides via company_feature_flags)
-- ---------------------------------------------------------------------------
CREATE TABLE public.feature_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  label         TEXT NOT NULL,
  description   TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE public.company_feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  feature_flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  enabled         BOOLEAN NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (company_id, feature_flag_id)
);

CREATE INDEX idx_company_feature_flags_company ON public.company_feature_flags(company_id);

-- ---------------------------------------------------------------------------
-- Domains
-- ---------------------------------------------------------------------------
CREATE TABLE public.domains (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  domain_type     domain_type NOT NULL DEFAULT 'subdomain',
  hostname        TEXT NOT NULL UNIQUE,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  ssl_status      ssl_status NOT NULL DEFAULT 'pending',
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_domains_company ON public.domains(company_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_permissions_updated_at BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_platform_users_updated_at BEFORE UPDATE ON public.platform_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_company_settings_updated_at BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_feature_flags_updated_at BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_company_feature_flags_updated_at BEFORE UPDATE ON public.company_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_domains_updated_at BEFORE UPDATE ON public.domains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create public.users row when auth.users is created
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
