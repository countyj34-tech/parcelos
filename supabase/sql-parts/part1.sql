-- =============================================================================
-- ParcelOS FULL SCHEMA — paste into Supabase Dashboard → SQL Editor → Run
-- Owner: Mthunzi-Tech-Labs  |  Multi-tenant courier SaaS
-- 
-- BEFORE RUNNING:
-- 1. Create your Super Admin in Authentication → Users (e.g. admin@mthunzi.tech)
-- 2. After this script succeeds, run ONLY this (replace email):
--      SELECT public.bootstrap_platform_admin('admin@mthunzi.tech');
-- 3. Optional company admin for Swift demo:
--      SELECT public.bootstrap_company_admin('admin@swiftlogistics.zm');
--
-- Safe to re-run? NO — run once on a fresh project. If types already exist, use a new project
-- or drop conflicting objects first.
-- =============================================================================



-- ========== 20260312000001_extensions_and_enums.sql ==========

-- =============================================================================
-- ParcelOS â€” Extensions & Enumerated Types
-- MTHUNZI-TECH-LABS Â· Multi-tenant courier SaaS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------------------------------------------------------------------------
-- Company lifecycle
-- ---------------------------------------------------------------------------
CREATE TYPE company_status AS ENUM (
  'active',
  'trial',
  'expired',
  'suspended',
  'paused',
  'disconnected',
  'past_due'
);

-- ---------------------------------------------------------------------------
-- Subscription billing
-- ---------------------------------------------------------------------------
CREATE TYPE subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'expired',
  'paused'
);

CREATE TYPE billing_interval AS ENUM ('monthly', 'quarterly', 'yearly', 'custom');

-- ---------------------------------------------------------------------------
-- Parcel workflow (canonical status progression)
-- ---------------------------------------------------------------------------
CREATE TYPE parcel_status_code AS ENUM (
  'waiting_for_dropoff',
  'reception_verification',
  'awaiting_payment',
  'label_printed',
  'received',
  'dispatched',
  'in_transit',
  'at_destination_branch',
  'ready_for_collection',
  'collected',
  'cancelled',
  'returned'
);

CREATE TYPE parcel_payment_status AS ENUM (
  'unpaid',
  'paid',
  'cash_on_collection',
  'refunded',
  'partial'
);

CREATE TYPE payment_method_type AS ENUM (
  'cash',
  'card',
  'bank_transfer',
  'mobile_money'
);

CREATE TYPE notification_channel AS ENUM ('in_app', 'sms', 'email', 'whatsapp', 'push');

CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'read');

CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');

CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE ticket_type AS ENUM ('support', 'feature_request', 'bug_report', 'live_chat');

CREATE TYPE domain_type AS ENUM ('subdomain', 'custom');

CREATE TYPE ssl_status AS ENUM ('pending', 'active', 'expired', 'failed');

CREATE TYPE driver_assignment_status AS ENUM (
  'assigned',
  'accepted',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE user_type AS ENUM (
  'platform',
  'staff',
  'customer',
  'guest'
);

CREATE TYPE audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'password_reset',
  'suspend',
  'reactivate',
  'upgrade',
  'downgrade',
  'login_as',
  'payment',
  'broadcast'
);

CREATE TYPE log_level AS ENUM ('debug', 'info', 'warn', 'error', 'fatal');

-- ---------------------------------------------------------------------------
-- Reusable trigger: maintain updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at IS
  'Automatically sets updated_at to current timestamp on row update.';



-- ========== 20260312000002_platform_core.sql ==========

-- =============================================================================
-- ParcelOS â€” Platform Core (roles, permissions, companies, users)
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
-- Platform owner staff (MTHUNZI-TECH-LABS â€” bypasses tenant RLS)
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



-- ========== 20260312000003_subscriptions.sql ==========

-- =============================================================================
-- ParcelOS â€” Subscriptions & Plans
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



