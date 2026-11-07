CREATE OR REPLACE FUNCTION public.sync_recipe_ingredient_units(_changes jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  change_row record;
  changed_count integer := 0;
  affected integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'edit_recipes') THEN
    RAISE EXCEPTION 'Modification des recettes non autorisée' USING ERRCODE = '42501';
  END IF;
  IF _changes IS NULL OR jsonb_typeof(_changes) <> 'array' THEN
    RAISE EXCEPTION 'Liste des unités invalide';
  END IF;
  FOR change_row IN SELECT * FROM jsonb_to_recordset(_changes) AS x(product_id text, category text, unit text)
  LOOP
    IF change_row.product_id IS NULL OR change_row.category IS NULL OR change_row.unit IS NULL
      OR change_row.unit NOT IN ('PIECE','KILO','LITRE','PAQUET','COLIS','ROULEAU','UA') THEN
      RAISE EXCEPTION 'Unité ingrédient invalide';
    END IF;
    UPDATE public.recipe_ingredients ri
      SET unit = change_row.unit
      FROM public.recipes r
      WHERE r.id = ri.recipe_id AND r.active
        AND ri.product_id = change_row.product_id
        AND ri.category = change_row.category
        AND ri.unit IS DISTINCT FROM change_row.unit;
    GET DIAGNOSTICS affected = ROW_COUNT;
    changed_count := changed_count + affected;
  END LOOP;
  RETURN changed_count;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_recipe_ingredient_units(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_recipe_ingredient_units(jsonb) TO authenticated;