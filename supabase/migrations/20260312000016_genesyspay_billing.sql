-- GenesysPay SaaS billing (Zambia ZMW) — replaces Stripe as primary path

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS genesys_tx_ref TEXT,
  ADD COLUMN IF NOT EXISTS genesys_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.saas_payment_intents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id             UUID NOT NULL REFERENCES public.subscription_plans(id),
  tx_ref              TEXT NOT NULL UNIQUE,
  amount_major        NUMERIC(12, 2) NOT NULL,
  currency_code       CHAR(3) NOT NULL DEFAULT 'ZMW',
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'submitted', 'success', 'failed', 'cancelled')),
  channel             TEXT,
  method              TEXT,
  phone_number        TEXT,
  genesys_transaction_id TEXT,
  provider_payload    JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by          UUID REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_saas_payment_intents_company ON public.saas_payment_intents(company_id);
CREATE INDEX IF NOT EXISTS idx_saas_payment_intents_status ON public.saas_payment_intents(status);

ALTER TABLE public.saas_payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saas_payment_intents_tenant ON public.saas_payment_intents;
CREATE POLICY saas_payment_intents_tenant ON public.saas_payment_intents
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR public.is_platform_owner());

DROP POLICY IF EXISTS saas_payment_intents_platform ON public.saas_payment_intents;
CREATE POLICY saas_payment_intents_platform ON public.saas_payment_intents
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Zambia pricing in ngwee (1/100 ZMW). API amount = price_cents / 100.
UPDATE public.subscription_plans
SET
  currency_code = 'ZMW',
  price_cents = CASE code
    WHEN 'starter' THEN 49900          -- K499 / month
    WHEN 'professional' THEN 99900     -- K999 / month
    ELSE price_cents
  END,
  updated_at = NOW()
WHERE code IN ('starter', 'professional') AND soft_delete = FALSE;

-- Create pending intent + return checkout fields (edge fills Genesys keys)
CREATE OR REPLACE FUNCTION public.create_saas_payment_intent(p_plan_code TEXT DEFAULT 'starter')
RETURNS TABLE (
  intent_id UUID,
  tx_ref TEXT,
  amount_major NUMERIC,
  currency_code TEXT,
  plan_code TEXT,
  plan_name TEXT,
  company_id UUID,
  company_name TEXT,
  payer_email TEXT,
  payer_name TEXT,
  payer_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
  v_plan RECORD;
  v_user RECORD;
  v_company_name TEXT;
  v_ref TEXT;
  v_amount NUMERIC(12, 2);
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN RAISE EXCEPTION 'No company'; END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager', 'finance')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE code = p_plan_code AND is_active = TRUE AND soft_delete = FALSE
  LIMIT 1;

  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Unknown plan'; END IF;

  SELECT u.email, u.full_name, u.phone, c.name, c.phone AS company_phone
  INTO v_user
  FROM public.users u
  JOIN public.companies c ON c.id = v_company
  WHERE u.id = v_uid;

  v_company_name := v_user.name;
  v_amount := ROUND(v_plan.price_cents::NUMERIC / 100.0, 2);
  v_ref := 'POS-' || replace(v_company::TEXT, '-', '') || '-' || to_char(NOW(), 'YYMMDDHH24MISS') || '-' || substr(md5(random()::TEXT), 1, 6);

  INSERT INTO public.saas_payment_intents (
    company_id, plan_id, tx_ref, amount_major, currency_code, status, created_by
  ) VALUES (
    v_company, v_plan.id, v_ref, v_amount, coalesce(v_plan.currency_code, 'ZMW'), 'pending', v_uid
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT
    v_id,
    v_ref,
    v_amount,
    coalesce(v_plan.currency_code, 'ZMW')::TEXT,
    v_plan.code::TEXT,
    v_plan.name::TEXT,
    v_company,
    v_company_name::TEXT,
    v_user.email::TEXT,
    coalesce(v_user.full_name, v_company_name)::TEXT,
    coalesce(nullif(trim(v_user.phone), ''), nullif(trim(v_user.company_phone), ''))::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_saas_payment_intent(TEXT) TO authenticated;

-- Activate workspace after GenesysPay SUCCESS (service role / webhook)
CREATE OR REPLACE FUNCTION public.activate_subscription_from_genesys(
  p_tx_ref TEXT,
  p_transaction_id TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent public.saas_payment_intents%ROWTYPE;
  v_period_end TIMESTAMPTZ := NOW() + interval '30 days';
BEGIN
  SELECT * INTO v_intent
  FROM public.saas_payment_intents
  WHERE tx_ref = p_tx_ref AND soft_delete = FALSE
  FOR UPDATE;

  IF v_intent.id IS NULL THEN
    RAISE EXCEPTION 'Payment intent not found';
  END IF;

  IF v_intent.status = 'success' THEN
    RETURN TRUE; -- idempotent
  END IF;

  UPDATE public.saas_payment_intents
  SET
    status = 'success',
    genesys_transaction_id = coalesce(p_transaction_id, genesys_transaction_id),
    provider_payload = coalesce(p_payload, provider_payload),
    updated_at = NOW()
  WHERE id = v_intent.id;

  UPDATE public.companies
  SET status = 'active', updated_at = NOW()
  WHERE id = v_intent.company_id;

  UPDATE public.subscriptions
  SET
    plan_id = v_intent.plan_id,
    status = 'active',
    current_period_start = NOW(),
    current_period_end = v_period_end,
    genesys_tx_ref = p_tx_ref,
    genesys_transaction_id = p_transaction_id,
    last_paid_at = NOW(),
    updated_at = NOW()
  WHERE id = (
    SELECT id FROM public.subscriptions
    WHERE company_id = v_intent.company_id AND soft_delete = FALSE
    ORDER BY created_at DESC
    LIMIT 1
  );

  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (
      company_id, plan_id, status, current_period_start, current_period_end,
      genesys_tx_ref, genesys_transaction_id, last_paid_at
    ) VALUES (
      v_intent.company_id, v_intent.plan_id, 'active', NOW(), v_period_end,
      p_tx_ref, p_transaction_id, NOW()
    );
  END IF;

  INSERT INTO public.audit_logs (company_id, action, entity_type, entity_id, description)
  VALUES (
    v_intent.company_id, 'update', 'subscription', v_intent.company_id,
    'GenesysPay subscription activated: ' || p_tx_ref
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_subscription_from_genesys(TEXT, TEXT, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_saas_payment_failed(
  p_tx_ref TEXT,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.saas_payment_intents
  SET status = 'failed', provider_payload = coalesce(p_payload, provider_payload), updated_at = NOW()
  WHERE tx_ref = p_tx_ref AND status <> 'success' AND soft_delete = FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_saas_payment_failed(TEXT, JSONB) TO service_role;
