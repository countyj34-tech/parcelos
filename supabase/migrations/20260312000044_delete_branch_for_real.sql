-- Delete branch must actually hide it. Previous version returned true after a 0-row
-- update, and blocked on leftover parcels / "keep one branch".

CREATE OR REPLACE FUNCTION public.delete_company_branch(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
  v_n INT := 0;
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
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.branches
  SET
    soft_delete = TRUE,
    is_active = FALSE,
    is_head_office = FALSE,
    code = left(code, 24) || '-x' || substr(replace(p_id::text, '-', ''), 1, 8),
    updated_at = NOW(),
    updated_by = CASE
      WHEN EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_uid) THEN v_uid
      ELSE updated_by
    END
  WHERE id = p_id
    AND company_id = v_company
    AND soft_delete = FALSE;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n < 1 THEN
    RAISE EXCEPTION 'Branch not found';
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_company_branch(UUID) TO authenticated;
