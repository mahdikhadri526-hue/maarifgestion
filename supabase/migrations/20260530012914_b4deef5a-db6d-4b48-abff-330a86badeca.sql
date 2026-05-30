-- Nomenclature: produits finis & recettes (structure uniquement, aucune donnée existante modifiée)

-- 1. Produits finis
CREATE TABLE public.finished_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'PIECE',
  category text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finished_products TO authenticated;
GRANT ALL ON public.finished_products TO service_role;

ALTER TABLE public.finished_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth select finished_products" ON public.finished_products
  FOR SELECT USING (has_permission(auth.uid(), 'view_recipes'));
CREATE POLICY "auth insert finished_products" ON public.finished_products
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'edit_recipes'));
CREATE POLICY "auth update finished_products" ON public.finished_products
  FOR UPDATE USING (has_permission(auth.uid(), 'edit_recipes'));
CREATE POLICY "auth delete finished_products" ON public.finished_products
  FOR DELETE USING (has_permission(auth.uid(), 'edit_recipes'));

CREATE TRIGGER update_finished_products_updated_at
  BEFORE UPDATE ON public.finished_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Recettes (en-tête)
CREATE TABLE public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  finished_product_id uuid NOT NULL REFERENCES public.finished_products(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  yield_quantity numeric NOT NULL DEFAULT 1,
  yield_unit text NOT NULL DEFAULT 'PIECE',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (finished_product_id, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth select recipes" ON public.recipes
  FOR SELECT USING (has_permission(auth.uid(), 'view_recipes'));
CREATE POLICY "auth insert recipes" ON public.recipes
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'edit_recipes'));
CREATE POLICY "auth update recipes" ON public.recipes
  FOR UPDATE USING (has_permission(auth.uid(), 'edit_recipes'));
CREATE POLICY "auth delete recipes" ON public.recipes
  FOR DELETE USING (has_permission(auth.uid(), 'edit_recipes'));

CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Ingrédients de recette (lien vers initial_stocks via product_id text)
CREATE TABLE public.recipe_ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  category text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL DEFAULT 'PIECE',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_ingredients_recipe ON public.recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_product ON public.recipe_ingredients(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ingredients TO authenticated;
GRANT ALL ON public.recipe_ingredients TO service_role;

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth select recipe_ingredients" ON public.recipe_ingredients
  FOR SELECT USING (has_permission(auth.uid(), 'view_recipes'));
CREATE POLICY "auth insert recipe_ingredients" ON public.recipe_ingredients
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'edit_recipes'));
CREATE POLICY "auth update recipe_ingredients" ON public.recipe_ingredients
  FOR UPDATE USING (has_permission(auth.uid(), 'edit_recipes'));
CREATE POLICY "auth delete recipe_ingredients" ON public.recipe_ingredients
  FOR DELETE USING (has_permission(auth.uid(), 'edit_recipes'));

-- 4. Déclarations de production (phase 2 — table prête, alimentée plus tard)
CREATE TABLE public.production_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date text NOT NULL,
  finished_product_id uuid NOT NULL REFERENCES public.finished_products(id) ON DELETE RESTRICT,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  quantity_produced numeric NOT NULL,
  performed_by text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_production_entries_date ON public.production_entries(date);
CREATE INDEX idx_production_entries_product ON public.production_entries(finished_product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_entries TO authenticated;
GRANT ALL ON public.production_entries TO service_role;

ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth select production" ON public.production_entries
  FOR SELECT USING (has_permission(auth.uid(), 'view_recipes'));
CREATE POLICY "auth insert production" ON public.production_entries
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'edit_recipes'));
CREATE POLICY "auth update production" ON public.production_entries
  FOR UPDATE USING (has_permission(auth.uid(), 'edit_recipes'));
CREATE POLICY "auth delete production" ON public.production_entries
  FOR DELETE USING (has_permission(auth.uid(), 'edit_recipes'));