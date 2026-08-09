-- Platform owner payout details (MTN, Airtel, banks) + manual SaaS pay claims

CREATE TABLE IF NOT EXISTS public.platform_payment_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            TEXT NOT NULL CHECK (kind IN ('mobile_money', 'bank')),
  provider        TEXT NOT NULL,          -- mtn | airtel | zamtel | uba | access | stanbic | ...
  label           TEXT NOT NULL,          -- display name e.g. "MTN Mobile Money"
  account_name    TEXT NOT NULL,          -- registered name
  account_number  TEXT NOT NULL,          -- phone or bank account number
  bank_branch     TEXT,
  sort_code       TEXT,
  instructions    TEXT,                   -- e.g. "Send as Payment / Merchant"
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_payment_accounts_provider_number
  ON public.platform_payment_accounts (provider, account_number)
  WHERE soft_delete = FALSE;

ALTER TABLE public.platform_payment_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_payment_accounts_read ON public.platform_payment_accounts;
CREATE POLICY platform_payment_accounts_read ON public.platform_payment_accounts
  FOR SELECT TO authenticated
  USING (is_active = TRUE AND soft_delete = FALSE);

DROP POLICY IF EXISTS platform_payment_accounts_platform ON public.platform_payment_accounts;
CREATE POLICY platform_payment_accounts_platform ON public.platform_payment_accounts
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Seed placeholders only when empty (owner edits real numbers in Admin → Billing)
INSERT INTO public.platform_payment_accounts (kind, provider, label, account_name, account_number, instructions, sort_order)
SELECT * FROM (VALUES
  ('mobile_money'::TEXT, 'mtn'::TEXT, 'MTN Mobile Money'::TEXT, 'Mthunzi Tech Labs'::TEXT, '097XXXXXXX'::TEXT, 'Send money · put the payment reference in the message'::TEXT, 1),
  ('mobile_money', 'airtel', 'Airtel Money', 'Mthunzi Tech Labs', '096XXXXXXX', 'Send money · put the payment reference in the message', 2),
  ('mobile_money', 'zamtel', 'Zamtel Kwacha', 'Mthunzi Tech Labs', '095XXXXXXX', 'Send money · put the payment reference in the message', 3),
  ('bank', 'uba', 'UBA Bank Zambia', 'Mthunzi Tech Labs', '0000000000', 'Bank transfer · put the payment reference in the narration', 10),
  ('bank', 'access', 'Access Bank Zambia', 'Mthunzi Tech Labs', '0000000000', 'Bank transfer · put the payment reference in the narration', 11)
) AS v(kind, provider, label, account_name, account_number, instructions, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.platform_payment_accounts WHERE soft_delete = FALSE LIMIT 1);

ALTER TABLE public.saas_payment_intents
  ADD COLUMN IF NOT EXISTS payment_path TEXT DEFAULT 'genesys'
    CHECK (payment_path IN ('genesys', 'manual')),
  ADD COLUMN IF NOT EXISTS paid_via_account_id UUID REFERENCES public.platform_payment_accounts(id),
  ADD COLUMN IF NOT EXISTS payer_note TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Public read for company admins paying
CREATE OR REPLACE FUNCTION public.list_platform_payment_accounts()
RETURNS SETOF public.platform_payment_accounts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.platform_payment_accounts
  WHERE is_active = TRUE AND soft_delete = FALSE
  ORDER BY sort_order, label;
$$;

GRANT EXECUTE ON FUNCTION public.list_platform_payment_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_platform_payment_account(
  p_id UUID DEFAULT NULL,
  p_kind TEXT DEFAULT 'mobile_money',
  p_provider TEXT DEFAULT 'mtn',
  p_label TEXT DEFAULT '',
  p_account_name TEXT DEFAULT '',
  p_account_number TEXT DEFAULT '',
  p_bank_branch TEXT DEFAULT NULL,
  p_sort_code TEXT DEFAULT NULL,
  p_instructions TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_sort_order INT DEFAULT 0
)
RETURNS public.platform_payment_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.platform_payment_accounts;
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Platform owner access required';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.platform_payment_accounts
    SET
      kind = p_kind,
      provider = lower(trim(p_provider)),
      label = trim(p_label),
      account_name = trim(p_account_name),
      account_number = trim(p_account_number),
      bank_branch = nullif(trim(p_bank_branch), ''),
      sort_code = nullif(trim(p_sort_code), ''),
      instructions = nullif(trim(p_instructions), ''),
      is_active = p_is_active,
      sort_order = p_sort_order,
      updated_at = NOW(),
      soft_delete = FALSE
    WHERE id = p_id
    RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
    RETURN v_row;
  END IF;

  INSERT INTO public.platform_payment_accounts (
    kind, provider, label, account_name, account_number, bank_branch, sort_code, instructions, is_active, sort_order
  ) VALUES (
    p_kind, lower(trim(p_provider)), trim(p_label), trim(p_account_name), trim(p_account_number),
    nullif(trim(p_bank_branch), ''), nullif(trim(p_sort_code), ''), nullif(trim(p_instructions), ''),
    p_is_active, p_sort_order
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_platform_payment_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INT) TO authenticated;

