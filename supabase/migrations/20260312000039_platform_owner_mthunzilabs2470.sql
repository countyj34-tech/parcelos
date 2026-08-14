-- Correct platform owner Auth email for Mthunzi-Tech-Labs.
-- Create Auth user mthunzilabs2470@gmail.com first, then this links it as owner.

DO $$
BEGIN
  PERFORM public.bootstrap_platform_admin('mthunzilabs2470@gmail.com');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Owner bootstrap skipped: %. Create Auth user mthunzilabs2470@gmail.com first, then re-run: SELECT public.bootstrap_platform_admin(''mthunzilabs2470@gmail.com'');', SQLERRM;
END;
$$;
