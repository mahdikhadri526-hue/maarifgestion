
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at_desc ON public.stock_movements (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_category_type ON public.stock_movements (category, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_tracking_fiche_type ON public.weekly_tracking (fiche_type, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_autocontrols_control_date_desc ON public.autocontrols (control_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requisitions_date_type ON public.requisitions (date DESC, type);
CREATE INDEX IF NOT EXISTS idx_lot_entries_product_id ON public.lot_entries (product_id, expiry_date);
ANALYZE public.stock_movements;
ANALYZE public.weekly_tracking;
ANALYZE public.autocontrols;
