export type RecipeIngredientLink = {
  source_product_id: string;
  source_category: string;
  product_id: string;
  category: string;
};

export function relinkRecipeIngredients<T extends { product_id: string; category: string; notes: string | null }>(
  ingredients: T[], change: RecipeIngredientLink,
): T[] {
  return ingredients.map(row => row.product_id === change.source_product_id && row.category === change.source_category
    ? { ...row, product_id: change.product_id, category: change.category, notes: null }
    : row);
}