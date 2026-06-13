
DROP POLICY IF EXISTS "Authenticated users can view cleaning_logs" ON public.cleaning_logs;
DROP POLICY IF EXISTS "Authenticated users can insert cleaning_logs" ON public.cleaning_logs;
DROP POLICY IF EXISTS "Authenticated users can update cleaning_logs" ON public.cleaning_logs;
DROP POLICY IF EXISTS "Authenticated users can delete cleaning_logs" ON public.cleaning_logs;
DROP POLICY IF EXISTS "cleaning_logs_select" ON public.cleaning_logs;
DROP POLICY IF EXISTS "cleaning_logs_insert" ON public.cleaning_logs;
DROP POLICY IF EXISTS "cleaning_logs_update" ON public.cleaning_logs;
DROP POLICY IF EXISTS "cleaning_logs_delete" ON public.cleaning_logs;

CREATE POLICY "cleaning_logs_select" ON public.cleaning_logs
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'view_cleaning'));

CREATE POLICY "cleaning_logs_insert" ON public.cleaning_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'edit_cleaning'));

CREATE POLICY "cleaning_logs_update" ON public.cleaning_logs
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'edit_cleaning'))
  WITH CHECK (public.has_permission(auth.uid(), 'edit_cleaning'));

CREATE POLICY "cleaning_logs_delete" ON public.cleaning_logs
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'delete_cleaning'));
