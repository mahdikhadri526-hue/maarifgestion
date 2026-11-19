DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['recipes','recipe_ingredients','finished_products'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS shared_catalog_read ON public.%I', t);
  EXECUTE format('CREATE POLICY shared_catalog_read ON public.%I FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()))', t);
END LOOP; END $$;
DROP POLICY IF EXISTS stock_groups_shared_read ON public.stock_product_groups;
CREATE POLICY stock_groups_shared_read ON public.stock_product_groups FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS "tech videos upload" ON storage.objects;
CREATE POLICY "tech videos upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tech-videos' AND owner_id = (select auth.uid()::text));