CREATE INDEX IF NOT EXISTS idx_stock_movements_pdv_created ON public.stock_movements (pdv_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_tracking_pdv_fiche_week ON public.weekly_tracking (pdv_id, fiche_type, week_start);
ANALYZE public.stock_movements;
ANALYZE public.weekly_tracking;