-- =============================================================================
-- ParcelOS — Storage Buckets & Realtime Publications
-- =============================================================================

-- Storage buckets (company-isolated via RLS on storage.objects)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('company-logos', 'company-logos', TRUE, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('parcel-images', 'parcel-images', FALSE, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('receipts', 'receipts', FALSE, 5242880, ARRAY['application/pdf', 'image/png', 'image/jpeg']),
  ('documents', 'documents', FALSE, 20971520, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('proof-of-delivery', 'proof-of-delivery', FALSE, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage path convention: {company_id}/{entity}/{filename}
CREATE OR REPLACE FUNCTION public.storage_company_id(object_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(split_part(object_name, '/', 1), '')::UUID;
$$;

-- Company logos: public read, company admin write
CREATE POLICY storage_logos_select ON storage.objects
  FOR SELECT USING (bucket_id = 'company-logos');

CREATE POLICY storage_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND public.can_access_company(public.storage_company_id(name))
  );

CREATE POLICY storage_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND public.can_access_company(public.storage_company_id(name))
  );

-- Tenant-private buckets
CREATE POLICY storage_tenant_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('parcel-images', 'receipts', 'documents', 'proof-of-delivery')
    AND (
      public.is_platform_owner()
      OR public.can_access_company(public.storage_company_id(name))
    )
  );

CREATE POLICY storage_tenant_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('parcel-images', 'receipts', 'documents', 'proof-of-delivery')
    AND public.can_access_company(public.storage_company_id(name))
  );

CREATE POLICY storage_tenant_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('parcel-images', 'receipts', 'documents', 'proof-of-delivery')
    AND public.can_access_company(public.storage_company_id(name))
  );

-- Realtime: parcel tracking, notifications, dispatch
ALTER PUBLICATION supabase_realtime ADD TABLE public.parcel_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parcels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_assignments;
