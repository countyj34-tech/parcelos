-- Platform owner account for Mthunzi-Tech-Labs
-- After creating the Auth user in Dashboard, run:
--   SELECT public.bootstrap_platform_admin('mthunzilabs@gmail.com');

CREATE OR REPLACE FUNCTION public.bootstrap_platform_admin(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID;
  v_role_id UUID;
  v_id UUID;
  v_email TEXT := lower(trim(p_email));
BEGIN
  SELECT id INTO v_auth_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Auth user not found for email: %. Create the user in Authentication → Users first.', v_email;
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE code = 'platform_owner';
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'platform_owner role missing — apply seed migrations first';
  END IF;

  -- Only one active platform owner email for this product
  UPDATE public.platform_users
  SET is_active = FALSE, soft_delete = TRUE, updated_at = NOW()
  WHERE lower(email) <> v_email
    AND soft_delete = FALSE;

  INSERT INTO public.platform_users (auth_user_id, email, full_name, role_id, is_active, soft_delete)
  VALUES (
    v_auth_id,
    v_email,
    'Mthunzi Tech Labs',
    v_role_id,
    TRUE,
    FALSE
  )
  ON CONFLICT (auth_user_id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role_id = EXCLUDED.role_id,
      is_active = TRUE,
      soft_delete = FALSE,
      updated_at = NOW()
  RETURNING id INTO v_id;

  UPDATE public.users
  SET
    user_type = 'platform',
    full_name = COALESCE(NULLIF(full_name, ''), 'Mthunzi Tech Labs'),
    email_verified = TRUE,
    is_active = TRUE,
    updated_at = NOW()
  WHERE id = v_auth_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.bootstrap_platform_admin IS
  'Link Auth user as platform owner. Example: SELECT public.bootstrap_platform_admin(''mthunzilabs@gmail.com'');';

-- If the Auth user already exists, link it now (no-op / clear error if not yet created)
DO $$
BEGIN
  PERFORM public.bootstrap_platform_admin('mthunzilabs@gmail.com');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Platform owner not linked yet: %. Create Auth user mthunzilabs@gmail.com then re-run bootstrap_platform_admin.', SQLERRM;
END;
$$;
