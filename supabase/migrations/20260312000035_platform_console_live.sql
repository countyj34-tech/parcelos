-- Live SaaS console: real KPIs, lists, and actions for logo-pattern (anon) + authenticated.

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
        'currency_code', c.currency_code,
        'email', c.email,
        'phone', c.phone,
        'status', c.status::text,
        'subdomain', c.subdomain,
        'trial_ends_at', c.trial_ends_at,
        'created_at', c.created_at,
        'branches', (SELECT COUNT(*)::int FROM public.branches b WHERE b.company_id = c.id AND b.soft_delete = FALSE),
        'users', (SELECT COUNT(*)::int FROM public.staff st WHERE st.company_id = c.id AND st.soft_delete = FALSE),
        'parcels_today', (
          SELECT COUNT(*)::int FROM public.parcels p
          WHERE p.company_id = c.id AND p.soft_delete = FALSE AND p.created_at >= CURRENT_DATE
        ),
        'sms_used', (
          SELECT COUNT(*)::int FROM public.sms_logs s
          WHERE s.company_id = c.id AND s.soft_delete = FALSE
            AND s.created_at >= date_trunc('month', NOW())
        ),
        'storage_bytes', COALESCE((
          SELECT su.bytes_used FROM public.storage_usage su
          WHERE su.company_id = c.id AND su.soft_delete = FALSE
          ORDER BY su.recorded_at DESC LIMIT 1
        ), 0),
        'mrr_cents', COALESCE(sp.price_cents, 0),
        'auto_renew', COALESCE(s.auto_renew, TRUE),
        'outstanding_cents', 0,
        'subscriptions', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'status', sub.status::text,
                'subscription_plans', jsonb_build_object('name', pl.name)
              )
            )
            FROM public.subscriptions sub
            LEFT JOIN public.subscription_plans pl ON pl.id = sub.plan_id
            WHERE sub.company_id = c.id AND sub.soft_delete = FALSE
          ),
          '[]'::jsonb
        )
      ) AS row_data
    FROM public.companies c
    LEFT JOIN LATERAL (
      SELECT * FROM public.subscriptions sx
      WHERE sx.company_id = c.id AND sx.soft_delete = FALSE
      ORDER BY sx.created_at DESC
      LIMIT 1
    ) s ON TRUE
    LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE c.soft_delete = FALSE
  ) rows;
$$;

