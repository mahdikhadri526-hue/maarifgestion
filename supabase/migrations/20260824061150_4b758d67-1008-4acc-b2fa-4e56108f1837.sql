CREATE OR REPLACE FUNCTION public.stock_movement_aggregates(_pdv_id uuid)
RETURNS TABLE(product_id text, entrees numeric, sorties numeric, regularisations_net numeric, entrees_all numeric, sorties_all numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_pdv(auth.uid(), _pdv_id) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  RETURN QUERY
  SELECT
    m.product_id,
    COALESCE(SUM(CASE WHEN m.type = 'entree' AND m.source IS DISTINCT FROM 'regularisation' THEN m.quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.type = 'sortie' AND m.source IS DISTINCT FROM 'regularisation' THEN m.quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.source = 'regularisation' THEN CASE WHEN m.type = 'entree' THEN m.quantity ELSE -m.quantity END ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.quantity ELSE 0 END), 0)
  FROM public.stock_movements m
  WHERE m.pdv_id = _pdv_id
  GROUP BY m.product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.stock_movement_aggregates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_movement_aggregates(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.stock_period_aggregates(
  _pdv_id uuid,
  _start_date date,
  _end_date date
)
RETURNS TABLE(product_id text, stock_initial numeric, entrees numeric, sorties numeric, stock_restant numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_pdv(auth.uid(), _pdv_id) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  RETURN QUERY
  WITH movement_totals AS (
    SELECT
      m.product_id,
      COALESCE(SUM(m.quantity) FILTER (WHERE m.date::date < _start_date AND m.type = 'entree'), 0) AS before_entrees,
      COALESCE(SUM(m.quantity) FILTER (WHERE m.date::date < _start_date AND m.type = 'sortie'), 0) AS before_sorties,
      COALESCE(SUM(m.quantity) FILTER (WHERE m.date::date BETWEEN _start_date AND _end_date AND m.type = 'entree'), 0) AS period_entrees,
      COALESCE(SUM(m.quantity) FILTER (WHERE m.date::date BETWEEN _start_date AND _end_date AND m.type = 'sortie'), 0) AS period_sorties
    FROM public.stock_movements m
    WHERE m.pdv_id = _pdv_id
      AND m.date::date <= _end_date
    GROUP BY m.product_id
  ), product_ids AS (
    SELECT i.product_id FROM public.initial_stocks i WHERE i.pdv_id = _pdv_id
    UNION
    SELECT mt.product_id FROM movement_totals mt
  )
  SELECT
    p.product_id,
    COALESCE(i.quantity, 0) + COALESCE(mt.before_entrees, 0) - COALESCE(mt.before_sorties, 0),
    COALESCE(mt.period_entrees, 0),
    COALESCE(mt.period_sorties, 0),
    COALESCE(i.quantity, 0) + COALESCE(mt.before_entrees, 0) - COALESCE(mt.before_sorties, 0)
      + COALESCE(mt.period_entrees, 0) - COALESCE(mt.period_sorties, 0)
  FROM product_ids p
  LEFT JOIN public.initial_stocks i ON i.pdv_id = _pdv_id AND i.product_id = p.product_id
  LEFT JOIN movement_totals mt ON mt.product_id = p.product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.stock_period_aggregates(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_period_aggregates(uuid, date, date) TO service_role;

CREATE OR REPLACE FUNCTION public.weekly_tracking_filtered(
  _pdv_id uuid,
  _fiche_type text,
  _articles text[] DEFAULT NULL,
  _from_week date DEFAULT NULL,
  _to_week date DEFAULT NULL
)
RETURNS TABLE(article text, entrees numeric, sorties numeric, stock_initial numeric, day_of_week text, week_start text, row_index integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_pdv(auth.uid(), _pdv_id) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  RETURN QUERY
  SELECT w.article, w.entrees, w.sorties, w.stock_initial, w.day_of_week, w.week_start, w.row_index
  FROM public.weekly_tracking w
  WHERE w.pdv_id = _pdv_id
    AND w.fiche_type = _fiche_type
    AND (_articles IS NULL OR w.article = ANY(_articles))
    AND (_from_week IS NULL OR w.week_start::date >= _from_week)
    AND (_to_week IS NULL OR w.week_start::date <= _to_week);
END;
$$;

GRANT EXECUTE ON FUNCTION public.weekly_tracking_filtered(uuid, text, text[], date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_tracking_filtered(uuid, text, text[], date, date) TO service_role;

CREATE INDEX IF NOT EXISTS idx_stock_movements_pdv_date_product_type
  ON public.stock_movements (pdv_id, date, product_id, type);
CREATE INDEX IF NOT EXISTS idx_weekly_tracking_pdv_fiche_article_week
  ON public.weekly_tracking (pdv_id, fiche_type, article, week_start);