-- Start manual payment: returns ref + amount + accounts to pay into
CREATE OR REPLACE FUNCTION public.create_manual_saas_payment(
  p_plan_code TEXT DEFAULT 'starter',
  p_account_id UUID DEFAULT NULL
)
RETURNS TABLE (
  intent_id UUID,
  tx_ref TEXT,
  amount_major NUMERIC,
  currency_code TEXT,
  plan_code TEXT,
  plan_name TEXT,
  company_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
  v_plan RECORD;
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

  SELECT * INTO v_plan FROM public.subscription_plans
  WHERE code = p_plan_code AND is_active AND NOT soft_delete LIMIT 1;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Unknown plan'; END IF;

  SELECT name INTO v_company_name FROM public.companies WHERE id = v_company;
  v_amount := ROUND(v_plan.price_cents::NUMERIC / 100.0, 2);
  v_ref := 'POS-' || upper(substr(replace(v_company::TEXT, '-', ''), 1, 6)) || '-' || to_char(NOW(), 'DDMM') || '-' || substr(md5(random()::TEXT), 1, 4);

  INSERT INTO public.saas_payment_intents (
    company_id, plan_id, tx_ref, amount_major, currency_code, status,
    payment_path, paid_via_account_id, channel, method, created_by
  ) VALUES (
    v_company, v_plan.id, v_ref, v_amount, coalesce(v_plan.currency_code, 'ZMW'), 'pending',
    'manual', p_account_id, 'manual', 'direct_transfer', v_uid
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_ref, v_amount, coalesce(v_plan.currency_code, 'ZMW')::TEXT,
    v_plan.code::TEXT, v_plan.name::TEXT, v_company_name::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_manual_saas_payment(TEXT, UUID) TO authenticated;

-- Tenant: I have paid (awaiting platform confirm)
CREATE OR REPLACE FUNCTION public.claim_manual_saas_payment(
  p_tx_ref TEXT,
  p_account_id UUID DEFAULT NULL,
  p_payer_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'No company'; END IF;

  UPDATE public.saas_payment_intents
  SET
    status = 'submitted',
    paid_via_account_id = coalesce(p_account_id, paid_via_account_id),
    payer_note = nullif(trim(p_payer_note), ''),
    claimed_at = NOW(),
    updated_at = NOW()
  WHERE tx_ref = p_tx_ref
    AND company_id = v_company
    AND payment_path = 'manual'
    AND status IN ('pending', 'submitted')
    AND soft_delete = FALSE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payment reference not found'; END IF;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_manual_saas_payment(TEXT, UUID, TEXT) TO authenticated;

-- Platform owner confirms MoMo/bank payment → activate
CREATE OR REPLACE FUNCTION public.confirm_manual_saas_payment(p_tx_ref TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Platform owner access required';
  END IF;

  UPDATE public.saas_payment_intents
  SET confirmed_by = auth.uid(), confirmed_at = NOW(), updated_at = NOW()
  WHERE tx_ref = p_tx_ref AND payment_path = 'manual' AND soft_delete = FALSE;

  RETURN public.activate_subscription_from_genesys(p_tx_ref, 'manual:' || p_tx_ref, jsonb_build_object('path', 'manual'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_manual_saas_payment(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_pending_manual_saas_payments()
RETURNS TABLE (
  id UUID,
  tx_ref TEXT,
  amount_major NUMERIC,
  currency_code TEXT,
  status TEXT,
  company_id UUID,
  company_name TEXT,
  plan_name TEXT,
  account_label TEXT,
  payer_note TEXT,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.tx_ref,
    i.amount_major,
    i.currency_code,
    i.status,
    i.company_id,
    c.name,
    p.name,
    a.label,
    i.payer_note,
    i.claimed_at,
    i.created_at
  FROM public.saas_payment_intents i
  JOIN public.companies c ON c.id = i.company_id
  JOIN public.subscription_plans p ON p.id = i.plan_id
  LEFT JOIN public.platform_payment_accounts a ON a.id = i.paid_via_account_id
  WHERE public.is_platform_owner()
    AND i.payment_path = 'manual'
    AND i.status IN ('pending', 'submitted')
    AND i.soft_delete = FALSE
  ORDER BY i.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_pending_manual_saas_payments() TO authenticated;
