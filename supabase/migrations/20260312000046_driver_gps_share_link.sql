-- Drivers do not log in. GPS for a trip can run from a shared phone link
-- (the phone in the van) without creating a driver user account.

ALTER TABLE public.dispatch_runs
  ADD COLUMN IF NOT EXISTS share_token TEXT;

UPDATE public.dispatch_runs
SET share_token = encode(gen_random_bytes(16), 'hex')
WHERE share_token IS NULL;

ALTER TABLE public.dispatch_runs
  ALTER COLUMN share_token SET DEFAULT encode(gen_random_bytes(16), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS idx_dispatch_runs_share_token
  ON public.dispatch_runs(share_token)
  WHERE share_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.dispatch_run_share_token(p_run_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_token TEXT;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.dispatch_runs
  SET share_token = coalesce(share_token, encode(gen_random_bytes(16), 'hex'))
  WHERE id = p_run_id AND company_id = v_company
  RETURNING share_token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_run_share_token(UUID) TO authenticated;

-- Shared GPS applicator used by staff phones and the public van link.
CREATE OR REPLACE FUNCTION public.apply_run_gps(
  p_company UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_driver_id UUID,
  p_accuracy_m DOUBLE PRECISION,
  p_run_id UUID,
  p_uid UUID
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
  IF p_lat IS NULL OR p_lng IS NULL THEN RAISE EXCEPTION 'Location required'; END IF;
  IF p_accuracy_m IS NOT NULL AND p_accuracy_m > 150 THEN RETURN; END IF;

  UPDATE public.dispatch_runs
  SET last_lat = p_lat, last_lng = p_lng, last_accuracy_m = p_accuracy_m, last_reported_at = NOW()
  WHERE company_id = p_company
    AND is_active = TRUE
    AND (p_run_id IS NULL OR id = p_run_id);

  IF p_driver_id IS NOT NULL THEN
    UPDATE public.drivers
    SET last_lat = p_lat, last_lng = p_lng, last_seen_at = NOW(), updated_at = NOW()
    WHERE id = p_driver_id AND company_id = p_company;
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
    WHERE p.company_id = p_company
      AND p.soft_delete = FALSE
      AND p.status IN ('dispatched', 'in_transit', 'at_destination_branch')
      AND (
        p_driver_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.driver_assignments da
          WHERE da.parcel_id = p.id
            AND da.driver_id = p_driver_id
            AND da.company_id = p_company
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

    IF v_to IS NULL THEN CONTINUE; END IF;

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
      rec.company_id, rec.id, v_to, v_title, v_desc,
      CASE WHEN v_notify = 'city' THEN 'city_enter' ELSE 'gps' END,
      p_lat, p_lng, NOW(), TRUE, p_uid
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
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT * FROM public.apply_run_gps(v_company, p_lat, p_lng, p_driver_id, p_accuracy_m, p_run_id, v_uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.report_run_location_public(
  p_token TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_accuracy_m DOUBLE PRECISION DEFAULT NULL
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
  v_run public.dispatch_runs%ROWTYPE;
BEGIN
  SELECT * INTO v_run
  FROM public.dispatch_runs
  WHERE share_token = nullif(trim(p_token), '')
    AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This trip has ended or the link is wrong';
  END IF;

  RETURN QUERY
  SELECT * FROM public.apply_run_gps(
    v_run.company_id, p_lat, p_lng, v_run.driver_id, p_accuracy_m, v_run.id, NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_run_location(DOUBLE PRECISION, DOUBLE PRECISION, UUID, DOUBLE PRECISION, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_run_location_public(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
