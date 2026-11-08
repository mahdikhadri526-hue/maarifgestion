CREATE OR REPLACE FUNCTION public.sync_recipe_ingredient_links(_changes jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE c record; affected integer; total integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'edit_recipes') THEN
    RAISE EXCEPTION 'Modification des recettes non autorisée' USING ERRCODE = '42501';
  END IF;
  IF _changes IS NULL OR jsonb_typeof(_changes) <> 'array' THEN
    RAISE EXCEPTION 'Liste des liaisons invalide';
  END IF;
  FOR c IN SELECT * FROM jsonb_to_recordset(_changes) AS x(source_product_id text, source_category text, product_id text, category text)
  LOOP
    IF nullif(btrim(c.source_product_id), '') IS NULL OR nullif(btrim(c.product_id), '') IS NULL
      OR c.source_category IS NULL OR c.category IS NULL OR c.product_id LIKE 'custom:%' OR c.product_id LIKE 'weekly:%' THEN
      RAISE EXCEPTION 'Liaison ingrédient invalide';
    END IF;
    UPDATE public.recipe_ingredients ri
    SET product_id = c.product_id, category = c.category, notes = NULL
    FROM public.recipes r
    WHERE r.id = ri.recipe_id AND r.active
      AND NOT EXISTS (SELECT 1 FROM public.recipes newer WHERE newer.finished_product_id = r.finished_product_id AND newer.active AND newer.version > r.version)
      AND ri.product_id = c.source_product_id AND ri.category = c.source_category;
    GET DIAGNOSTICS affected = ROW_COUNT;
    total := total + affected;
  END LOOP;
  RETURN total;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_recipe_ingredient_links(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_recipe_ingredient_links(jsonb) TO authenticated, service_role;