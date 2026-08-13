-- =============================================================================
-- ParcelOS — RLS Helper Functions
-- Security-definer functions used by all Row Level Security policies.
-- =============================================================================

-- Returns TRUE when the authenticated user is an active platform owner (MTHUNZI).
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_users pu
    JOIN public.roles r ON r.id = pu.role_id
    WHERE pu.auth_user_id = auth.uid()
      AND pu.is_active = TRUE
      AND pu.soft_delete = FALSE
      AND r.code = 'platform_owner'
  );
$$;

-- Returns the company_id for the authenticated staff user.
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.company_id
  FROM public.users u
  WHERE u.id = auth.uid()
    AND u.is_active = TRUE
    AND u.soft_delete = FALSE
  LIMIT 1;
$$;

-- Returns role code for authenticated staff within their company.
CREATE OR REPLACE FUNCTION public.get_user_role_code()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.code
  FROM public.staff s
  JOIN public.roles r ON r.id = s.role_id
  WHERE s.user_id = auth.uid()
    AND s.is_active = TRUE
    AND s.soft_delete = FALSE
  LIMIT 1;
$$;

-- Branch IDs the user may access (all branches for company admin, assigned for branch roles).
CREATE OR REPLACE FUNCTION public.get_user_branch_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id
  FROM public.branches b
  JOIN public.staff s ON s.company_id = b.company_id
  JOIN public.roles r ON r.id = s.role_id
  WHERE s.user_id = auth.uid()
    AND s.is_active = TRUE
    AND s.soft_delete = FALSE
    AND b.soft_delete = FALSE
    AND (
      r.code IN ('company_admin', 'finance', 'customer_support', 'auditor', 'dispatcher')
      OR EXISTS (
        SELECT 1 FROM public.staff_branch_assignments sba
        WHERE sba.staff_id = s.id AND sba.branch_id = b.id
      )
    );
$$;

-- Customer record linked to auth user (customer portal).
CREATE OR REPLACE FUNCTION public.get_customer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.customers c
  WHERE c.user_id = auth.uid()
    AND c.soft_delete = FALSE
  LIMIT 1;
$$;

-- Driver record for authenticated user.
CREATE OR REPLACE FUNCTION public.get_driver_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id
  FROM public.drivers d
  JOIN public.staff s ON s.id = d.staff_id
  WHERE s.user_id = auth.uid()
    AND d.soft_delete = FALSE
    AND s.soft_delete = FALSE
  LIMIT 1;
$$;

-- Generic tenant isolation check.
CREATE OR REPLACE FUNCTION public.can_access_company(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_owner()
    OR public.get_user_company_id() = p_company_id;
$$;

-- Write audit log entry (callable from app / edge functions).
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_company_id UUID,
  p_action audit_action,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM public.users WHERE id = auth.uid();

  INSERT INTO public.audit_logs (
    company_id, actor_id, actor_email, action,
    entity_type, entity_id, description, metadata
  ) VALUES (
    p_company_id, auth.uid(), v_email, p_action,
    p_entity_type, p_entity_id, p_description, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.is_platform_owner IS 'Platform owner (MTHUNZI-TECH-LABS) bypasses tenant RLS.';
COMMENT ON FUNCTION public.get_user_company_id IS 'Returns tenant company_id for authenticated staff.';
COMMENT ON FUNCTION public.can_access_company IS 'TRUE if user is platform owner or belongs to company.';
