-- Live GPS tracking, branch CRUD, super-admin company delete.
-- Run this in the Supabase SQL Editor after 000041.

CREATE TABLE IF NOT EXISTS public.zm_city_coords (
  city      TEXT PRIMARY KEY,
  latitude  NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL
);

INSERT INTO public.zm_city_coords (city, latitude, longitude) VALUES
  ('Lusaka', -15.3875260, 28.3228170),
  ('Ndola', -12.9586860, 28.6365890),
  ('Kitwe', -12.8024310, 28.2132340),
  ('Livingstone', -17.8419300, 25.8543700),
  ('Chipata', -13.6332800, 32.6452100),
  ('Kabwe', -14.4469000, 28.4464400),
  ('Chingola', -12.5289800, 27.8613900),
  ('Mufulira', -12.5498200, 28.2407100),
  ('Luanshya', -13.1366700, 28.4166700),
  ('Solwezi', -12.1689600, 26.3895200),
  ('Kasama', -10.2128900, 31.1808100),
  ('Mongu', -15.2483600, 23.1274100),
  ('Choma', -16.8088900, 26.9531100),
  ('Mazabuka', -15.8560100, 27.7480100),
  ('Kapiri Mposhi', -13.9776900, 28.6697400),
  ('Mansa', -11.1995600, 28.8943100),
  ('Kasumbalesa', -12.2770000, 27.8110000),
  ('Chililabombwe', -12.3646700, 27.8228600),
  ('Kalulushi', -12.8415100, 28.0949500)
ON CONFLICT (city) DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

ALTER TABLE public.zm_city_coords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS zm_city_coords_read ON public.zm_city_coords;
CREATE POLICY zm_city_coords_read ON public.zm_city_coords
  FOR SELECT TO anon, authenticated USING (TRUE);

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS last_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS last_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.dispatch_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id        UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id       UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_lat         NUMERIC(10, 7),
  last_lng         NUMERIC(10, 7),
  last_accuracy_m  NUMERIC(10, 2),
  last_reported_at TIMESTAMPTZ,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_runs_company_active
  ON public.dispatch_runs(company_id) WHERE is_active = TRUE;

ALTER TABLE public.dispatch_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispatch_runs_tenant ON public.dispatch_runs;
CREATE POLICY dispatch_runs_tenant ON public.dispatch_runs
  FOR ALL
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS dispatch_runs_platform ON public.dispatch_runs;
CREATE POLICY dispatch_runs_platform ON public.dispatch_runs
  FOR ALL
  USING (public.is_platform_owner())
  WITH CHECK (public.is_platform_owner());

