-- SaaS console two-step login uses Supabase Auth (sessions persist automatically).
-- Create both users in Dashboard → Authentication → Users, then run bootstrap for owner.

DO $$
BEGIN
  PERFORM public.bootstrap_platform_admin('mthunzilabs@gmail.com');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Owner bootstrap skipped: %. Create Auth user mthunzilabs@gmail.com first.', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.bootstrap_platform_admin IS
  'Links mthunzilabs@gmail.com as platform owner. Gate-1 org user (mthunzitechlabs@gmail.com) is Auth-only — no DB row needed.';
