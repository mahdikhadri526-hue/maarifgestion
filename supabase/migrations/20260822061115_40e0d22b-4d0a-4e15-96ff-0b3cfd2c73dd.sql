CREATE INDEX IF NOT EXISTS idx_weekly_tracking_fiche_week ON public.weekly_tracking (fiche_type, week_start);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements (product_id);

CREATE OR REPLACE FUNCTION public.stock_movement_aggregates()
RETURNS TABLE (
  product_id text,
  entrees numeric,
  sorties numeric,
  regularisations_net numeric,
  entrees_all numeric,
  sorties_all numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    m.product_id,
    COALESCE(SUM(CASE WHEN m.type = 'entree' AND m.source IS DISTINCT FROM 'regularisation' THEN m.quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.type = 'sortie' AND m.source IS DISTINCT FROM 'regularisation' THEN m.quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.source = 'regularisation' THEN (CASE WHEN m.type = 'entree' THEN m.quantity ELSE -m.quantity END) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.quantity ELSE 0 END), 0)
  FROM public.stock_movements m
  GROUP BY m.product_id
$$;

GRANT EXECUTE ON FUNCTION public.stock_movement_aggregates() TO authenticated;