CREATE OR REPLACE FUNCTION public.geo_distance_m(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
    ELSE 6371000 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_zm_city_coords(p_city TEXT)
RETURNS TABLE (latitude NUMERIC, longitude NUMERIC)
LANGUAGE sql
STABLE
AS $$
  SELECT c.latitude, c.longitude
  FROM public.zm_city_coords c
  WHERE p_city IS NOT NULL
    AND (
      lower(c.city) = lower(trim(p_city))
      OR lower(trim(p_city)) LIKE '%' || lower(c.city) || '%'
    )
  ORDER BY CASE WHEN lower(c.city) = lower(trim(p_city)) THEN 0 ELSE 1 END, length(c.city)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.staff_update_parcel_status(
  p_parcel_id UUID,
  p_status parcel_status_code,
  p_note TEXT DEFAULT NULL,
  p_location_label TEXT DEFAULT NULL
)
RETURNS TABLE (
  parcel_id UUID,
  tracking TEXT,
  status TEXT,
  receiver_phone TEXT,
  sender_phone TEXT,
  company_id UUID,
  title TEXT,
  notify_event TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_uid UUID := auth.uid();
  v_role TEXT := public.get_user_role_code();
  v_from parcel_status_code;
  v_title TEXT;
  v_desc TEXT;
  v_notify TEXT;
  v_row public.parcels;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_role NOT IN ('company_admin', 'branch_manager', 'dispatcher', 'receptionist', 'customer_support', 'finance')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO v_row
  FROM public.parcels p
  WHERE p.id = p_parcel_id AND p.company_id = v_company AND p.soft_delete = FALSE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Parcel not found';
  END IF;

  v_from := v_row.status;
  v_title := CASE p_status
    WHEN 'waiting_for_dropoff' THEN 'Waiting for Drop-off'
    WHEN 'received' THEN 'Received'
    WHEN 'dispatched' THEN 'Dispatched'
    WHEN 'in_transit' THEN 'In Transit'
    WHEN 'at_destination_branch' THEN 'Arrived'
    WHEN 'ready_for_collection' THEN 'Ready for Collection'
    WHEN 'collected' THEN 'Collected'
    WHEN 'returned' THEN 'Returned'
    WHEN 'cancelled' THEN 'Cancelled'
    ELSE initcap(replace(p_status::text, '_', ' '))
  END;

  v_desc := coalesce(nullif(trim(p_note), ''), CASE p_status
    WHEN 'in_transit' THEN 'Parcel is on the road to the destination office.'
    WHEN 'at_destination_branch' THEN 'Parcel has arrived at the destination courier office.'
    WHEN 'ready_for_collection' THEN 'Parcel is ready. Receiver can collect with ID.'
    WHEN 'collected' THEN 'Handed over to the receiver.'
    WHEN 'dispatched' THEN 'Loaded and left the origin branch.'
    WHEN 'received' THEN 'Verified at the counter.'
    ELSE v_title
  END);

  v_notify := CASE p_status
    WHEN 'received' THEN 'receive'
    WHEN 'dispatched' THEN 'dispatch'
    WHEN 'in_transit' THEN 'transit'
    WHEN 'at_destination_branch' THEN 'arrived'
    WHEN 'ready_for_collection' THEN 'ready'
    ELSE NULL
  END;

  UPDATE public.parcels
  SET
    status = p_status,
    updated_at = NOW(),
    updated_by = v_uid,
    current_branch_id = CASE
      WHEN p_status IN ('at_destination_branch', 'ready_for_collection', 'collected') THEN destination_branch_id
      ELSE current_branch_id
    END,
    dispatched_at = CASE WHEN p_status IN ('dispatched', 'in_transit') THEN coalesce(dispatched_at, NOW()) ELSE dispatched_at END,
    ready_at = CASE WHEN p_status = 'ready_for_collection' THEN coalesce(ready_at, NOW()) ELSE ready_at END,
    collected_at = CASE WHEN p_status = 'collected' THEN coalesce(collected_at, NOW()) ELSE collected_at END
  WHERE id = p_parcel_id;

  INSERT INTO public.parcel_tracking (
    company_id, parcel_id, status, title, description, location_label, occurred_at, is_public, created_by
  ) VALUES (
    v_company, p_parcel_id, p_status, v_title, v_desc, nullif(trim(p_location_label), ''), NOW(), TRUE, v_uid
  );

  RETURN QUERY
  SELECT
    v_row.id,
    v_row.tracking_number,
    p_status::text,
    v_row.receiver_phone,
    v_row.sender_phone,
    v_row.company_id,
    v_title,
    v_notify;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_dispatch_run(
  p_driver_id UUID DEFAULT NULL,
  p_vehicle_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_uid UUID := auth.uid();
  v_run UUID;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager', 'dispatcher', 'receptionist', 'driver')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.dispatch_runs
  SET is_active = FALSE, ended_at = NOW()
  WHERE company_id = v_company
    AND is_active = TRUE
    AND (p_driver_id IS NULL OR driver_id IS NOT DISTINCT FROM p_driver_id);

  INSERT INTO public.dispatch_runs (company_id, driver_id, vehicle_id, created_by)
  VALUES (v_company, p_driver_id, p_vehicle_id, v_uid)
  RETURNING id INTO v_run;

  RETURN v_run;
END;
$$;

CREATE OR REPLACE FUNCTION public.stop_dispatch_run(p_run_id UUID DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_n INT := 0;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.dispatch_runs
  SET is_active = FALSE, ended_at = NOW()
  WHERE company_id = v_company
    AND is_active = TRUE
    AND (p_run_id IS NULL OR id = p_run_id);

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_run_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_driver_id UUID DEFAULT NULL,
  p_accuracy_m DOUBLE PRECISION DEFAULT NULL,
  p_run_id UUID DEFAULT NULL
)
RETURNS TABLE (
  parcel_id UUID,
  tracking TEXT,
  from_status TEXT,
  to_status TEXT,
  title TEXT,
  description TEXT,
  receiver_phone TEXT,
  sender_phone TEXT,
  notify_event TEXT,
  dest_city TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_uid UUID := auth.uid();
  rec RECORD;
  v_from parcel_status_code;
  v_to parcel_status_code;
  v_title TEXT;
  v_desc TEXT;
  v_notify TEXT;
  v_origin_lat DOUBLE PRECISION;
  v_origin_lng DOUBLE PRECISION;
  v_dest_lat DOUBLE PRECISION;
  v_dest_lng DOUBLE PRECISION;
  v_city_lat DOUBLE PRECISION;
  v_city_lng DOUBLE PRECISION;
  v_d_origin DOUBLE PRECISION;
  v_d_office DOUBLE PRECISION;
  v_d_city DOUBLE PRECISION;
  v_city TEXT;
  v_origin_city TEXT;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'Location required';
  END IF;
  IF p_accuracy_m IS NOT NULL AND p_accuracy_m > 150 THEN
    RETURN;
  END IF;

  UPDATE public.dispatch_runs
  SET last_lat = p_lat, last_lng = p_lng, last_accuracy_m = p_accuracy_m, last_reported_at = NOW()
  WHERE company_id = v_company
    AND is_active = TRUE
    AND (p_run_id IS NULL OR id = p_run_id);

  IF p_driver_id IS NOT NULL THEN
    UPDATE public.drivers
    SET last_lat = p_lat, last_lng = p_lng, last_seen_at = NOW(), updated_at = NOW()
    WHERE id = p_driver_id AND company_id = v_company;
  END IF;

  FOR rec IN
    SELECT
      p.id,
      p.tracking_number,
      p.status,
      p.receiver_phone,
      p.sender_phone,
      p.company_id,
      p.origin_branch_id,
      p.destination_branch_id,
      ob.city AS origin_city,
      db.city AS dest_city,
      ob.latitude AS origin_lat,
      ob.longitude AS origin_lng,
      db.latitude AS dest_lat,
      db.longitude AS dest_lng,
      oc.latitude AS origin_city_lat,
      oc.longitude AS origin_city_lng,
      dc.latitude AS dest_city_lat,
      dc.longitude AS dest_city_lng
    FROM public.parcels p
    JOIN public.branches ob ON ob.id = p.origin_branch_id
    JOIN public.branches db ON db.id = p.destination_branch_id
    LEFT JOIN LATERAL public.lookup_zm_city_coords(ob.city) oc ON TRUE
    LEFT JOIN LATERAL public.lookup_zm_city_coords(db.city) dc ON TRUE
    WHERE p.company_id = v_company
      AND p.soft_delete = FALSE
      AND p.status IN ('dispatched', 'in_transit', 'at_destination_branch')
      AND (
        p_driver_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.driver_assignments da
          WHERE da.parcel_id = p.id
            AND da.driver_id = p_driver_id
            AND da.company_id = v_company
            AND da.soft_delete = FALSE
        )
      )
  LOOP
    v_from := rec.status;
    v_to := NULL;
    v_title := NULL;
    v_desc := NULL;
    v_notify := NULL;
    v_city := coalesce(nullif(trim(rec.dest_city), ''), 'destination');
    v_origin_city := coalesce(nullif(trim(rec.origin_city), ''), '');

    v_origin_lat := coalesce(rec.origin_lat::double precision, rec.origin_city_lat::double precision);
    v_origin_lng := coalesce(rec.origin_lng::double precision, rec.origin_city_lng::double precision);
    v_dest_lat := coalesce(rec.dest_lat::double precision, rec.dest_city_lat::double precision);
    v_dest_lng := coalesce(rec.dest_lng::double precision, rec.dest_city_lng::double precision);
    v_city_lat := rec.dest_city_lat::double precision;
    v_city_lng := rec.dest_city_lng::double precision;

    v_d_origin := public.geo_distance_m(p_lat, p_lng, v_origin_lat, v_origin_lng);
    v_d_office := public.geo_distance_m(p_lat, p_lng, v_dest_lat, v_dest_lng);
    v_d_city := public.geo_distance_m(p_lat, p_lng, v_city_lat, v_city_lng);

    IF v_d_office IS NOT NULL AND v_d_office <= 100 AND rec.status IN ('dispatched', 'in_transit', 'at_destination_branch') THEN
      v_to := 'ready_for_collection';
      v_title := 'Ready for Collection';
      v_desc := 'Parcel is at the ' || v_city || ' courier office. Receiver can collect with ID.';
      v_notify := 'ready';
    ELSIF v_d_office IS NOT NULL AND v_d_office <= 280 AND rec.status IN ('dispatched', 'in_transit') THEN
      v_to := 'at_destination_branch';
      v_title := 'Arrived';
      v_desc := 'Vehicle reached the ' || v_city || ' courier office.';
      v_notify := 'arrived';
    ELSIF v_d_city IS NOT NULL
      AND v_d_city <= 12000
      AND rec.status IN ('dispatched', 'in_transit')
      AND lower(v_city) IS DISTINCT FROM lower(v_origin_city)
      AND NOT EXISTS (
        SELECT 1 FROM public.parcel_tracking t
        WHERE t.parcel_id = rec.id AND t.location_label = 'city_enter' AND t.soft_delete = FALSE
      ) THEN
      v_to := 'in_transit';
      v_title := 'Arrived in ' || v_city;
      v_desc := 'Vehicle has entered ' || v_city || '. Heading to the courier office.';
      v_notify := 'city';
    ELSIF v_d_origin IS NOT NULL AND v_d_origin >= 220 AND rec.status = 'dispatched' THEN
      v_to := 'in_transit';
      v_title := 'In Transit';
      v_desc := 'Vehicle has left the origin branch. Parcel is on the way.';
      v_notify := 'transit';
    END IF;

    IF v_to IS NULL THEN
      CONTINUE;
    END IF;

    IF v_to IS DISTINCT FROM rec.status THEN
      UPDATE public.parcels
      SET
        status = v_to,
        updated_at = NOW(),
        current_branch_id = CASE
          WHEN v_to IN ('at_destination_branch', 'ready_for_collection') THEN rec.destination_branch_id
          ELSE current_branch_id
        END,
        ready_at = CASE WHEN v_to = 'ready_for_collection' THEN coalesce(ready_at, NOW()) ELSE ready_at END
      WHERE id = rec.id;
    END IF;

    INSERT INTO public.parcel_tracking (
      company_id, parcel_id, status, title, description, location_label,
      latitude, longitude, occurred_at, is_public, created_by
    ) VALUES (
      rec.company_id,
      rec.id,
      v_to,
      v_title,
      v_desc,
      CASE WHEN v_notify = 'city' THEN 'city_enter' ELSE 'gps' END,
      p_lat, p_lng, NOW(), TRUE, v_uid
    );

    parcel_id := rec.id;
    tracking := rec.tracking_number;
    from_status := v_from::text;
    to_status := v_to::text;
    title := v_title;
    description := v_desc;
    receiver_phone := rec.receiver_phone;
    sender_phone := rec.sender_phone;
    notify_event := v_notify;
    dest_city := v_city;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_company_branch(
  p_id UUID,
  p_name TEXT,
  p_code TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_code TEXT;
  v_city TEXT;
  v_lat NUMERIC;
  v_lng NUMERIC;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = p_id AND b.company_id = v_company AND b.soft_delete = FALSE
  ) THEN
    RAISE EXCEPTION 'Branch not found';
  END IF;

  v_code := nullif(upper(trim(p_code)), '');
  v_city := coalesce(nullif(trim(p_city), ''), 'Lusaka');
  v_lat := p_latitude;
  v_lng := p_longitude;

  IF v_lat IS NULL OR v_lng IS NULL THEN
    SELECT c.latitude, c.longitude INTO v_lat, v_lng
    FROM public.lookup_zm_city_coords(v_city) c;
  END IF;

  UPDATE public.branches
  SET
    name = coalesce(nullif(trim(p_name), ''), name),
    code = coalesce(v_code, code),
    city = v_city,
    phone = nullif(trim(p_phone), ''),
    address_line1 = coalesce(nullif(trim(p_address), ''), address_line1),
    latitude = coalesce(v_lat, latitude),
    longitude = coalesce(v_lng, longitude),
    updated_at = NOW()
  WHERE id = p_id AND company_id = v_company;

  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_company_branch(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_open INT;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT COUNT(*) INTO v_open
  FROM public.branches
  WHERE company_id = v_company AND soft_delete = FALSE AND id <> p_id;

  IF v_open < 1 THEN
    RAISE EXCEPTION 'Keep at least one branch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.company_id = v_company
      AND p.soft_delete = FALSE
      AND p.status NOT IN ('collected', 'cancelled', 'returned')
      AND (p.origin_branch_id = p_id OR p.destination_branch_id = p_id OR p.current_branch_id = p_id)
  ) THEN
    RAISE EXCEPTION 'This branch still has active parcels. Close it instead, or finish those parcels first.';
  END IF;

  UPDATE public.branches
  SET
    soft_delete = TRUE,
    is_active = FALSE,
    code = code || '-X' || substr(replace(p_id::text, '-', ''), 1, 6),
    updated_at = NOW()
  WHERE id = p_id AND company_id = v_company AND soft_delete = FALSE;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_console_delete_company(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.companies;
BEGIN
  UPDATE public.companies
  SET
    soft_delete = TRUE,
    status = 'disconnected',
    disconnected_at = NOW(),
    slug = slug || '-x' || substr(replace(p_company_id::text, '-', ''), 1, 6),
    code = code || 'X' || substr(replace(p_company_id::text, '-', ''), 1, 4),
    subdomain = subdomain || '-x' || substr(replace(p_company_id::text, '-', ''), 1, 6),
    updated_at = NOW()
  WHERE id = p_company_id AND soft_delete = FALSE
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  INSERT INTO public.audit_logs (company_id, action, entity_type, entity_id, description)
  VALUES (
    p_company_id,
    'delete',
    'company',
    p_company_id,
    'Company deleted from SaaS console'
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.geo_distance_m(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_zm_city_coords(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.staff_update_parcel_status(UUID, parcel_status_code, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_dispatch_run(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_dispatch_run(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_run_location(DOUBLE PRECISION, DOUBLE PRECISION, UUID, DOUBLE PRECISION, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_company_branch(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_company_branch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_console_delete_company(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_parcel_tracking_public(p_tracking TEXT)
RETURNS TABLE (
  title TEXT,
  description TEXT,
  occurred_at TIMESTAMPTZ,
  status TEXT,
  location_label TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.title, t.description, t.occurred_at, t.status::text, t.location_label
  FROM public.parcels p
  JOIN public.parcel_tracking t ON t.parcel_id = p.id AND t.soft_delete = FALSE
  WHERE p.soft_delete = FALSE
    AND t.is_public = TRUE
    AND upper(p.tracking_number) = upper(trim(p_tracking))
  ORDER BY t.occurred_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_parcel_tracking_public(TEXT) TO anon, authenticated;

UPDATE public.branches b
SET latitude = x.latitude, longitude = x.longitude
FROM (
  SELECT DISTINCT ON (b2.id) b2.id, c.latitude, c.longitude
  FROM public.branches b2
  JOIN public.zm_city_coords c
    ON lower(c.city) = lower(trim(b2.city))
    OR lower(trim(b2.city)) LIKE '%' || lower(c.city) || '%'
  WHERE b2.soft_delete = FALSE
    AND (b2.latitude IS NULL OR b2.longitude IS NULL)
  ORDER BY b2.id, CASE WHEN lower(c.city) = lower(trim(b2.city)) THEN 0 ELSE 1 END, length(c.city)
) x
WHERE b.id = x.id;
