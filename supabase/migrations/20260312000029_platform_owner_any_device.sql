-- Allow a signed-in platform owner to read their own platform_users row on any device.
-- Fixes phone login where is_platform_owner() chicken-and-egg blocked profile load.

DROP POLICY IF EXISTS platform_users_self_select ON public.platform_users;
CREATE POLICY platform_users_self_select ON public.platform_users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() AND soft_delete = FALSE);

-- Helper for the app (optional)
CREATE OR REPLACE FUNCTION public.is_my_platform_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_owner();
$$;

GRANT EXECUTE ON FUNCTION public.is_my_platform_owner() TO authenticated;
