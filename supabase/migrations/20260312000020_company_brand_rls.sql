-- Allow company staff to update their own company branding + fix logo storage RLS

-- Staff could SELECT companies but not UPDATE → brand save / logo URL failed RLS
DROP POLICY IF EXISTS companies_staff_update ON public.companies;
CREATE POLICY companies_staff_update ON public.companies
  FOR UPDATE TO authenticated
  USING (id = public.get_user_company_id())
  WITH CHECK (id = public.get_user_company_id());

-- Prefer staff.company_id if users.company_id is somehow null
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT u.company_id
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = TRUE
        AND u.soft_delete = FALSE
      LIMIT 1
    ),
    (
      SELECT s.company_id
      FROM public.staff s
      WHERE s.user_id = auth.uid()
        AND s.is_active = TRUE
        AND s.soft_delete = FALSE
      LIMIT 1
    )
  );
$$;

-- Invalid UUID cast so bad storage paths don't explode the policy
CREATE OR REPLACE FUNCTION public.storage_company_id(object_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_part TEXT := NULLIF(split_part(object_name, '/', 1), '');
BEGIN
  IF v_part IS NULL OR v_part !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN v_part::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Logo replace / cleanup
DROP POLICY IF EXISTS storage_logos_delete ON storage.objects;
CREATE POLICY storage_logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND public.can_access_company(public.storage_company_id(name))
  );

-- Reliable brand update (bypasses brittle client RLS edge cases)
CREATE OR REPLACE FUNCTION public.update_my_company_brand(
  p_name TEXT,
  p_tagline TEXT DEFAULT NULL,
  p_primary_color TEXT DEFAULT NULL,
  p_secondary_color TEXT DEFAULT NULL,
  p_support_phone TEXT DEFAULT NULL,
  p_support_email TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_price_chart_url TEXT DEFAULT NULL
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_row public.companies%ROWTYPE;
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
  IF nullif(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Company name is required';
  END IF;

  UPDATE public.companies
  SET
    name = trim(p_name),
    tagline = nullif(trim(coalesce(p_tagline, '')), ''),
    primary_color = coalesce(nullif(trim(p_primary_color), ''), primary_color),
    secondary_color = coalesce(nullif(trim(p_secondary_color), ''), secondary_color),
    support_phone = nullif(trim(coalesce(p_support_phone, '')), ''),
    support_email = nullif(trim(coalesce(p_support_email, '')), ''),
    logo_url = CASE WHEN p_logo_url IS NULL THEN logo_url ELSE nullif(trim(p_logo_url), '') END,
    price_chart_url = CASE WHEN p_price_chart_url IS NULL THEN price_chart_url ELSE nullif(trim(p_price_chart_url), '') END,
    updated_at = NOW()
  WHERE id = v_company
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_company_brand(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
