import { stockReferenceQuantity } from "@/lib/stockReference";
import { canonicalStockIngredientId } from "@/lib/stockRecipeIngredients";

export interface MaterialIngredient { recipe_id: string; product_id: string; category: string; quantity: number; unit: string; notes: string | null }
export interface MaterialRecipe { id: string; finished_product_id: string; version: number; active: boolean }
export interface MaterialActual { name: string; category: string; quantity: number | null; unit: string }
export interface MaterialResult { id: string; name: string; category: string; actual: number | null; theoretical: number; unit: string; actualUnit: string; variance: number | null; issue: string | null }

const unitKey = (unit: string) => {
  const key = unit.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  if (["KG", "KILO", "KILOGRAMME"].includes(key)) return "KG";
  if (["L", "LITRE", "LITRES"].includes(key)) return "L";
  if (["PIECE", "PIECES", "PCS", "P"].includes(key)) return "PCS";
  return key;
};
const round = (value: number) => Math.round(value * 10000) / 10000;

/** Same arithmetic as Stock restant's Sorties total Réf. column. */
export function materialActualReference(initial: number, receipts: number, remaining: number, miseEnPlace: number, conversion: string) {
  const outputs = Number((initial + receipts - (remaining + miseEnPlace)).toFixed(2));
  return stockReferenceQuantity(outputs, conversion);
}

/** Never mix incompatible ingredient units, guess links, or change recipe doses. */
export function computeMaterialVariance(recipes: MaterialRecipe[], ingredients: MaterialIngredient[], sales: Record<string, number>, actuals: Record<string, MaterialActual>): MaterialResult[] {
  const recipeProducts = new Map(recipes.filter(r => r.active).map(r => [r.id, r.finished_product_id]));
  const groups = new Map<string, { ingredient: MaterialIngredient; theoretical: number }>();
  for (const source of ingredients) {
    const ingredient = { ...source, product_id: canonicalStockIngredientId(source.product_id) };
    const product = recipeProducts.get(ingredient.recipe_id);
    if (!product) continue;
    const key = `${ingredient.product_id}:${unitKey(ingredient.unit)}`;
    const group = groups.get(key) ?? { ingredient, theoretical: 0 };
    const sold = sales[product] ?? 0;
    group.theoretical += (Number.isFinite(sold) && sold >= 0 ? sold : 0) * ingredient.quantity;
    groups.set(key, group);
  }
  return [...groups].map(([id, { ingredient, theoretical }]) => {
    const actual = actuals[ingredient.product_id];
    const compatible = !!actual && unitKey(actual.unit) === unitKey(ingredient.unit);
    const issue = !actual ? "Non lié au stock" : actual.quantity === null ? "Conversion Réf. manquante" : !compatible ? "Unités différentes" : null;
    return { id, name: actual?.name ?? ingredient.notes ?? ingredient.product_id.replace(/^custom:/, ""), category: actual?.category ?? ingredient.category,
      actual: actual?.quantity ?? null, theoretical: round(theoretical), unit: ingredient.unit === "UA" ? "UA" : ingredient.unit,
      actualUnit: actual?.unit ?? "", variance: issue ? null : round((actual?.quantity ?? 0) - theoretical), issue };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, "fr"));
}

export function materialSalesSection(end: string) { return `MATIERES:VENTES:${end}`; }