-- Logo-pattern Super Admin (anon) can manage payout accounts + confirm manual MoMo/bank.
-- Same trust model as platform_console_* (pattern gate is client-side).

GRANT EXECUTE ON FUNCTION public.list_platform_payment_accounts() TO anon;

CREATE OR REPLACE FUNCTION public.platform_console_upsert_payment_account(
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
  IF p_kind NOT IN ('mobile_money', 'bank') THEN
    RAISE EXCEPTION 'Invalid account kind';
  END IF;
  IF nullif(trim(p_label), '') IS NULL
     OR nullif(trim(p_account_name), '') IS NULL
     OR nullif(trim(p_account_number), '') IS NULL THEN
    RAISE EXCEPTION 'Label, account name, and number are required';
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

CREATE OR REPLACE FUNCTION public.platform_console_list_pending_manual_payments()
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
  WHERE i.payment_path = 'manual'
    AND i.status IN ('pending', 'submitted')
    AND i.soft_delete = FALSE
  ORDER BY i.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.platform_console_confirm_manual_payment(p_tx_ref TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF nullif(trim(p_tx_ref), '') IS NULL THEN
    RAISE EXCEPTION 'Payment reference required';
  END IF;

  UPDATE public.saas_payment_intents
  SET
    confirmed_by = auth.uid(),
    confirmed_at = NOW(),
    updated_at = NOW()
  WHERE tx_ref = trim(p_tx_ref)
    AND payment_path = 'manual'
    AND soft_delete = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment reference not found';
  END IF;

  RETURN public.activate_subscription_from_genesys(
    trim(p_tx_ref),
    'manual:' || trim(p_tx_ref),
    jsonb_build_object('path', 'manual', 'via', 'platform_console')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_console_upsert_payment_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_console_list_pending_manual_payments() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_console_confirm_manual_payment(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.platform_console_upsert_payment_account IS
  'SaaS console — add/edit MoMo/bank payout accounts after logo pattern (no owner session).';
COMMENT ON FUNCTION public.platform_console_list_pending_manual_payments IS
  'SaaS console — pending manual SaaS payments for Money tab.';
COMMENT ON FUNCTION public.platform_console_confirm_manual_payment IS
  'SaaS console — confirm MoMo/bank payment and activate subscription.';
