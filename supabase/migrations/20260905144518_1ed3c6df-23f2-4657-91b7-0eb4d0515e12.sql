-- 1) Liste des PDV rattachés à un utilisateur (lecture directe, sans RLS)
CREATE OR REPLACE FUNCTION public.user_pdv_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT up.pdv_id FROM public.user_pdvs up WHERE _user_id IS NOT NULL AND up.user_id = _user_id
$$;
GRANT EXECUTE ON FUNCTION public.user_pdv_ids(uuid) TO authenticated, service_role;

-- 2) Helper temporaire de réécriture des expressions de politique
CREATE OR REPLACE FUNCTION pg_temp.rewrite_policy_expr(expr text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  cap_expr text := '(pdv_id IS NOT NULL AND ((SELECT public.is_admin(auth.uid())) OR pdv_id IN (SELECT public.user_pdv_ids(auth.uid()))))';
BEGIN
  IF expr IS NULL THEN RETURN NULL; END IF;
  expr := replace(expr, 'can_access_pdv(auth.uid(), pdv_id)', '@@CAP@@');
  expr := regexp_replace(expr, '(?<![\w.])(is_admin|is_regional_admin|can_manage_inventory)\(auth\.uid\(\)\)', '(SELECT public.\1(auth.uid()))', 'g');
  expr := regexp_replace(expr, '(?<![\w.])(has_permission|has_role)\(auth\.uid\(\), (''[A-Za-z_]+''::[a-z_]+)\)', '(SELECT public.\1(auth.uid(), \2))', 'g');
  expr := replace(expr, '@@CAP@@', cap_expr);
  RETURN expr;
END;
$$;

DO $$
DECLARE
  r record;
  new_qual text;
  new_wc text;
BEGIN
  FOR r IN
    SELECT c.relname, p.polname,
           pg_get_expr(p.polqual, p.polrelid) AS q,
           pg_get_expr(p.polwithcheck, p.polrelid) AS wc
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relnamespace = 'public'::regnamespace
  LOOP
    new_qual := pg_temp.rewrite_policy_expr(r.q);
    new_wc := pg_temp.rewrite_policy_expr(r.wc);
    IF new_qual IS DISTINCT FROM r.q OR new_wc IS DISTINCT FROM r.wc THEN
      IF new_qual IS NOT NULL AND new_wc IS NOT NULL THEN
        EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)', r.polname, r.relname, new_qual, new_wc);
      ELSIF new_qual IS NOT NULL THEN
        EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', r.polname, r.relname, new_qual);
      ELSE
        EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.polname, r.relname, new_wc);
      END IF;
    END IF;
  END LOOP;
END $$;

DROP FUNCTION pg_temp.rewrite_policy_expr(text);

-- 3) Agrégats de mouvements : contrôle d'accès explicite puis calcul sans RLS
CREATE OR REPLACE FUNCTION public.stock_movement_aggregates(_pdv_id uuid)
RETURNS TABLE(product_id text, product_name text, category text, entrees numeric, sorties numeric, regularisations_net numeric, entrees_all numeric, sorties_all numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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