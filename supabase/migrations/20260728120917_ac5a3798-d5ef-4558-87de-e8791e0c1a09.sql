GRANT SELECT, INSERT, UPDATE, DELETE ON public.lot_entries TO authenticated;
GRANT ALL ON public.lot_entries TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;