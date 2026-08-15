-- Dispatch drivers can be field riders (name + phone) without a staff login.
-- Reception / dispatch can add them and assign parcels.

ALTER TABLE public.drivers
  ALTER COLUMN staff_id DROP NOT NULL;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

DROP FUNCTION IF EXISTS public.list_company_drivers();

CREATE OR REPLACE FUNCTION public.list_company_drivers()
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  available BOOLEAN,
  license_number TEXT,
  staff_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    coalesce(nullif(trim(u.full_name), ''), nullif(trim(d.full_name), ''), u.email, 'Driver') AS name,
    coalesce(nullif(trim(d.phone), ''), s.phone, u.phone) AS phone,
    d.is_available AS available,
    d.license_number,
    d.staff_id
  FROM public.drivers d
  LEFT JOIN public.staff s ON s.id = d.staff_id AND s.soft_delete = FALSE
  LEFT JOIN public.users u ON u.id = s.user_id
  WHERE d.company_id = public.get_user_company_id()
    AND d.soft_delete = FALSE
  ORDER BY 2;
$$;

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
  IF v_company IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager', 'dispatcher', 'receptionist')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = p_staff_id AND s.company_id = v_company AND s.soft_delete = FALSE
  ) THEN
    RAISE EXCEPTION 'Staff member not found';
  END IF;

  SELECT d.id INTO v_driver
  FROM public.drivers d
  WHERE d.company_id = v_company AND d.staff_id = p_staff_id
  LIMIT 1;

  IF v_driver IS NOT NULL THEN
    UPDATE public.drivers
    SET
      soft_delete = FALSE,
      is_available = TRUE,
      license_number = COALESCE(nullif(trim(p_license), ''), license_number),
      updated_at = NOW()
    WHERE id = v_driver;
    RETURN v_driver;
  END IF;

  INSERT INTO public.drivers (company_id, staff_id, license_number, is_available)
  VALUES (v_company, p_staff_id, nullif(trim(p_license), ''), TRUE)
  RETURNING id INTO v_driver;

  RETURN v_driver;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_dispatch_driver(
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_license TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_name TEXT := nullif(trim(p_name), '');
  v_phone TEXT := nullif(trim(p_phone), '');
  v_driver UUID;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager', 'dispatcher', 'receptionist')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Driver name is required'; END IF;

  IF v_phone IS NOT NULL THEN
    SELECT d.id INTO v_driver
    FROM public.drivers d
    WHERE d.company_id = v_company
      AND d.soft_delete = FALSE
      AND d.phone IS NOT NULL
      AND regexp_replace(d.phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
    LIMIT 1;

    IF v_driver IS NOT NULL THEN
      UPDATE public.drivers
      SET full_name = v_name, is_available = TRUE, license_number = COALESCE(nullif(trim(p_license), ''), license_number), updated_at = NOW()
      WHERE id = v_driver;
      RETURN v_driver;
    END IF;
  END IF;

  INSERT INTO public.drivers (company_id, staff_id, full_name, phone, license_number, is_available)
  VALUES (v_company, NULL, v_name, v_phone, nullif(trim(p_license), ''), TRUE)
  RETURNING id INTO v_driver;

  RETURN v_driver;
END;
$$;

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
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager', 'dispatcher', 'receptionist')
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

GRANT EXECUTE ON FUNCTION public.list_company_drivers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_driver_profile(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_dispatch_driver(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_driver_to_parcels(UUID[], UUID, UUID) TO authenticated;
