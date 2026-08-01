DROP POLICY IF EXISTS "glace_storage_capacity_select" ON public.glace_storage_capacity;
DROP POLICY IF EXISTS "glace_storage_capacity_write" ON public.glace_storage_capacity;
DROP POLICY IF EXISTS "Authenticated can read capacity" ON public.glace_storage_capacity;
DROP POLICY IF EXISTS "Authenticated can write capacity" ON public.glace_storage_capacity;
DROP POLICY IF EXISTS "Authenticated can manage capacity" ON public.glace_storage_capacity;

CREATE POLICY "capacity_select_authenticated" ON public.glace_storage_capacity
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "capacity_insert_admin" ON public.glace_storage_capacity
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "capacity_update_admin" ON public.glace_storage_capacity
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "capacity_delete_admin" ON public.glace_storage_capacity
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));