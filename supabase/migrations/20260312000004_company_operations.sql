-- =============================================================================
-- ParcelOS — Branches, Staff, Customers, Operations
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
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE,
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
