DROP POLICY IF EXISTS "auth insert lots" ON public.lot_entries;
CREATE POLICY "auth insert lots" ON public.lot_entries
  FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'edit_lots')
    OR public.has_permission(auth.uid(), 'edit_movements')
  );

DROP POLICY IF EXISTS "auth select lots" ON public.lot_entries;
CREATE POLICY "auth select lots" ON public.lot_entries
  FOR SELECT
  USING (
    public.has_permission(auth.uid(), 'view_lots')
    OR public.has_permission(auth.uid(), 'view_movements')
    OR public.has_permission(auth.uid(), 'edit_movements')
  );

DROP POLICY IF EXISTS "auth update lots" ON public.lot_entries;
CREATE POLICY "auth update lots" ON public.lot_entries
  FOR UPDATE
  USING (
    public.has_permission(auth.uid(), 'edit_lots')
    OR public.has_permission(auth.uid(), 'edit_movements')
  );