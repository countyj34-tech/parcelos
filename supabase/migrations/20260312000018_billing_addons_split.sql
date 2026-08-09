-- Powerful SaaS checkout: multi-month, SMS/WhatsApp add-ons, smart bill split

DROP FUNCTION IF EXISTS public.create_manual_saas_payment(TEXT, UUID);

CREATE TABLE IF NOT EXISTS public.billing_addons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  kind                TEXT NOT NULL CHECK (kind IN ('sms_pack', 'whatsapp', 'sms_bulk')),
  name                TEXT NOT NULL,
  description         TEXT,
  price_cents         BIGINT NOT NULL DEFAULT 0,          -- what customer pays (ngwee)
  provider_cost_cents BIGINT NOT NULL DEFAULT 0,          -- Africa's Talking / Twilio reserve
  sms_credits         INT NOT NULL DEFAULT 0,
  whatsapp_months     INT NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete         BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.billing_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_addons_read ON public.billing_addons;
CREATE POLICY billing_addons_read ON public.billing_addons
  FOR SELECT TO authenticated
  USING (is_active = TRUE AND soft_delete = FALSE);

DROP POLICY IF EXISTS billing_addons_platform ON public.billing_addons;
CREATE POLICY billing_addons_platform ON public.billing_addons
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Platform vs Africa's Talking split config (single row)
CREATE TABLE IF NOT EXISTS public.platform_billing_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at_sms_cost_cents       INT NOT NULL DEFAULT 12,   -- ~K0.12 AT cost per SMS (adjust)
  at_whatsapp_cost_cents  INT NOT NULL DEFAULT 25,   -- reserved per WA msg / month unit
  multi_month_discount    JSONB NOT NULL DEFAULT '{"1":1,"2":1,"3":0.97,"6":0.92,"12":0.85}'::JSONB,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_billing_config (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.platform_billing_config LIMIT 1);

ALTER TABLE public.platform_billing_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_billing_config_read ON public.platform_billing_config;
CREATE POLICY platform_billing_config_read ON public.platform_billing_config
  FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS platform_billing_config_platform ON public.platform_billing_config;
CREATE POLICY platform_billing_config_platform ON public.platform_billing_config
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Seed SMS / WhatsApp packs (ZMW ngwee). Provider cost = AT share; rest = platform.
INSERT INTO public.billing_addons (code, kind, name, description, price_cents, provider_cost_cents, sms_credits, whatsapp_months, sort_order)
VALUES
  ('sms_500', 'sms_pack', 'SMS · 500', '500 transactional SMS credits (Africa''s Talking)', 7500, 6000, 500, 0, 1),
  ('sms_2000', 'sms_bulk', 'SMS Bulk · 2,000', '2,000 SMS for campaigns & alerts', 25000, 20000, 2000, 0, 2),
  ('sms_10000', 'sms_bulk', 'SMS Bulk · 10,000', '10,000 SMS — high volume ops', 110000, 90000, 10000, 0, 3),
  ('wa_month', 'whatsapp', 'WhatsApp · 1 month', 'WhatsApp customer updates for one month', 14900, 5000, 0, 1, 10),
  ('wa_3month', 'whatsapp', 'WhatsApp · 3 months', 'WhatsApp updates for three months', 39900, 12000, 0, 3, 11)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  provider_cost_cents = EXCLUDED.provider_cost_cents,
  sms_credits = EXCLUDED.sms_credits,
  whatsapp_months = EXCLUDED.whatsapp_months,
  is_active = TRUE,
  soft_delete = FALSE,
  updated_at = NOW();

ALTER TABLE public.saas_payment_intents
  ADD COLUMN IF NOT EXISTS months INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS amount_platform NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_provider NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_name TEXT NOT NULL DEFAULT 'africas_talking',
  ADD COLUMN IF NOT EXISTS sms_credits INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_months INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.list_billing_addons()
RETURNS SETOF public.billing_addons
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.billing_addons
  WHERE is_active AND NOT soft_delete
  ORDER BY sort_order, name;
$$;

GRANT EXECUTE ON FUNCTION public.list_billing_addons() TO authenticated;

