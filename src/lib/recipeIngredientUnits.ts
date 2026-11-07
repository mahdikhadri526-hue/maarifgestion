export type RecipeUnitIngredient = {
  product_id: string;
  category: string;
  unit: string;
};

export function changedRecipeIngredientUnits(
  original: RecipeUnitIngredient[],
  edited: RecipeUnitIngredient[],
): RecipeUnitIngredient[] {
  const changes = new Map<string, RecipeUnitIngredient>();
  for (const ingredient of edited) {
    const previous = original.find(row => row.product_id === ingredient.product_id && row.category === ingredient.category);
    if (previous && previous.unit !== ingredient.unit) {
      changes.set(JSON.stringify([ingredient.product_id, ingredient.category]), {
        product_id: ingredient.product_id,
        category: ingredient.category,
        unit: ingredient.unit,
      });
    }
  }
  return [...changes.values()];
}