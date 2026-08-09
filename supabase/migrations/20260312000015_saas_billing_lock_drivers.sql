-- Commercial SaaS hardening: lock, billing columns, driver assign, messaging settings

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_sender_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS notify_on_receive BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_dispatch BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_ready BOOLEAN NOT NULL DEFAULT TRUE;

-- Lifecycle kill switch (platform)
CREATE OR REPLACE FUNCTION public.set_company_lifecycle(
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
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Platform owner access required';
  END IF;

  UPDATE public.companies
  SET
    status = p_status,
    paused_at = CASE WHEN p_status = 'paused' THEN NOW() ELSE paused_at END,
    suspended_at = CASE WHEN p_status = 'suspended' THEN NOW() ELSE suspended_at END,
    disconnected_at = CASE WHEN p_status = 'disconnected' THEN NOW() ELSE disconnected_at END,
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE id = p_company_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_company_lifecycle(UUID, company_status, TEXT) TO authenticated;

-- Lock when paused/suspended/disconnected/expired OR trial date passed
CREATE OR REPLACE FUNCTION public.is_company_locked(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = p_company_id
      AND c.soft_delete = FALSE
      AND (
        c.status IN ('paused', 'suspended', 'disconnected', 'expired')
        OR (
          c.status = 'trial'
          AND c.trial_ends_at IS NOT NULL
          AND c.trial_ends_at < now()
        )
        OR EXISTS (
          SELECT 1 FROM public.subscriptions s
          WHERE s.company_id = c.id
            AND s.soft_delete = FALSE
            AND s.status IN ('expired', 'cancelled')
            AND NOT EXISTS (
              SELECT 1 FROM public.subscriptions s2
              WHERE s2.company_id = c.id
                AND s2.soft_delete = FALSE
                AND s2.status IN ('active', 'trialing')
            )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_locked(UUID) TO anon, authenticated, service_role;

-- Expire due trials (call from cron / edge)
CREATE OR REPLACE FUNCTION public.expire_due_trials()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired', updated_at = now()
  WHERE status = 'trialing'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < now()
    AND soft_delete = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.companies c
  SET status = 'expired', updated_at = now()
  WHERE c.status = 'trial'
    AND c.trial_ends_at IS NOT NULL
    AND c.trial_ends_at < now()
    AND c.soft_delete = FALSE;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_due_trials() TO service_role;

CREATE OR REPLACE FUNCTION public.get_company_billing_state(p_company_id UUID DEFAULT NULL)
RETURNS TABLE (
  company_id UUID,
  company_status TEXT,
  trial_ends_at TIMESTAMPTZ,
  days_left INT,
  locked BOOLEAN,
  plan_code TEXT,
  plan_name TEXT,
  plan_price_cents INT,
  currency_code TEXT,
  subscription_status TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := coalesce(p_company_id, public.get_user_company_id());
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No company';
  END IF;
  IF auth.uid() IS NOT NULL
     AND NOT public.is_platform_owner()
     AND public.get_user_company_id() IS DISTINCT FROM v_company THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.status::TEXT,
    c.trial_ends_at,
    CASE
      WHEN c.trial_ends_at IS NULL THEN NULL
      ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.trial_ends_at - now())) / 86400.0)::INT)
    END,
    public.is_company_locked(c.id),
    p.code,
    p.name,
    p.price_cents,
    p.currency_code,
    s.status::TEXT,
    coalesce(s.stripe_customer_id, c.stripe_customer_id),
    s.stripe_subscription_id,
    s.current_period_end
  FROM public.companies c
  LEFT JOIN LATERAL (
    SELECT * FROM public.subscriptions sx
    WHERE sx.company_id = c.id AND sx.soft_delete = FALSE
    ORDER BY sx.created_at DESC
    LIMIT 1
  ) s ON TRUE
  LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
  WHERE c.id = v_company;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_billing_state(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_driver_to_parcels(
  p_parcel_ids UUID[],
  p_driver_id UUID,
  p_vehicle_id UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_uid UUID := auth.uid();
  v_id UUID;
  v_n INT := 0;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager', 'dispatcher')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = p_driver_id AND d.company_id = v_company AND d.soft_delete = FALSE
  ) THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;

  FOREACH v_id IN ARRAY p_parcel_ids LOOP
    INSERT INTO public.driver_assignments (
      company_id, parcel_id, driver_id, vehicle_id, assigned_at, created_by
    )
    VALUES (v_company, v_id, p_driver_id, p_vehicle_id, now(), v_uid);

    UPDATE public.parcels
    SET status = 'dispatched', updated_at = now()
    WHERE id = v_id AND company_id = v_company;

    INSERT INTO public.parcel_tracking (
      company_id, parcel_id, status, title, description, occurred_at, is_public
    ) VALUES (
      v_company, v_id, 'dispatched', 'Dispatched',
      'Assigned to driver and left origin branch.', now(), TRUE
    );

    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_driver_to_parcels(UUID[], UUID, UUID) TO authenticated;

-- List drivers for dispatch UI
CREATE OR REPLACE FUNCTION public.list_company_drivers()
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  available BOOLEAN,
  license_number TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    coalesce(u.full_name, u.email, 'Driver') AS name,
    coalesce(s.phone, u.phone) AS phone,
    d.is_available AS available,
    d.license_number
  FROM public.drivers d
  JOIN public.staff s ON s.id = d.staff_id
  JOIN public.users u ON u.id = s.user_id
  WHERE d.company_id = public.get_user_company_id()
    AND d.soft_delete = FALSE
  ORDER BY u.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.list_company_drivers() TO authenticated;

-- Promote staff member with driver role into drivers table
CREATE OR REPLACE FUNCTION public.ensure_driver_profile(p_staff_id UUID, p_license TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_driver UUID;
BEGIN
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager', 'dispatcher') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  INSERT INTO public.drivers (company_id, staff_id, license_number, is_available)
  SELECT v_company, p_staff_id, nullif(trim(p_license), ''), TRUE
  FROM public.staff s
  WHERE s.id = p_staff_id AND s.company_id = v_company AND s.soft_delete = FALSE
  ON CONFLICT (company_id, staff_id) DO UPDATE
    SET soft_delete = FALSE, is_available = TRUE, license_number = COALESCE(EXCLUDED.license_number, public.drivers.license_number)
  RETURNING id INTO v_driver;

  RETURN v_driver;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_driver_profile(UUID, TEXT) TO authenticated;
