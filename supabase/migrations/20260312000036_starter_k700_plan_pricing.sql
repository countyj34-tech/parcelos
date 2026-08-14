-- Starter = K700 / month (ZMW ngwee). Super admin can change prices via console RPC.

UPDATE public.subscription_plans
SET
  currency_code = 'ZMW',
  price_cents = CASE code
    WHEN 'starter' THEN 70000          -- K700 / month
    WHEN 'professional' THEN 150000    -- K1,500 / month
    WHEN 'enterprise' THEN 0           -- custom quote
    WHEN 'custom' THEN 0
    ELSE price_cents
  END,
  updated_at = NOW()
WHERE soft_delete = FALSE
  AND code IN ('starter', 'professional', 'enterprise', 'custom');

CREATE OR REPLACE FUNCTION public.platform_console_update_plan(
  p_code TEXT,
  p_price_major NUMERIC DEFAULT NULL,
  p_max_branches INT DEFAULT NULL,
  p_max_users INT DEFAULT NULL,
  p_max_storage_gb INT DEFAULT NULL,
  p_max_sms_monthly INT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.subscription_plans;
BEGIN
  UPDATE public.subscription_plans
  SET
    name = COALESCE(NULLIF(trim(p_name), ''), name),
    price_cents = CASE
      WHEN p_price_major IS NULL THEN price_cents
      ELSE GREATEST(0, ROUND(p_price_major * 100))::BIGINT
    END,
    max_branches = COALESCE(p_max_branches, max_branches),
    max_users = COALESCE(p_max_users, max_users),
    max_storage_gb = COALESCE(p_max_storage_gb, max_storage_gb),
    max_sms_monthly = COALESCE(p_max_sms_monthly, max_sms_monthly),
    is_active = COALESCE(p_is_active, is_active),
    currency_code = 'ZMW',
    updated_at = NOW()
  WHERE code = lower(trim(p_code)) AND soft_delete = FALSE
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Plan not found: %', p_code;
  END IF;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, description)
  VALUES (
    'upgrade',
    'subscription_plan',
    v_row.id,
    'Plan ' || v_row.code || ' updated to K' || ROUND(v_row.price_cents / 100.0)::text || '/mo from SaaS console'
  );

  RETURN jsonb_build_object(
    'id', v_row.id,
    'code', v_row.code,
    'name', v_row.name,
    'price', ROUND(v_row.price_cents / 100.0),
    'currency', v_row.currency_code,
    'branches', COALESCE(v_row.max_branches, 0),
    'users', COALESCE(v_row.max_users, 0),
    'storage', v_row.max_storage_gb || ' GB',
    'sms', v_row.max_sms_monthly,
    'active', v_row.is_active
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_console_update_plan(TEXT, NUMERIC, INT, INT, INT, INT, BOOLEAN, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.platform_console_update_plan IS
  'SaaS console — edit plan price (ZMW major units) and limits after logo pattern.';
