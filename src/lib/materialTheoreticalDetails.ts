import { canonicalStockIngredientId } from "@/lib/stockRecipeIngredients";
import type { MaterialIngredient, MaterialRecipe } from "@/lib/materialVariance";

export interface TheoreticalContribution {
  productId: string;
  sold: number;
  dose: number;
  unit: string;
  usage: number;
}

/** Read-only explanation of the existing theoretical calculation, not a replacement calculation. */
export function materialTheoreticalDetails(
  resultId: string,
  recipes: MaterialRecipe[],
  ingredients: MaterialIngredient[],
  sales: Record<string, number>,
): TheoreticalContribution[] {
  const ingredientId = resultId.slice(0, resultId.lastIndexOf(":"));
  const products = new Map(recipes.filter(recipe => recipe.active).map(recipe => [recipe.id, recipe.finished_product_id]));
  return ingredients.flatMap(ingredient => {
    if (canonicalStockIngredientId(ingredient.product_id) !== ingredientId) return [];
    const productId = products.get(ingredient.recipe_id);
    if (!productId) return [];
    const sold = sales[productId] ?? 0;
    if (!Number.isFinite(sold) || sold <= 0) return [];
    return [{ productId, sold, dose: ingredient.quantity, unit: ingredient.unit === "STOCK" ? "Unité stock" : ingredient.unit, usage: sold * ingredient.quantity }];
  });
}