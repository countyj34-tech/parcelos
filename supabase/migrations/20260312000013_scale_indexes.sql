-- Scale indexes for multi-company parcel/payment lookups

CREATE INDEX IF NOT EXISTS idx_parcels_company_payment
  ON public.parcels (company_id, payment_status)
  WHERE soft_delete = FALSE;

CREATE INDEX IF NOT EXISTS idx_parcels_company_status_created
  ON public.parcels (company_id, status, created_at DESC)
  WHERE soft_delete = FALSE;

CREATE INDEX IF NOT EXISTS idx_parcels_company_sender_phone
  ON public.parcels (company_id, sender_phone)
  WHERE soft_delete = FALSE;

CREATE INDEX IF NOT EXISTS idx_payments_company_paid_at
  ON public.payments (company_id, paid_at DESC)
  WHERE soft_delete = FALSE;

CREATE INDEX IF NOT EXISTS idx_staff_company_active
  ON public.staff (company_id, is_active)
  WHERE soft_delete = FALSE;

CREATE INDEX IF NOT EXISTS idx_customers_company_created
  ON public.customers (company_id, created_at DESC)
  WHERE soft_delete = FALSE;
