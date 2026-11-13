import { stockReferenceQuantity } from "@/lib/stockReference";
import { roundStockQuantity, type StockLevel, type StockMovement } from "@/lib/stockData";
import { buildWeeklyAggregateTotals, MACARON_AGG_ID, MACARON_ARTICLES, AMANDES_AGG_ID, AMANDES_WEEKLY_ARTICLE, SIROP_AGG_ID, SIROP_CARAMEL_WEEKLY_ARTICLE, SIROP_CHOCOLAT_ALI_ID, type WeeklyTrackingOrderRecord } from "@/lib/stockWeeklyAggregates";
import { getStockRecipeAggregates, stockRecipePeriodTotals } from "@/lib/stockRecipeIngredients";
import type { MaterialActual } from "@/lib/materialVariance";

export interface MaterialStockTotals { stockInitial: number; entrees: number; sorties: number; stockRestant: number }
export interface MaterialStockReference { product_id: string; conversion: string; unit_ref: string }

/** Read-only period outputs, including PDV-specific and historical stock identities. */
export function buildMaterialStockActuals(
  levels: StockLevel[], movements: StockMovement[], start: string, end: string,
  references: MaterialStockReference[], mep: Record<string, number>, weeklyRows: WeeklyTrackingOrderRecord[],
  overrides: Record<string, MaterialStockTotals>,
): Record<string, MaterialActual> {
  const refs = new Map(references.map(row => [row.product_id, row]));
  const totals: Record<string, MaterialStockTotals> = {};
  for (const level of levels) totals[level.productId] = { stockInitial: 0, entrees: 0, sorties: 0, stockRestant: 0 };
  for (const movement of movements) {
    const date = movement.date.slice(0, 10);
    const row = totals[movement.productId];
    if (!row || date < start || date > end) continue;
    const quantity = roundStockQuantity(movement.quantity);
    if (movement.type === "entree") row.entrees += quantity;
    else row.sorties += quantity;
  }
  Object.assign(totals, overrides);
  const actuals: Record<string, MaterialActual> = {};
  const add = (id: string, name: string, category: string, outputs: number, nativeUnit: string) => {
    const quantity = roundStockQuantity(outputs - (mep[id] ?? 0));
    const ref = refs.get(id);
    const converted = stockReferenceQuantity(quantity, ref?.conversion ?? "");
    actuals[id] = { name, category, quantity: converted ?? quantity,
      unit: converted === null ? nativeUnit : ref?.unit_ref ?? nativeUnit,
      conversionMissing: converted === null };
  };
  for (const level of levels) add(level.productId, level.productName, level.category, totals[level.productId].sorties, level.unit);
  for (const row of stockRecipePeriodTotals(weeklyRows, start, end)) {
    totals[row.id] = row;
    // These are already the native quantities displayed by the Stock restant article rows.
    const ref = refs.get(row.id);
    if (ref) add(row.id, row.name, row.category, row.sorties, row.group === "Crème fraîche" ? "kg" : "STOCK");
    else actuals[row.id] = { name: row.name, category: row.category, quantity: row.sorties,
      unit: row.group === "Crème fraîche" ? "kg" : "STOCK" };
  }
  for (const aggregate of getStockRecipeAggregates(levels.map(row => ({ id: row.productId, name: row.productName })))) {
    const outputs = aggregate.sourceIds.reduce((sum, id) => sum + (totals[id]?.sorties ?? 0), 0);
    const nativeUnit = levels.find(row => aggregate.sourceIds.includes(row.productId))?.unit ?? "STOCK";
    add(aggregate.id, aggregate.name, aggregate.category, outputs, nativeUnit);
  }
  const weekly = (articles: readonly string[]) => buildWeeklyAggregateTotals(weeklyRows, articles, date => date >= start && date <= end, false, false, start);
  add(MACARON_AGG_ID, "MACARON (tous parfums)", "alimentaire", weekly(MACARON_ARTICLES).sorties, "PIECE");
  add(AMANDES_AGG_ID, "Amandes caramélisées", "alimentaire", weekly([AMANDES_WEEKLY_ARTICLE]).sorties, "kg");
  add(SIROP_AGG_ID, "Sirop caramel/chocolat", "alimentaire", weekly([SIROP_CARAMEL_WEEKLY_ARTICLE]).sorties + (totals[SIROP_CHOCOLAT_ALI_ID]?.sorties ?? 0), "kg");
  return actuals;
}