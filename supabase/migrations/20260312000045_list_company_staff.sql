-- Staff table has multiple FKs to users (user_id, created_by, updated_by).
-- PostgREST `.select("..., users(...)")` fails as ambiguous, so the Staff page
-- always showed 0 members even after provisioning succeeded.

CREATE OR REPLACE FUNCTION public.list_company_staff()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role_name TEXT,
  role_code TEXT,
  branch_name TEXT,
  is_active BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID;
BEGIN
  BEGIN
    v_company := public.repair_my_company_link();
  EXCEPTION WHEN OTHERS THEN
    v_company := public.get_user_company_id();
  END;
  IF v_company IS NULL THEN
    v_company := public.get_user_company_id();
  END IF;
  IF v_company IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    coalesce(nullif(trim(u.full_name), ''), split_part(u.email::text, '@', 1), 'Staff') AS full_name,
    u.email::text,
    coalesce(nullif(trim(s.phone), ''), nullif(trim(u.phone), '')) AS phone,
    coalesce(r.name, initcap(replace(r.code, '_', ' ')), 'Staff') AS role_name,
    r.code AS role_code,
    coalesce(
      (
        SELECT b.name
        FROM public.staff_branch_assignments a
        JOIN public.branches b ON b.id = a.branch_id AND b.soft_delete = FALSE
        WHERE a.staff_id = s.id
          AND a.soft_delete = FALSE
        ORDER BY a.is_primary DESC, a.created_at ASC
        LIMIT 1
      ),
      CASE WHEN r.code = 'company_admin' THEN 'All branches' ELSE '—' END
    ) AS branch_name,
    s.is_active
  FROM public.staff s
  JOIN public.users u ON u.id = s.user_id
  LEFT JOIN public.roles r ON r.id = s.role_id
  WHERE s.company_id = v_company
    AND s.soft_delete = FALSE
  ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_company_staff() TO authenticated;
