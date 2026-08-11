-- Persist logo URL immediately after upload (no full brand form required)

CREATE OR REPLACE FUNCTION public.set_my_company_logo(p_logo_url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No company linked to this account';
  END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed to update branding';
  END IF;
  IF nullif(trim(p_logo_url), '') IS NULL THEN
    RAISE EXCEPTION 'Logo URL is required';
  END IF;

  UPDATE public.companies
  SET logo_url = trim(p_logo_url), updated_at = NOW()
  WHERE id = v_company;

  RETURN trim(p_logo_url);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_company_logo(TEXT) TO authenticated;
