import { WEEKLY_FRUIT_ARTICLES } from "@/lib/weeklyArticles";
import { buildWeeklyAggregateTotals, CHANTILLY_AGG_ID, CHANTILLY_WEEKLY_ARTICLE, type WeeklyTrackingOrderRecord } from "@/lib/stockWeeklyAggregates";

// Exact article identities displayed by Stock restant, including its historical tartes.
export const STOCK_TARTE_ARTICLES = [
  "Tarte 6", "Tarte 8", "Tarte 10", "Tte Sp.", "Tte.Sp 8", "Tte Mac.", "Tte Sor.",
  "Tche Sor.", "Tche Mac.", "Tche Nap.", "Bûche", "Bûche Sp.", "N.F", "Demis",
  "Maria Louisa", "Maria mangue", "Maria framboise", "Maria reglisse", "M.Loulou", "Chanty.Fruit confits", "Panachés",
  "Mac.Chocolat P", "Mac.Pistache P", "Mac.Caramel P", "Mac.Cfé P", "Mac.Mng P", "Mac.Cit P",
  "Mac.Chocolat N", "Mac.Pistache N", "Mac.Caramel N", "Mac.Cfé N", "Mac.Mng N", "Mac.Cit N",
  "Chantilly,F,C", "Cho.Logo", "PJA", "Cho.Blnc", "Amd.Crml", "Sirop.Blc", "Sirop.Crml",
  "Merg.trt", "Merg.Pt KG", "Merg.Pt SCH", "Merg.Glacé", "Org.Confit", "Biscuit",
  "Bigarreaux", "Cake Chocolat", "Cake.citron", "Pain Savoi", "Brownies.G", "Brownies.Top",
  "Amandes.Top", "Noix.Top", "Tulipes", "Cornet", "Gaufrette",
];

export const stockRecipeGroups = [
  { label: "Tartes", items: STOCK_TARTE_ARTICLES },
  { label: "Fruits", items: WEEKLY_FRUIT_ARTICLES },
  { label: "Crème fraîche", items: [CHANTILLY_WEEKLY_ARTICLE] },
];
export const stockRecipeIngredientId = (article: string) => article === CHANTILLY_WEEKLY_ARTICLE ? CHANTILLY_AGG_ID : article;
export const stockRecipeIngredients = stockRecipeGroups.flatMap(group => group.items.map(name => ({
  id: stockRecipeIngredientId(name), name, category: "alimentaire" as const, group: group.label,
})));

/** Compatibility for the short-lived recipe links, without rewriting stored recipes. */
export function canonicalStockIngredientId(id: string) {
  if (!id.startsWith("weekly:")) return id;
  const article = id.slice(7);
  return stockRecipeIngredients.some(row => row.name === article) ? stockRecipeIngredientId(article) : id;
}

/** Same period and next-day count context as the corresponding Stock restant rows. */
export function stockRecipePeriodTotals(rows: WeeklyTrackingOrderRecord[], start: string, end: string) {
  return stockRecipeIngredients.map(product => ({
    ...product,
    ...buildWeeklyAggregateTotals(rows, [product.name], date => date >= start && date <= end, false, false, start),
  }));
}