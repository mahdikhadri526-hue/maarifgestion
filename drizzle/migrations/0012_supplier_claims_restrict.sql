DROP POLICY IF EXISTS "read supplier claims" ON public.supplier_claims;
CREATE POLICY "read supplier claims" ON public.supplier_claims FOR SELECT TO authenticated
  USING (public.is_quality_account(auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "supplier claims photos read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'supplier-claims' AND (public.is_quality_account(auth.uid()) OR public.is_admin(auth.uid())));
CREATE POLICY "supplier claims photos write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supplier-claims' AND public.is_quality_account(auth.uid()));
CREATE POLICY "supplier claims photos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'supplier-claims' AND public.is_quality_account(auth.uid()));