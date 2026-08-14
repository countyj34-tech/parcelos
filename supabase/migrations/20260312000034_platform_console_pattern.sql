-- SaaS Super Admin console (logo pattern on client).
-- Lets the platform dashboard load real company/billing data without a separate login screen.
-- Client still gates /admin behind the pattern; these RPCs power live reads/actions for that console.

CREATE OR REPLACE FUNCTION public.platform_console_list_companies()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(row_data ORDER BY created_at DESC),
    '[]'::jsonb
  )
  FROM (
    SELECT
      c.created_at,
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'code', c.code,
        'slug', c.slug,
        'country_code', c.country_code,
        'status', c.status::text,
        'subdomain', c.subdomain,
        'trial_ends_at', c.trial_ends_at,
        'created_at', c.created_at,
        'subscriptions', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'status', s.status::text,
                'subscription_plans', jsonb_build_object('name', sp.name)
              )
            )
            FROM public.subscriptions s
            LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
            WHERE s.company_id = c.id AND s.soft_delete = FALSE
          ),
          '[]'::jsonb
        )
      ) AS row_data
    FROM public.companies c
    WHERE c.soft_delete = FALSE
  ) rows;
$$;

CREATE OR REPLACE FUNCTION public.platform_console_overview()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*)::int,
    'active', COUNT(*) FILTER (WHERE status = 'active')::int,
    'trial', COUNT(*) FILTER (WHERE status = 'trial')::int,
    'paused', COUNT(*) FILTER (WHERE status = 'paused')::int,
    'suspended', COUNT(*) FILTER (WHERE status = 'suspended')::int,
    'expired', COUNT(*) FILTER (WHERE status = 'expired')::int
  )
  FROM public.companies
  WHERE soft_delete = FALSE;
$$;

CREATE OR REPLACE FUNCTION public.platform_console_set_lifecycle(
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
  UPDATE public.companies
  SET
    status = p_status,
    updated_at = NOW()
  WHERE id = p_company_id AND soft_delete = FALSE
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  INSERT INTO public.audit_logs (company_id, action, entity_type, entity_id, description)
  VALUES (
    p_company_id,
    'lifecycle',
    'company',
    p_company_id,
    COALESCE(p_reason, 'Status set to ' || p_status::text || ' from SaaS console')
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_console_list_companies() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_console_overview() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_console_set_lifecycle(UUID, company_status, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.platform_console_list_companies IS
  'SaaS console company list — used after client logo pattern unlock.';
COMMENT ON FUNCTION public.platform_console_overview IS
  'SaaS console KPI counts — used after client logo pattern unlock.';
COMMENT ON FUNCTION public.platform_console_set_lifecycle IS
  'SaaS console pause/suspend/reactivate — used after client logo pattern unlock.';
