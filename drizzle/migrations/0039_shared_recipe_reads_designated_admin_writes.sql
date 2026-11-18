CREATE OR REPLACE FUNCTION public.can_manage_shared_catalog()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') AND lower(coalesce(auth.jwt()->>'email', '')) = 'khadri1982@gmail.com';
$$;
REVOKE ALL ON FUNCTION public.can_manage_shared_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_shared_catalog() TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes, public.recipe_ingredients, public.finished_products, public.stock_product_groups, public.product_catalog TO authenticated;
GRANT ALL ON public.recipes, public.recipe_ingredients, public.finished_products, public.stock_product_groups, public.product_catalog TO service_role;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['recipes','recipe_ingredients','finished_products'] LOOP
  EXECUTE format('CREATE POLICY shared_catalog_read ON public.%I FOR SELECT TO authenticated USING (true)', t);
  EXECUTE format('CREATE POLICY shared_catalog_admin ON public.%I FOR ALL TO authenticated USING (public.can_manage_shared_catalog()) WITH CHECK (public.can_manage_shared_catalog())', t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['recipes','recipe_ingredients','finished_products','stock_product_groups','product_catalog'] LOOP
  EXECUTE format('CREATE POLICY shared_catalog_insert_guard ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.can_manage_shared_catalog())', t);
  EXECUTE format('CREATE POLICY shared_catalog_update_guard ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.can_manage_shared_catalog()) WITH CHECK (public.can_manage_shared_catalog())', t);
  EXECUTE format('CREATE POLICY shared_catalog_delete_guard ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.can_manage_shared_catalog())', t);
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
   EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
  END IF;
 END LOOP;
END $$;
CREATE POLICY shared_catalog_admin_pdv ON public.stock_product_groups FOR ALL TO authenticated USING (public.can_manage_shared_catalog() AND public.can_access_pdv(auth.uid(), pdv_id)) WITH CHECK (public.can_manage_shared_catalog() AND public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY shared_catalog_admin_pdv ON public.product_catalog FOR ALL TO authenticated USING (public.can_manage_shared_catalog() AND public.can_access_pdv(auth.uid(), pdv_id)) WITH CHECK (public.can_manage_shared_catalog() AND public.can_access_pdv(auth.uid(), pdv_id));