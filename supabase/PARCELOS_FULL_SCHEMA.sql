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