-- ========== 20260312000004_company_operations.sql ==========

-- =============================================================================
-- ParcelOS â€” Branches, Staff, Customers, Operations
-- =============================================================================

CREATE TABLE public.branches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT NOT NULL,
  region          TEXT,
  country_code    CHAR(2) NOT NULL,
  phone           TEXT,
  email           CITEXT,
  latitude        NUMERIC(10, 7),
  longitude       NUMERIC(10, 7),
  is_head_office  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (company_id, code)
);

CREATE INDEX idx_branches_company ON public.branches(company_id);
CREATE INDEX idx_branches_city ON public.branches(company_id, city);

CREATE TABLE public.staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES public.roles(id),
  employee_code   TEXT,
  phone           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  hired_at        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (company_id, user_id)
);

CREATE INDEX idx_staff_company ON public.staff(company_id);
CREATE INDEX idx_staff_user ON public.staff(user_id);
CREATE INDEX idx_staff_role ON public.staff(role_id);

-- Branch assignments for branch-scoped roles (managers, receptionists, etc.)
CREATE TABLE public.staff_branch_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  UNIQUE (staff_id, branch_id)
);

CREATE INDEX idx_staff_branch_company ON public.staff_branch_assignments(company_id);
CREATE INDEX idx_staff_branch_branch ON public.staff_branch_assignments(branch_id);

CREATE TABLE public.customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  customer_code   TEXT,
  full_name       TEXT NOT NULL,
  email           CITEXT,
  phone           TEXT NOT NULL,
  id_number       TEXT,
  address         TEXT,
  city            TEXT,
  country_code    CHAR(2),
  is_guest        BOOLEAN NOT NULL DEFAULT FALSE,
  loyalty_points  INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_customers_company ON public.customers(company_id);
CREATE INDEX idx_customers_phone ON public.customers(company_id, phone);
CREATE INDEX idx_customers_user ON public.customers(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE public.receivers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  full_name       TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           CITEXT,
  address         TEXT,
  city            TEXT,
  branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  is_saved        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_receivers_company ON public.receivers(company_id);
CREATE INDEX idx_receivers_customer ON public.receivers(customer_id);

CREATE TABLE public.vehicles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  registration_no TEXT NOT NULL,
  make            TEXT,
  model           TEXT,
  capacity_kg     NUMERIC(10, 2),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (company_id, registration_no)
);

CREATE INDEX idx_vehicles_company ON public.vehicles(company_id);

CREATE TABLE public.drivers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  license_number  TEXT,
  license_expiry  DATE,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (company_id, staff_id)
);

CREATE INDEX idx_drivers_company ON public.drivers(company_id);
CREATE INDEX idx_drivers_staff ON public.drivers(staff_id);

CREATE TABLE public.shipping_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  origin_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  destination_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  category_id     UUID,
  base_price_cents BIGINT NOT NULL DEFAULT 0,
  price_per_kg_cents BIGINT NOT NULL DEFAULT 0,
  min_weight_kg   NUMERIC(10, 3) DEFAULT 0,
  max_weight_kg   NUMERIC(10, 3),
  currency_code   CHAR(3) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_shipping_rates_company ON public.shipping_rates(company_id);

CREATE TABLE public.payment_methods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  method_type     payment_method_type NOT NULL,
  name            TEXT NOT NULL,
  config          JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_payment_methods_company ON public.payment_methods(company_id);

CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_staff_updated_at BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_receivers_updated_at BEFORE UPDATE ON public.receivers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_drivers_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_shipping_rates_updated_at BEFORE UPDATE ON public.shipping_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- ========== 20260312000005_parcels.sql ==========

-- =============================================================================
-- ParcelOS â€” Parcels, Tracking & Workflow
-- =============================================================================

CREATE TABLE public.parcel_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  is_fragile      BOOLEAN NOT NULL DEFAULT FALSE,
  is_perishable   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE,
