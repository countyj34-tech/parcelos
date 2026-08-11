-- Fix: staff could not always read their own row when users.company_id lagged,
-- which made the app think the workspace was "still linking" and force onboarding again.

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

GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_company_id();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated;

-- Always allow a user to see their own staff membership (avoids RLS chicken-and-egg)
DROP POLICY IF EXISTS staff_self_select ON public.staff;
CREATE POLICY staff_self_select ON public.staff
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND soft_delete = FALSE);

-- Repair users.company_id if staff exists but users row was never updated
CREATE OR REPLACE FUNCTION public.repair_my_company_link()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.company_id INTO v_company
  FROM public.staff s
  WHERE s.user_id = v_uid
    AND s.is_active = TRUE
    AND s.soft_delete = FALSE
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF v_company IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.users
  SET
    company_id = v_company,
    user_type = COALESCE(user_type, 'staff'),
    updated_at = NOW()
  WHERE id = v_uid
    AND (company_id IS DISTINCT FROM v_company OR company_id IS NULL);

  RETURN v_company;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_my_company_link() TO authenticated;

-- Single source of truth for the signed-in workspace (bypasses nested RLS join issues)
CREATE OR REPLACE FUNCTION public.get_my_workspace()
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  company_slug TEXT,
  subdomain TEXT,
  tagline TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  support_phone TEXT,
  support_email CITEXT,
  role_code TEXT,
  full_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN
    SELECT s.company_id INTO v_company
    FROM public.staff s
    WHERE s.user_id = v_uid AND s.is_active = TRUE AND s.soft_delete = FALSE
    LIMIT 1;
  END IF;

  IF v_company IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    c.subdomain,
    c.tagline,
    c.logo_url,
    c.primary_color,
    c.secondary_color,
    COALESCE(c.support_phone, c.phone),
    COALESCE(c.support_email, c.email),
    r.code,
    u.full_name
  FROM public.companies c
  JOIN public.users u ON u.id = v_uid
  LEFT JOIN public.staff s
    ON s.user_id = v_uid
   AND s.company_id = c.id
   AND s.is_active = TRUE
   AND s.soft_delete = FALSE
  LEFT JOIN public.roles r ON r.id = s.role_id
  WHERE c.id = v_company
    AND c.soft_delete = FALSE
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_workspace() TO authenticated;