CREATE OR REPLACE FUNCTION public.platform_console_overview()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', NOW()) - INTERVAL '5 months',
      date_trunc('month', NOW()),
      INTERVAL '1 month'
    ) AS month_start
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*)::int FROM public.companies WHERE soft_delete = FALSE),
    'active', (SELECT COUNT(*)::int FROM public.companies WHERE soft_delete = FALSE AND status = 'active'),
    'trial', (SELECT COUNT(*)::int FROM public.companies WHERE soft_delete = FALSE AND status = 'trial'),
    'paused', (SELECT COUNT(*)::int FROM public.companies WHERE soft_delete = FALSE AND status = 'paused'),
    'suspended', (SELECT COUNT(*)::int FROM public.companies WHERE soft_delete = FALSE AND status = 'suspended'),
    'expired', (SELECT COUNT(*)::int FROM public.companies WHERE soft_delete = FALSE AND status = 'expired'),
    'todayParcels', (
      SELECT COUNT(*)::int FROM public.parcels
      WHERE soft_delete = FALSE AND created_at >= CURRENT_DATE
    ),
    'platformUsers', (
      SELECT COUNT(*)::int FROM public.staff WHERE soft_delete = FALSE AND is_active = TRUE
    ),
    'branches', (SELECT COUNT(*)::int FROM public.branches WHERE soft_delete = FALSE),
    'monthlyRevenue', COALESCE((
      SELECT ROUND(SUM(COALESCE(s.custom_price_cents, sp.price_cents, 0)) / 100.0)
      FROM public.subscriptions s
      JOIN public.subscription_plans sp ON sp.id = s.plan_id
      WHERE s.soft_delete = FALSE AND s.status IN ('active', 'trialing', 'past_due')
    ), 0),
    'smsUsedMonth', (
      SELECT COUNT(*)::int FROM public.sms_logs
      WHERE soft_delete = FALSE AND created_at >= date_trunc('month', NOW())
    ),
    'smsRemaining', GREATEST(0, (
      SELECT COALESCE(SUM(sp.max_sms_monthly), 0)::int
      FROM public.subscriptions s
      JOIN public.subscription_plans sp ON sp.id = s.plan_id
      WHERE s.soft_delete = FALSE AND s.status IN ('active', 'trialing')
    ) - (
      SELECT COUNT(*)::int FROM public.sms_logs
      WHERE soft_delete = FALSE AND created_at >= date_trunc('month', NOW())
    )),
    'storageBytes', COALESCE((SELECT SUM(bytes_used) FROM public.storage_usage WHERE soft_delete = FALSE), 0),
    'storageLimitGb', COALESCE((
      SELECT SUM(sp.max_storage_gb)::int
      FROM public.subscriptions s
      JOIN public.subscription_plans sp ON sp.id = s.plan_id
      WHERE s.soft_delete = FALSE AND s.status IN ('active', 'trialing')
    ), 0),
    'customerTotal', (SELECT COUNT(*)::int FROM public.customers WHERE soft_delete = FALSE),
    'charts', jsonb_build_object(
      'revenue', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'month', to_char(m.month_start, 'Mon'),
          'value', COALESCE((
            SELECT ROUND(SUM(amount_major))
            FROM public.saas_payment_intents i
            WHERE i.soft_delete = FALSE AND i.status = 'success'
              AND i.created_at >= m.month_start
              AND i.created_at < m.month_start + INTERVAL '1 month'
          ), 0)
        ) ORDER BY m.month_start), '[]'::jsonb)
        FROM months m
      ),
      'companyGrowth', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'month', to_char(m.month_start, 'Mon'),
          'value', (
            SELECT COUNT(*)::int FROM public.companies c
            WHERE c.soft_delete = FALSE AND c.created_at < m.month_start + INTERVAL '1 month'
          )
        ) ORDER BY m.month_start), '[]'::jsonb)
        FROM months m
      ),
      'parcels', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'month', to_char(m.month_start, 'Mon'),
          'value', (
            SELECT COUNT(*)::int FROM public.parcels p
            WHERE p.soft_delete = FALSE
              AND p.created_at >= m.month_start
              AND p.created_at < m.month_start + INTERVAL '1 month'
          )
        ) ORDER BY m.month_start), '[]'::jsonb)
        FROM months m
      ),
      'sms', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'month', to_char(m.month_start, 'Mon'),
          'value', (
            SELECT COUNT(*)::int FROM public.sms_logs s
            WHERE s.soft_delete = FALSE
              AND s.created_at >= m.month_start
              AND s.created_at < m.month_start + INTERVAL '1 month'
          )
        ) ORDER BY m.month_start), '[]'::jsonb)
        FROM months m
      )
    ),
    'activity', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'text', a.description,
        'when', to_char(a.created_at AT TIME ZONE 'Africa/Lusaka', 'DD Mon HH24:MI')
      ) ORDER BY a.created_at DESC)
      FROM (
        SELECT description, created_at FROM public.audit_logs
        WHERE soft_delete = FALSE
        ORDER BY created_at DESC
        LIMIT 12
      ) a
    ), '[]'::jsonb)
  );
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
  v_action audit_action;
