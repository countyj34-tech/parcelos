-- Add vehicle from Dispatch even when users.company_id is still null (staff link is on staff.company_id).

CREATE OR REPLACE FUNCTION public.create_company_vehicle(
  p_registration TEXT,
  p_make TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_capacity_kg NUMERIC DEFAULT 50,
  p_branch_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
  v_reg TEXT := upper(nullif(trim(p_registration), ''));
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;

  BEGIN
    v_company := public.repair_my_company_link();
  EXCEPTION WHEN OTHERS THEN
    v_company := public.get_user_company_id();
  END;

  IF v_company IS NULL THEN
    v_company := public.get_user_company_id();
  END IF;

  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No company linked to your account';
  END IF;

  IF public.get_user_role_code() NOT IN (
       'company_admin', 'branch_manager', 'dispatcher', 'receptionist'
     )
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed to add vehicles';
  END IF;

  IF v_reg IS NULL THEN RAISE EXCEPTION 'Registration number is required'; END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = p_branch_id AND b.company_id = v_company AND b.soft_delete = FALSE
  ) THEN
    RAISE EXCEPTION 'Branch not found';
  END IF;

  SELECT v.id INTO v_id
  FROM public.vehicles v
  WHERE v.company_id = v_company
    AND v.registration_no = v_reg
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.vehicles
    SET
      soft_delete = FALSE,
      is_active = TRUE,
      make = COALESCE(nullif(trim(p_make), ''), make),
      model = COALESCE(nullif(trim(p_model), ''), model),
      capacity_kg = COALESCE(p_capacity_kg, capacity_kg),
      branch_id = COALESCE(p_branch_id, branch_id),
      updated_at = NOW(),
      updated_by = v_uid
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.vehicles (
    company_id, branch_id, registration_no, make, model, capacity_kg, is_active, created_by
  ) VALUES (
    v_company,
    p_branch_id,
    v_reg,
    nullif(trim(p_make), ''),
    nullif(trim(p_model), ''),
    COALESCE(p_capacity_kg, 50),
    TRUE,
    CASE WHEN EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_uid) THEN v_uid ELSE NULL END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_vehicle(TEXT, TEXT, TEXT, NUMERIC, UUID) TO authenticated;
