import { stockReferenceQuantity } from "@/lib/stockReference";
import { roundStockQuantity, type StockLevel, type StockMovement } from "@/lib/stockData";
import { buildWeeklyAggregateTotals, MACARON_AGG_ID, MACARON_ARTICLES, AMANDES_AGG_ID, AMANDES_WEEKLY_ARTICLE, SIROP_AGG_ID, SIROP_CARAMEL_WEEKLY_ARTICLE, SIROP_CHOCOLAT_ALI_ID, type WeeklyTrackingOrderRecord } from "@/lib/stockWeeklyAggregates";
import { getStockRecipeAggregates, stockRecipePeriodTotals } from "@/lib/stockRecipeIngredients";
import type { MaterialActual } from "@/lib/materialVariance";

export interface MaterialStockTotals { stockInitial: number; entrees: number; sorties: number; stockRestant: number }
export interface MaterialStockReference { product_id: string; conversion: string; unit_ref: string }

/** Read-only explanation of one source line inside the actual usage calculation. */
export interface MaterialActualLine {
  name: string;
  sorties: number;
  miseEnPlace: number;
  sortiesTotal: number;
  nativeUnit: string;
  conversion: string;
  converted: number | null;
  unitRef: string;
}

/** Read-only breakdown of the existing actual usage; never a replacement calculation. */
export interface MaterialActualDetail {
  lines: MaterialActualLine[];
  totalSorties: number;
  nativeUnit: string;
  conversion: string;
  total: number | null;
  unit: string;
  conversionMissing: boolean;
}

function computeMaterialStockActuals(
  levels: StockLevel[], movements: StockMovement[], start: string, end: string,
  references: MaterialStockReference[], mep: Record<string, number>, weeklyRows: WeeklyTrackingOrderRecord[],
  overrides: Record<string, MaterialStockTotals>,
  stockUnits: Record<string, string> = {},
): { actuals: Record<string, MaterialActual>; details: Record<string, MaterialActualDetail> } {
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
  const details: Record<string, MaterialActualDetail> = {};
  const add = (id: string, name: string, category: string, outputs: number, nativeUnit: string,
    sources?: { name: string; sorties: number }[]) => {
    const miseEnPlace = mep[id] ?? 0;
    const quantity = roundStockQuantity(outputs - miseEnPlace);
    const ref = refs.get(id);
    const converted = stockReferenceQuantity(quantity, ref?.conversion ?? "");
    actuals[id] = { name, category, quantity: converted ?? quantity,
      unit: converted === null ? nativeUnit : ref?.unit_ref ?? nativeUnit,
      conversionMissing: converted === null };
    const lines: MaterialActualLine[] = (sources ?? [{ name, sorties: outputs }]).map((source, index) => ({
      name: source.name,
      sorties: roundStockQuantity(source.sorties),
      miseEnPlace: index === 0 ? miseEnPlace : 0,
      sortiesTotal: roundStockQuantity(source.sorties - (index === 0 ? miseEnPlace : 0)),
      nativeUnit,
      conversion: "",
      converted: null,
      unitRef: nativeUnit,
    }));
    details[id] = { lines, totalSorties: quantity, nativeUnit,
      conversion: ref?.conversion ?? "", total: actuals[id].quantity, unit: actuals[id].unit,
      conversionMissing: converted === null };
  };
  for (const level of levels) add(level.productId, level.productName, level.category, totals[level.productId].sorties, level.unit);
  for (const row of stockRecipePeriodTotals(weeklyRows, start, end)) {
    totals[row.id] = row;
    // These are already the native quantities displayed by the Stock restant article rows.
    const ref = refs.get(row.id);
    const nativeUnit = stockUnits[row.id] ?? (row.group === "Crème fraîche" ? "kg" : "STOCK");
    if (ref) add(row.id, row.name, row.category, row.sorties, nativeUnit);
    else {
      actuals[row.id] = { name: row.name, category: row.category, quantity: row.sorties,
        unit: nativeUnit };
      details[row.id] = { lines: [{ name: row.name, sorties: row.sorties, miseEnPlace: 0, sortiesTotal: row.sorties, nativeUnit, conversion: "", converted: null, unitRef: nativeUnit }],
        totalSorties: row.sorties, nativeUnit, conversion: "", total: row.sorties, unit: nativeUnit, conversionMissing: false };
    }
  }
  for (const aggregate of getStockRecipeAggregates(levels.map(row => ({ id: row.productId, name: row.productName })))) {
    const nativeUnit = levels.find(row => aggregate.sourceIds.includes(row.productId))?.unit ?? "STOCK";
    const sources = aggregate.sourceIds.map(id => {
      const level = levels.find(row => row.productId === id);
      return { name: level?.productName ?? id, sorties: totals[id]?.sorties ?? 0 };
    });
    add(aggregate.id, aggregate.name, aggregate.category, sources.reduce((sum, source) => sum + source.sorties, 0), nativeUnit, sources);
  }
  const weekly = (articles: readonly string[]) => buildWeeklyAggregateTotals(weeklyRows, articles, date => date >= start && date <= end, false, false, start);
  add(MACARON_AGG_ID, "MACARON (tous parfums)", "alimentaire", weekly(MACARON_ARTICLES).sorties, "PIECE");
  add(AMANDES_AGG_ID, "Amandes caramélisées", "alimentaire", weekly([AMANDES_WEEKLY_ARTICLE]).sorties, "kg");
  add(SIROP_AGG_ID, "Sirop caramel/chocolat", "alimentaire", weekly([SIROP_CARAMEL_WEEKLY_ARTICLE]).sorties + (totals[SIROP_CHOCOLAT_ALI_ID]?.sorties ?? 0), "kg",
    [{ name: SIROP_CARAMEL_WEEKLY_ARTICLE, sorties: weekly([SIROP_CARAMEL_WEEKLY_ARTICLE]).sorties }, { name: "Sirop chocolat", sorties: totals[SIROP_CHOCOLAT_ALI_ID]?.sorties ?? 0 }]);
  return { actuals, details };
}

/** Read-only period outputs, including PDV-specific and historical stock identities. */
export function buildMaterialStockActuals(
  levels: StockLevel[], movements: StockMovement[], start: string, end: string,
  references: MaterialStockReference[], mep: Record<string, number>, weeklyRows: WeeklyTrackingOrderRecord[],
  overrides: Record<string, MaterialStockTotals>,
  stockUnits: Record<string, string> = {},
): Record<string, MaterialActual> {
  return computeMaterialStockActuals(levels, movements, start, end, references, mep, weeklyRows, overrides, stockUnits).actuals;
}

/** Same calculation as buildMaterialStockActuals, plus the per-ingredient breakdown. */
export function buildMaterialActualDetails(
  levels: StockLevel[], movements: StockMovement[], start: string, end: string,
  references: MaterialStockReference[], mep: Record<string, number>, weeklyRows: WeeklyTrackingOrderRecord[],
  overrides: Record<string, MaterialStockTotals>,
  stockUnits: Record<string, string> = {},
): { actuals: Record<string, MaterialActual>; details: Record<string, MaterialActualDetail> } {
  return computeMaterialStockActuals(levels, movements, start, end, references, mep, weeklyRows, overrides, stockUnits);
}