-- Quote: plan × months (with discount) + add-ons, split platform vs Africa's Talking
CREATE OR REPLACE FUNCTION public.quote_saas_checkout(
  p_plan_code TEXT DEFAULT 'starter',
  p_months INT DEFAULT 1,
  p_addon_codes TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE (
  plan_code TEXT,
  plan_name TEXT,
  months INT,
  plan_subtotal_cents BIGINT,
  addons_subtotal_cents BIGINT,
  total_cents BIGINT,
  amount_major NUMERIC,
  amount_platform_cents BIGINT,
  amount_provider_cents BIGINT,
  sms_credits INT,
  whatsapp_months INT,
  discount_factor NUMERIC,
  line_items JSONB,
  currency_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_cfg RECORD;
  v_months INT := GREATEST(1, LEAST(coalesce(p_months, 1), 24));
  v_factor NUMERIC := 1;
  v_plan_cents BIGINT := 0;
  v_addon_cents BIGINT := 0;
  v_plat BIGINT := 0;
  v_prov BIGINT := 0;
  v_sms INT := 0;
  v_wa INT := 0;
  v_lines JSONB := '[]'::JSONB;
  v_addon RECORD;
  v_code TEXT;
BEGIN
  SELECT * INTO v_plan FROM public.subscription_plans
  WHERE code = p_plan_code AND is_active AND NOT soft_delete LIMIT 1;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Unknown plan'; END IF;

  SELECT * INTO v_cfg FROM public.platform_billing_config LIMIT 1;
  IF v_cfg.id IS NOT NULL THEN
    v_factor := coalesce((v_cfg.multi_month_discount ->> v_months::TEXT)::NUMERIC, 1);
  END IF;

  v_plan_cents := ROUND(v_plan.price_cents * v_months * v_factor)::BIGINT;
  v_plat := v_plan_cents; -- subscription always to platform

  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'type', 'plan',
    'code', v_plan.code,
    'name', v_plan.name || ' × ' || v_months || ' mo',
    'months', v_months,
    'price_cents', v_plan_cents,
    'platform_cents', v_plan_cents,
    'provider_cents', 0
  ));

  IF p_addon_codes IS NOT NULL THEN
    FOREACH v_code IN ARRAY p_addon_codes LOOP
      SELECT * INTO v_addon FROM public.billing_addons
      WHERE code = v_code AND is_active AND NOT soft_delete LIMIT 1;
      IF v_addon.id IS NULL THEN CONTINUE; END IF;

      v_addon_cents := v_addon_cents + v_addon.price_cents;
      v_plat := v_plat + GREATEST(0, v_addon.price_cents - v_addon.provider_cost_cents);
      v_prov := v_prov + v_addon.provider_cost_cents;
      v_sms := v_sms + v_addon.sms_credits;
      v_wa := v_wa + v_addon.whatsapp_months;

      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'type', v_addon.kind,
        'code', v_addon.code,
        'name', v_addon.name,
        'price_cents', v_addon.price_cents,
        'platform_cents', GREATEST(0, v_addon.price_cents - v_addon.provider_cost_cents),
        'provider_cents', v_addon.provider_cost_cents,
        'provider', 'africas_talking',
        'sms_credits', v_addon.sms_credits,
        'whatsapp_months', v_addon.whatsapp_months
      ));
    END LOOP;
  END IF;

  RETURN QUERY SELECT
    v_plan.code::TEXT,
    v_plan.name::TEXT,
    v_months,
    v_plan_cents,
    v_addon_cents,
    (v_plan_cents + v_addon_cents),
    ROUND((v_plan_cents + v_addon_cents)::NUMERIC / 100.0, 2),
    v_plat,
    v_prov,
    v_sms,
    v_wa,
    v_factor,
    v_lines,
    coalesce(v_plan.currency_code, 'ZMW')::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.quote_saas_checkout(TEXT, INT, TEXT[]) TO authenticated;

