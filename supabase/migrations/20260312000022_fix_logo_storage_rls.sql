-- Fix company logo storage RLS (migration 20 updated helpers but not insert/update policies)

-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  TRUE,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Helpers must be usable from storage policies
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_company(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.storage_company_id(TEXT) TO authenticated, anon, service_role;

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

-- Recreate ALL logo policies (old insert policy is what still blocks uploads)
DROP POLICY IF EXISTS storage_logos_select ON storage.objects;
DROP POLICY IF EXISTS storage_logos_insert ON storage.objects;
DROP POLICY IF EXISTS storage_logos_update ON storage.objects;
DROP POLICY IF EXISTS storage_logos_delete ON storage.objects;

CREATE POLICY storage_logos_select ON storage.objects
  FOR SELECT
  USING (bucket_id = 'company-logos');

CREATE POLICY storage_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (
      public.is_platform_owner()
      OR (
        public.get_user_company_id() IS NOT NULL
        AND (storage.foldername(name))[1] = public.get_user_company_id()::text
      )
    )
  );

CREATE POLICY storage_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (
      public.is_platform_owner()
      OR (
        public.get_user_company_id() IS NOT NULL
        AND (storage.foldername(name))[1] = public.get_user_company_id()::text
      )
    )
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (
      public.is_platform_owner()
      OR (
        public.get_user_company_id() IS NOT NULL
        AND (storage.foldername(name))[1] = public.get_user_company_id()::text
      )
    )
  );

CREATE POLICY storage_logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (
      public.is_platform_owner()
      OR (
        public.get_user_company_id() IS NOT NULL
        AND (storage.foldername(name))[1] = public.get_user_company_id()::text
      )
    )
  );
