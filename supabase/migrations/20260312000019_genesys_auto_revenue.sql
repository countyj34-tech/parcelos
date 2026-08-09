-- GenesysPay auto checkout (months + addons) + live SaaS revenue for super admin

-- Genesys intent with quote (months + SMS/WA) — DROP old 1-arg version
DROP FUNCTION IF EXISTS public.create_saas_payment_intent(TEXT);

CREATE OR REPLACE FUNCTION public.create_saas_payment_intent(
  p_plan_code TEXT DEFAULT 'starter',
  p_months INT DEFAULT 1,
  p_addon_codes TEXT[] DEFAULT ARRAY[]::TEXT[]
)
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
  payer_phone TEXT,
  months INT,
  amount_platform NUMERIC,
  amount_provider NUMERIC,
  sms_credits INT,
  whatsapp_months INT,
  line_items JSONB
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
  v_quote RECORD;
  v_ref TEXT;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN RAISE EXCEPTION 'No company'; END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager', 'finance')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO v_quote FROM public.quote_saas_checkout(p_plan_code, p_months, p_addon_codes) LIMIT 1;
  SELECT * INTO v_plan FROM public.subscription_plans WHERE code = v_quote.plan_code LIMIT 1;

  SELECT u.email, u.full_name, u.phone, c.name, c.phone AS company_phone
  INTO v_user
  FROM public.users u
  JOIN public.companies c ON c.id = v_company
  WHERE u.id = v_uid;

  v_ref := 'POS-' || upper(substr(replace(v_company::TEXT, '-', ''), 1, 6)) || '-' || to_char(NOW(), 'DDMMHH24MI') || '-' || substr(md5(random()::TEXT), 1, 4);

  INSERT INTO public.saas_payment_intents (
    company_id, plan_id, tx_ref, amount_major, currency_code, status,
    payment_path, channel, created_by,
    months, line_items, amount_platform, amount_provider, provider_name,
    sms_credits, whatsapp_months
  ) VALUES (
    v_company, v_plan.id, v_ref, v_quote.amount_major, v_quote.currency_code, 'pending',
    'genesys', 'mobile_money', v_uid,
    v_quote.months, v_quote.line_items,
    ROUND(v_quote.amount_platform_cents::NUMERIC / 100.0, 2),
    ROUND(v_quote.amount_provider_cents::NUMERIC / 100.0, 2),
    'africas_talking',
    v_quote.sms_credits, v_quote.whatsapp_months
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT
    v_id,
    v_ref,
    v_quote.amount_major,
    v_quote.currency_code,
    v_quote.plan_code,
    v_quote.plan_name,
    v_company,
    v_user.name::TEXT,
    v_user.email::TEXT,
    coalesce(v_user.full_name, v_user.name)::TEXT,
    coalesce(nullif(trim(v_user.phone), ''), nullif(trim(v_user.company_phone), ''))::TEXT,
    v_quote.months,
    ROUND(v_quote.amount_platform_cents::NUMERIC / 100.0, 2),
    ROUND(v_quote.amount_provider_cents::NUMERIC / 100.0, 2),
    v_quote.sms_credits,
    v_quote.whatsapp_months,
    v_quote.line_items;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_saas_payment_intent(TEXT, INT, TEXT[]) TO authenticated;

-- Live SaaS revenue for super admin
CREATE OR REPLACE FUNCTION public.get_saas_revenue_dashboard()
RETURNS TABLE (
  revenue_today NUMERIC,
  revenue_month NUMERIC,
  revenue_all_time NUMERIC,
  platform_today NUMERIC,
  platform_month NUMERIC,
  platform_all_time NUMERIC,
  provider_month NUMERIC,
  success_count_month BIGINT,
  pending_manual_count BIGINT,
  active_paid_companies BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce((
      SELECT SUM(amount_major) FROM public.saas_payment_intents
      WHERE status = 'success' AND soft_delete = FALSE
        AND updated_at >= date_trunc('day', NOW())
    ), 0),
    coalesce((
      SELECT SUM(amount_major) FROM public.saas_payment_intents
      WHERE status = 'success' AND soft_delete = FALSE
        AND updated_at >= date_trunc('month', NOW())
    ), 0),
    coalesce((
      SELECT SUM(amount_major) FROM public.saas_payment_intents
      WHERE status = 'success' AND soft_delete = FALSE
    ), 0),
    coalesce((
      SELECT SUM(amount_platform) FROM public.saas_payment_intents
      WHERE status = 'success' AND soft_delete = FALSE
        AND updated_at >= date_trunc('day', NOW())
    ), 0),
    coalesce((
      SELECT SUM(amount_platform) FROM public.saas_payment_intents
      WHERE status = 'success' AND soft_delete = FALSE
        AND updated_at >= date_trunc('month', NOW())
    ), 0),
    coalesce((
      SELECT SUM(amount_platform) FROM public.saas_payment_intents
      WHERE status = 'success' AND soft_delete = FALSE
    ), 0),
    coalesce((
      SELECT SUM(amount_provider) FROM public.saas_payment_intents
      WHERE status = 'success' AND soft_delete = FALSE
        AND updated_at >= date_trunc('month', NOW())
    ), 0),
    (
      SELECT COUNT(*) FROM public.saas_payment_intents
      WHERE status = 'success' AND soft_delete = FALSE
        AND updated_at >= date_trunc('month', NOW())
    ),
    (
      SELECT COUNT(*) FROM public.saas_payment_intents
      WHERE payment_path = 'manual' AND status IN ('pending', 'submitted') AND soft_delete = FALSE
    ),
    (
      SELECT COUNT(DISTINCT company_id) FROM public.subscriptions
      WHERE status = 'active' AND soft_delete = FALSE
        AND current_period_end > NOW()
    )
  WHERE public.is_platform_owner();
$$;

GRANT EXECUTE ON FUNCTION public.get_saas_revenue_dashboard() TO authenticated;

DROP FUNCTION IF EXISTS public.list_recent_saas_payments();

CREATE OR REPLACE FUNCTION public.list_recent_saas_payments(p_limit INT DEFAULT 40)
RETURNS TABLE (
  id UUID,
  tx_ref TEXT,
  amount_major NUMERIC,
  amount_platform NUMERIC,
  amount_provider NUMERIC,
  currency_code TEXT,
  status TEXT,
  payment_path TEXT,
  company_name TEXT,
  plan_name TEXT,
  months INT,
  method TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
    i.amount_platform,
    i.amount_provider,
    i.currency_code,
    i.status,
    i.payment_path,
    c.name,
    p.name,
    i.months,
    i.method,
    i.created_at,
    i.updated_at
  FROM public.saas_payment_intents i
  JOIN public.companies c ON c.id = i.company_id
  JOIN public.subscription_plans p ON p.id = i.plan_id
  WHERE public.is_platform_owner()
    AND i.soft_delete = FALSE
  ORDER BY i.updated_at DESC
  LIMIT GREATEST(1, LEAST(coalesce(p_limit, 40), 100));
$$;

GRANT EXECUTE ON FUNCTION public.list_recent_saas_payments(INT) TO authenticated;
