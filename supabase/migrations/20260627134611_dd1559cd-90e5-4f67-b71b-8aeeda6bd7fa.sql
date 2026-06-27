DROP POLICY IF EXISTS "auth insert movements" ON public.stock_movements;
CREATE POLICY "auth insert movements"
ON public.stock_movements
FOR INSERT
TO public
WITH CHECK (
  public.has_permission(auth.uid(), 'edit_movements')
  OR (
    public.has_permission(auth.uid(), 'edit_remaining_stock')
    AND source = 'regularisation'
  )
);