BEGIN
  UPDATE public.companies
  SET
    status = p_status,
    paused_at = CASE WHEN p_status = 'paused' THEN NOW() ELSE paused_at END,
    suspended_at = CASE WHEN p_status = 'suspended' THEN NOW() ELSE suspended_at END,
    disconnected_at = CASE WHEN p_status = 'disconnected' THEN NOW() ELSE disconnected_at END,
    updated_at = NOW()
  WHERE id = p_company_id AND soft_delete = FALSE
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  v_action := CASE p_status
    WHEN 'suspended' THEN 'suspend'::audit_action
    WHEN 'active' THEN 'reactivate'::audit_action
    WHEN 'disconnected' THEN 'delete'::audit_action
    ELSE 'update'::audit_action
  END;

  INSERT INTO public.audit_logs (company_id, action, entity_type, entity_id, description)
  VALUES (
    p_company_id,
    v_action,
    'company',
    p_company_id,
    COALESCE(p_reason, 'Status set to ' || p_status::text || ' from SaaS console')
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_console_company_id(p_slug TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.companies
  WHERE slug = lower(trim(p_slug)) AND soft_delete = FALSE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.platform_console_bundle()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sp.id,
        'code', sp.code,
        'name', sp.name,
        'price', ROUND(sp.price_cents / 100.0),
        'currency', sp.currency_code,
        'branches', COALESCE(sp.max_branches, 0),
        'users', COALESCE(sp.max_users, 0),
        'storage', sp.max_storage_gb || ' GB',
        'sms', sp.max_sms_monthly,
        'features', COALESCE(sp.features, '[]'::jsonb),
        'active', sp.is_active,
        'companies', (
          SELECT COUNT(*)::int FROM public.subscriptions s
          WHERE s.plan_id = sp.id AND s.soft_delete = FALSE AND s.status IN ('active', 'trialing')
        ),
        'revenue', COALESCE((
          SELECT ROUND(SUM(COALESCE(s.custom_price_cents, sp.price_cents, 0)) / 100.0)
          FROM public.subscriptions s
          WHERE s.plan_id = sp.id AND s.soft_delete = FALSE AND s.status IN ('active', 'trialing')
        ), 0)
      ) ORDER BY sp.sort_order, sp.name)
      FROM public.subscription_plans sp
      WHERE sp.soft_delete = FALSE
    ), '[]'::jsonb),
    'customers', jsonb_build_object(
      'total', (SELECT COUNT(*)::int FROM public.customers WHERE soft_delete = FALSE),
      'activeMonth', (
        SELECT COUNT(DISTINCT sender_customer_id)::int FROM public.parcels
        WHERE soft_delete = FALSE AND created_at >= date_trunc('month', NOW()) AND sender_customer_id IS NOT NULL
      ),
      'new', (
        SELECT COUNT(*)::int FROM public.customers
        WHERE soft_delete = FALSE AND created_at >= date_trunc('month', NOW())
      )
    ),
    'platformUsers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', pu.full_name,
        'email', pu.email,
        'role', COALESCE(r.name, 'Platform'),
        'lastActive', COALESCE(to_char(pu.last_login_at AT TIME ZONE 'Africa/Lusaka', 'DD Mon HH24:MI'), '—'),
        'active', pu.is_active
      ) ORDER BY pu.full_name)
      FROM public.platform_users pu
      LEFT JOIN public.roles r ON r.id = pu.role_id
      WHERE pu.soft_delete = FALSE
    ), '[]'::jsonb),
    'domains', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'company', c.name,
        'hostname', d.hostname,
        'type', d.domain_type::text,
        'ssl', d.ssl_status::text,
        'verified', d.verified,
        'primary', d.is_primary
      ) ORDER BY c.name, d.is_primary DESC)
      FROM public.domains d
      JOIN public.companies c ON c.id = d.company_id
      WHERE d.soft_delete = FALSE AND c.soft_delete = FALSE
    ), '[]'::jsonb),
    'sms', jsonb_build_object(
      'usedMonth', (SELECT COUNT(*)::int FROM public.sms_logs WHERE soft_delete = FALSE AND created_at >= date_trunc('month', NOW())),
      'total', (SELECT COUNT(*)::int FROM public.sms_logs WHERE soft_delete = FALSE),
      'top', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', name, 'smsUsed', sms_used, 'parcelsToday', parcels_today))
        FROM (
          SELECT c.name,
            (SELECT COUNT(*)::int FROM public.sms_logs s WHERE s.company_id = c.id AND s.soft_delete = FALSE AND s.created_at >= date_trunc('month', NOW())) AS sms_used,
            (SELECT COUNT(*)::int FROM public.parcels p WHERE p.company_id = c.id AND p.soft_delete = FALSE AND p.created_at >= CURRENT_DATE) AS parcels_today
          FROM public.companies c
          WHERE c.soft_delete = FALSE
          ORDER BY 2 DESC
          LIMIT 8
        ) t
      ), '[]'::jsonb)
    ),
    'tickets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.ticket_number,
        'subject', t.subject,
        'company', c.name,
        'priority', initcap(t.priority::text),
        'status', initcap(replace(t.status::text, '_', ' ')),
        'age', CASE
          WHEN NOW() - t.created_at < INTERVAL '1 day' THEN EXTRACT(HOUR FROM NOW() - t.created_at)::int || ' h'
          ELSE EXTRACT(DAY FROM NOW() - t.created_at)::int || ' d'
        END,
        'type', t.ticket_type::text
      ) ORDER BY t.created_at DESC)
      FROM public.support_tickets t
      JOIN public.companies c ON c.id = t.company_id
      WHERE t.soft_delete = FALSE
      LIMIT 40
    ), '[]'::jsonb),
    'ticketStats', jsonb_build_object(
      'open', (SELECT COUNT(*)::int FROM public.support_tickets WHERE soft_delete = FALSE AND status IN ('open', 'in_progress')),
      'feature', (SELECT COUNT(*)::int FROM public.support_tickets WHERE soft_delete = FALSE AND ticket_type = 'feature_request'),
      'bug', (SELECT COUNT(*)::int FROM public.support_tickets WHERE soft_delete = FALSE AND ticket_type = 'bug_report'),
      'chat', (SELECT COUNT(*)::int FROM public.support_tickets WHERE soft_delete = FALSE AND ticket_type = 'live_chat' AND status IN ('open', 'in_progress'))
    ),
    'audit', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'action', a.action::text,
        'target', COALESCE(c.name, a.entity_type),
        'actor', COALESCE(a.actor_email, 'System'),
        'when', to_char(a.created_at AT TIME ZONE 'Africa/Lusaka', 'DD Mon YYYY HH24:MI'),
        'description', a.description
      ) ORDER BY a.created_at DESC)
      FROM (
        SELECT * FROM public.audit_logs WHERE soft_delete = FALSE ORDER BY created_at DESC LIMIT 50
      ) a
      LEFT JOIN public.companies c ON c.id = a.company_id
    ), '[]'::jsonb),
    'systemLogs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'level', upper(l.level::text),
        'msg', l.message,
        'when', to_char(l.created_at AT TIME ZONE 'Africa/Lusaka', 'HH24:MI:SS'),
        'source', l.source
      ) ORDER BY l.created_at DESC)
      FROM (
        SELECT * FROM public.system_logs WHERE soft_delete = FALSE ORDER BY created_at DESC LIMIT 40
      ) l
    ), '[]'::jsonb),
    'storage', jsonb_build_object(
      'bytes', COALESCE((SELECT SUM(bytes_used) FROM public.storage_usage WHERE soft_delete = FALSE), 0),
      'files', COALESCE((SELECT SUM(file_count) FROM public.storage_usage WHERE soft_delete = FALSE), 0),
      'companies', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', c.name,
          'bytes', COALESCE(su.bytes_used, 0),
          'images', COALESCE(su.images_bytes, 0),
          'documents', COALESCE(su.documents_bytes, 0)
        ) ORDER BY COALESCE(su.bytes_used, 0) DESC)
        FROM public.companies c
        LEFT JOIN LATERAL (
          SELECT * FROM public.storage_usage u
          WHERE u.company_id = c.id AND u.soft_delete = FALSE
          ORDER BY u.recorded_at DESC LIMIT 1
        ) su ON TRUE
        WHERE c.soft_delete = FALSE
      ), '[]'::jsonb)
    ),
    'flags', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', f.key,
        'label', f.label,
        'enabled', f.enabled
      ) ORDER BY f.label)
      FROM public.feature_flags f
      WHERE f.soft_delete = FALSE
    ), '[]'::jsonb),
    'saasPayments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'txRef', i.tx_ref,
        'amountMajor', i.amount_major,
        'amountPlatform', COALESCE(i.amount_platform, 0),
        'amountProvider', COALESCE(i.amount_provider, 0),
        'currencyCode', i.currency_code,
        'status', i.status,
        'paymentPath', COALESCE(i.payment_path, i.method, ''),
        'companyName', c.name,
        'planName', COALESCE(sp.name, '—'),
        'months', COALESCE(i.months, 1),
        'updatedAt', i.updated_at
      ) ORDER BY i.updated_at DESC)
      FROM (
        SELECT * FROM public.saas_payment_intents WHERE soft_delete = FALSE ORDER BY updated_at DESC LIMIT 40
      ) i
      JOIN public.companies c ON c.id = i.company_id
      LEFT JOIN public.subscription_plans sp ON sp.id = i.plan_id
    ), '[]'::jsonb),
    'parcelPayments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'company', c.name,
        'amountCents', p.amount_cents,
        'currency', p.currency_code,
        'method', p.method_type::text,
        'status', p.status,
        'paidAt', p.paid_at,
        'tracking', pr.tracking_number
      ) ORDER BY p.paid_at DESC)
      FROM (
        SELECT * FROM public.payments WHERE soft_delete = FALSE ORDER BY paid_at DESC LIMIT 30
      ) p
      JOIN public.companies c ON c.id = p.company_id
      LEFT JOIN public.parcels pr ON pr.id = p.parcel_id
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_console_set_flag(p_key TEXT, p_enabled BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.feature_flags
  SET enabled = p_enabled, updated_at = NOW()
  WHERE key = p_key AND soft_delete = FALSE;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_console_broadcast(p_title TEXT, p_body TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  INSERT INTO public.notifications (company_id, channel, title, body, status, sent_at, metadata)
  SELECT id, 'in_app', p_title, p_body, 'sent', NOW(), jsonb_build_object('kind', 'broadcast', 'source', 'saas_console')
  FROM public.companies
  WHERE soft_delete = FALSE AND status IN ('active', 'trial');

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.audit_logs (action, entity_type, description)
  VALUES ('broadcast', 'notification', 'Broadcast: ' || left(p_title, 120));

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_console_list_companies() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_console_overview() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_console_set_lifecycle(UUID, company_status, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_console_company_id(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_console_bundle() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_console_set_flag(TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_console_broadcast(TEXT, TEXT) TO anon, authenticated;
