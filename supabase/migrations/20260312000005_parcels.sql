-- =============================================================================
-- ParcelOS — Parcels, Tracking & Workflow
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
