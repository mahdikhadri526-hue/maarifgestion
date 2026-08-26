CREATE OR REPLACE FUNCTION public.stock_movement_aggregates(_pdv_id uuid)
RETURNS TABLE(
  product_id text,
  product_name text,
  category text,
  entrees numeric,
  sorties numeric,
  regularisations_net numeric,
  entrees_all numeric,
  sorties_all numeric
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_access_pdv(auth.uid(), _pdv_id) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  RETURN QUERY
  SELECT
    m.product_id,
    (array_agg(m.product_name ORDER BY m.created_at DESC))[1]::text AS product_name,
    (array_agg(m.category ORDER BY m.created_at DESC))[1]::text AS category,
    COALESCE(SUM(CASE WHEN m.type = 'entree' AND m.source IS DISTINCT FROM 'regularisation' THEN m.quantity ELSE 0::integer END), 0::bigint)::numeric AS entrees,
    COALESCE(SUM(CASE WHEN m.type = 'sortie' AND m.source IS DISTINCT FROM 'regularisation' THEN m.quantity ELSE 0::integer END), 0::bigint)::numeric AS sorties,
    COALESCE(SUM(CASE WHEN m.source = 'regularisation' THEN CASE WHEN m.type = 'entree' THEN m.quantity ELSE -m.quantity END ELSE 0::integer END), 0::bigint)::numeric AS regularisations_net,
    COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.quantity ELSE 0::integer END), 0::bigint)::numeric AS entrees_all,
    COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.quantity ELSE 0::integer END), 0::bigint)::numeric AS sorties_all
  FROM public.stock_movements m
  WHERE m.pdv_id = _pdv_id
  GROUP BY m.product_id;
END;
$function$;