-- Run through the read-only database query tool after the recipe update.
-- Only the existing Stock restant crème fraîche reference is targeted.
SELECT
  (SELECT count(*) FROM recipes r WHERE r.active AND EXISTS (
    SELECT 1 FROM recipe_ingredients cream
    WHERE cream.recipe_id = r.id AND cream.product_id = '__chantilly_agg__'
  )) = 64 AS expected_target_recipes,
  NOT EXISTS (
    SELECT 1 FROM recipes r
    WHERE r.active AND EXISTS (
      SELECT 1 FROM recipe_ingredients cream
      WHERE cream.recipe_id = r.id AND cream.product_id = '__chantilly_agg__'
    ) AND (
      SELECT count(*) FROM recipe_ingredients gas
      WHERE gas.recipe_id = r.id AND gas.product_id = 'ali-44'
        AND gas.quantity = 0.024 AND gas.unit = 'KILO'
        AND gas.category = 'alimentaire' AND gas.notes = 'Protoxyde'
    ) <> 1
  ) AS every_cream_recipe_has_correct_protoxyde;