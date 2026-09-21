-- 1. Block all client-side writes to user_roles (prevents self-assigned admin)
DROP POLICY IF EXISTS user_roles_no_client_writes ON public.user_roles;
CREATE POLICY user_roles_no_client_writes
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (false);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_roles FROM anon, authenticated;
REVOKE SELECT ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 2. Explicit owner-scoped UPDATE/DELETE policies for the private KYC bucket
DROP POLICY IF EXISTS "kyc_documents_update_own" ON storage.objects;
CREATE POLICY "kyc_documents_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "kyc_documents_delete_own" ON storage.objects;
CREATE POLICY "kyc_documents_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