-- Replace create_manual with months + addons
CREATE OR REPLACE FUNCTION public.create_manual_saas_payment(
  p_plan_code TEXT DEFAULT 'starter',
  p_account_id UUID DEFAULT NULL,
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
  company_name TEXT,
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
  v_company_name TEXT;
  v_ref TEXT;
  v_quote RECORD;
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
  SELECT name INTO v_company_name FROM public.companies WHERE id = v_company;

  v_ref := 'POS-' || upper(substr(replace(v_company::TEXT, '-', ''), 1, 6)) || '-' || to_char(NOW(), 'DDMM') || '-' || substr(md5(random()::TEXT), 1, 4);

  INSERT INTO public.saas_payment_intents (
    company_id, plan_id, tx_ref, amount_major, currency_code, status,
    payment_path, paid_via_account_id, channel, method, created_by,
    months, line_items, amount_platform, amount_provider, provider_name,
    sms_credits, whatsapp_months
  ) VALUES (
    v_company, v_plan.id, v_ref, v_quote.amount_major, v_quote.currency_code, 'pending',
    'manual', p_account_id, 'manual', 'direct_transfer', v_uid,
    v_quote.months, v_quote.line_items,
    ROUND(v_quote.amount_platform_cents::NUMERIC / 100.0, 2),
    ROUND(v_quote.amount_provider_cents::NUMERIC / 100.0, 2),
    'africas_talking',
    v_quote.sms_credits, v_quote.whatsapp_months
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT
    v_id, v_ref, v_quote.amount_major, v_quote.currency_code,
    v_quote.plan_code, v_quote.plan_name, v_company_name::TEXT,
    v_quote.months,
    ROUND(v_quote.amount_platform_cents::NUMERIC / 100.0, 2),
    ROUND(v_quote.amount_provider_cents::NUMERIC / 100.0, 2),
    v_quote.sms_credits, v_quote.whatsapp_months, v_quote.line_items;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_manual_saas_payment(TEXT, UUID, INT, TEXT[]) TO authenticated;

-- On activate: extend period by months, credit SMS, enable WhatsApp flags
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
  v_months INT := 1;
  v_period_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_intent
  FROM public.saas_payment_intents
  WHERE tx_ref = p_tx_ref AND soft_delete = FALSE
  FOR UPDATE;

  IF v_intent.id IS NULL THEN
    RAISE EXCEPTION 'Payment intent not found';
  END IF;

  IF v_intent.status = 'success' THEN
    RETURN TRUE;
  END IF;

  v_months := GREATEST(1, coalesce(v_intent.months, 1));
  v_period_end := NOW() + (v_months || ' months')::INTERVAL;

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
    updated_at = NOW(),
    metadata = coalesce(metadata, '{}'::JSONB) || jsonb_build_object(
      'sms_credits_added', coalesce(v_intent.sms_credits, 0),
      'whatsapp_months', coalesce(v_intent.whatsapp_months, 0),
      'amount_platform', v_intent.amount_platform,
      'amount_provider', v_intent.amount_provider,
      'provider', v_intent.provider_name
    )
  WHERE id = (
    SELECT id FROM public.subscriptions
    WHERE company_id = v_intent.company_id AND soft_delete = FALSE
    ORDER BY created_at DESC
    LIMIT 1
  );

  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (
      company_id, plan_id, status, current_period_start, current_period_end,
      genesys_tx_ref, genesys_transaction_id, last_paid_at, metadata
    ) VALUES (
      v_intent.company_id, v_intent.plan_id, 'active', NOW(), v_period_end,
      p_tx_ref, p_transaction_id, NOW(),
      jsonb_build_object(
        'sms_credits_added', coalesce(v_intent.sms_credits, 0),
        'whatsapp_months', coalesce(v_intent.whatsapp_months, 0)
      )
    );
  END IF;

  -- Apply messaging credits / WhatsApp enable on company_settings
  UPDATE public.company_settings
  SET
    sms_enabled = TRUE,
    whatsapp_enabled = CASE
      WHEN coalesce(v_intent.whatsapp_months, 0) > 0 THEN TRUE
      ELSE whatsapp_enabled
    END,
    updated_at = NOW()
  WHERE company_id = v_intent.company_id;

  -- Store prepaid SMS balance in settings metadata-style column if present; else company_settings via notify fields
  BEGIN
    UPDATE public.company_settings
    SET updated_at = NOW()
    WHERE company_id = v_intent.company_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.audit_logs (company_id, action, entity_type, entity_id, description, metadata)
  VALUES (
    v_intent.company_id, 'payment', 'subscription', v_intent.company_id,
    'Subscription activated: ' || p_tx_ref || ' · ' || v_months || ' mo',
    jsonb_build_object(
      'tx_ref', p_tx_ref,
      'months', v_months,
      'amount_platform', v_intent.amount_platform,
      'amount_africas_talking', v_intent.amount_provider,
      'sms_credits', v_intent.sms_credits,
      'whatsapp_months', v_intent.whatsapp_months,
      'line_items', v_intent.line_items
    )
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_subscription_from_genesys(TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_genesys(TEXT, TEXT, JSONB) TO authenticated;

-- Enrich pending list with split (must DROP first — return type changed)
DROP FUNCTION IF EXISTS public.list_pending_manual_saas_payments();

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
  created_at TIMESTAMPTZ,
  months INT,
  amount_platform NUMERIC,
  amount_provider NUMERIC,
  sms_credits INT,
  whatsapp_months INT,
  line_items JSONB
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
    i.created_at,
    i.months,
    i.amount_platform,
    i.amount_provider,
    i.sms_credits,
    i.whatsapp_months,
    i.line_items
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

-- Brand icons / colours for payment accounts (UI)
ALTER TABLE public.platform_payment_accounts
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS icon_key TEXT;

UPDATE public.platform_payment_accounts SET
  icon_key = provider,
  brand_color = CASE provider
    WHEN 'mtn' THEN '#FFCC00'
    WHEN 'airtel' THEN '#E60000'
    WHEN 'zamtel' THEN '#00A651'
    WHEN 'uba' THEN '#D21034'
    WHEN 'access' THEN '#003883'
    ELSE '#0F766E'
  END
WHERE brand_color IS NULL OR icon_key IS NULL;
