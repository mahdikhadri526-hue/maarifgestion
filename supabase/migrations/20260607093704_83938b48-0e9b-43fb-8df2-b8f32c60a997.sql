CREATE TABLE public.stock_ref_conversions (
  product_id TEXT PRIMARY KEY,
  conversion TEXT NOT NULL DEFAULT '',
  unit_ref TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_ref_conversions TO authenticated;
GRANT ALL ON public.stock_ref_conversions TO service_role;
ALTER TABLE public.stock_ref_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth select ref" ON public.stock_ref_conversions FOR SELECT USING (has_permission(auth.uid(), 'view_stock'));
CREATE POLICY "auth insert ref" ON public.stock_ref_conversions FOR INSERT WITH CHECK (has_permission(auth.uid(), 'edit_stock'));
CREATE POLICY "auth update ref" ON public.stock_ref_conversions FOR UPDATE USING (has_permission(auth.uid(), 'edit_stock'));
CREATE POLICY "auth delete ref" ON public.stock_ref_conversions FOR DELETE USING (has_permission(auth.uid(), 'edit_stock'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_ref_conversions;