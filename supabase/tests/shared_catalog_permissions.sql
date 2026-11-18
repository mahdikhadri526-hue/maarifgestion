-- Read-only checks: authenticated recipe reads, admin-only writes and Realtime coverage.
SELECT
  NOT EXISTS (
    SELECT 1 FROM unnest(ARRAY['recipes','recipe_ingredients','finished_products','stock_product_groups','product_catalog']) t
    WHERE (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=t
      AND p.permissive='RESTRICTIVE' AND p.cmd IN ('INSERT','UPDATE','DELETE')
      AND coalesce(p.qual,p.with_check) LIKE '%can_manage_shared_catalog%') <> 3
  ) AS all_writes_admin_guarded,
  NOT EXISTS (
    SELECT 1 FROM unnest(ARRAY['recipes','recipe_ingredients','finished_products']) t
    WHERE NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=t
      AND p.policyname='shared_catalog_read' AND p.cmd='SELECT' AND p.qual='true')
  ) AS recipes_shared_for_consultation,
  (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime'
    AND schemaname='public' AND tablename IN ('recipes','recipe_ingredients','finished_products','stock_product_groups','product_catalog')) = 5 AS realtime_enabled,
  pg_get_functiondef('public.can_manage_shared_catalog()'::regprocedure) LIKE '%khadri1982@gmail.com%'
    AND pg_get_functiondef('public.can_manage_shared_catalog()'::regprocedure) LIKE '%has_role%'
    AS designated_admin_and_role_required;