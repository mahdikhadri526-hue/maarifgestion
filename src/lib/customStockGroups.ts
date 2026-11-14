import { supabase } from "@/lib/db";
import { requireCurrentPdvId } from "@/lib/pdvStore";
import { fetchAllRows } from "@/lib/supabasePaginate";
import { getStockLevels, getMovements, getInitialStocks, getProductUnits, getProductUnitConfigs, movementPiecesToDisplay, getGlaceAggregateForRange, getToppingsBreakdown } from "@/lib/stockData";
import { buildWeeklyAggregateTotals, type WeeklyTrackingOrderRecord } from "@/lib/stockWeeklyAggregates";
import { stockRecipeIngredients, getStockRecipeAggregates } from "@/lib/stockRecipeIngredients";
import { WEEKLY_ALL_ARTICLES } from "@/lib/weeklyArticles";
import { calculateStockTotals } from "@/lib/stockInitialTotal";
import { stockReferenceQuantity } from "@/lib/stockReference";

export type CustomStockGroup = { id: string; pdv_id: string; name: string; source_ids: string[]; exported: boolean };
export type GroupSource = { id: string; name: string; category: string; unit: string; stockInitial: number; entrees: number; sorties: number; stockRestant: number };
export const groupIngredientId = (group: CustomStockGroup) => group.source_ids.length === 1 ? group.source_ids[0] : group.id;
export const normalizedGroupUnit = (value: string) => {
  const unit = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  if (["KILO", "KG"].includes(unit)) return "kg";
  if (["LITRE", "L"].includes(unit)) return "L";
  if (["PIECE", "PIECES"].includes(unit)) return "pièce";
  return unit;
};

/** Sum source calculations, never replace their identities or combine different units. */
export function combineStockSources(ids: string[], sources: GroupSource[], mep: Record<string, number> = {}, previous: Record<string, number> = {}) {
  const unique = [...new Set(ids)];
  const parts = unique.map(id => sources.find(row => row.id === id));
  if (!unique.length || parts.some(row => !row)) throw new Error("Un produit du regroupement est indisponible.");
  const rows = parts.filter((row): row is GroupSource => !!row);
  const unit = normalizedGroupUnit(rows[0].unit);
  if (!unit || rows.some(row => normalizedGroupUnit(row.unit) !== unit)) throw new Error("Choisissez des produits avec la même unité de stock.");
  const sum = (read: (row: GroupSource) => number) => Number(rows.reduce((total, row) => total + read(row), 0).toFixed(4));
  const completePrevious = rows.every(row => previous[row.id] !== undefined);
  return { unit, rows, stockInitial: sum(row => row.stockInitial), entrees: sum(row => row.entrees), sorties: sum(row => row.sorties), stockRestant: sum(row => row.stockRestant),
    miseEnPlace: sum(row => mep[row.id] ?? 0), sortiesTotal: sum(row => calculateStockTotals(previous[row.id], row.entrees, row.sorties, mep[row.id] ?? 0).sortiesTotal),
    initialTotal: completePrevious ? sum(row => previous[row.id]) : undefined,
    stockTotal: completePrevious ? sum(row => calculateStockTotals(previous[row.id], row.entrees, row.sorties, mep[row.id] ?? 0).stockTotal ?? 0) : undefined };
}

/** Reference columns add each source's converted column, not a conversion of the group sum. */
export function sumGroupReferenceColumn(
  ids: string[], quantities: Record<string, number | undefined>,
  references: Record<string, { conversion: string; unitRef: string }>,
  groupReference?: { conversion: string; unitRef: string },
) {
  let total = 0;
  let unit: string | undefined;
  for (const id of new Set(ids)) {
    const quantity = quantities[id];
    const own = references[id];
    // A product without its own conversion uses the group's conversion.
    const ref = own?.unitRef.trim() && own.conversion.trim() ? own : groupReference?.unitRef.trim() && groupReference.conversion.trim() ? groupReference : own;
    if (quantity === undefined || !ref?.unitRef.trim()) return null;
    const converted = stockReferenceQuantity(quantity, ref.conversion);
    if (converted === null) return null;
    const currentUnit = normalizedGroupUnit(ref.unitRef);
    if (unit !== undefined && unit !== currentUnit) return null;
    unit = currentUnit;
    total += converted;
  }
  return unit === undefined ? null : { quantity: Number(total.toFixed(4)), unit };
}

export async function loadCustomStockGroups() {
  return fetchAllRows<CustomStockGroup>(() => supabase.from("stock_product_groups").select("*").eq("pdv_id", requireCurrentPdvId()).order("created_at"));
}
export async function saveCustomStockGroup(group: CustomStockGroup) {
  const { error } = await supabase.from("stock_product_groups").upsert(group);
  if (error) throw error;
}

/** Same read-only stock formulas and article identities as Stock restant. */
export async function loadGroupSources(start?: string, end?: string): Promise<GroupSource[]> {
  const [levels, movements, initial, units, configs, weekly] = await Promise.all([
    getStockLevels(), getMovements(), getInitialStocks(), getProductUnits(), getProductUnitConfigs(),
    fetchAllRows<WeeklyTrackingOrderRecord>(() => supabase.from("weekly_tracking").select("article,stock_initial,entrees,sorties,day_of_week,week_start,row_index").eq("fiche_type", "Mouvement glaces & tartes")),
  ]);
  const match = (date: string) => (!start || date >= start) && (!end || date <= end);
  const sources: GroupSource[] = levels.map(level => {
    let stockInitial = level.stockInitial, entrees = level.totalEntrees, sorties = level.totalSorties, stockRestant = level.stockRestant;
    if (start || end) {
      const daily = new Map<string, { e: number; s: number }>();
      for (const move of movements.filter(move => move.productId === level.productId)) {
        const date = move.date.slice(0, 10);
        const day = daily.get(date) ?? { e: 0, s: 0 };
        const qty = movementPiecesToDisplay(move.quantity, units[level.productId] ?? "PIECE", configs[level.productId], level.productId);
        if (move.type === "entree") day.e += qty; else day.s += qty;
        daily.set(date, day);
      }
      let current = initial[level.productId] ?? 0;
      stockInitial = current; entrees = 0; sorties = 0;
      let began = false;
      for (const [date, day] of [...daily].sort(([a], [b]) => a.localeCompare(b))) {
        if (end && date > end) break;
        if (match(date)) {
          if (!began) { stockInitial = current; began = true; }
          entrees += day.e; sorties += day.s;
        }
        current += day.e - day.s;
        if (start && date < start) stockInitial = current;
      }
      stockRestant = current;
    }
    return { id: level.productId, name: level.productName, category: level.category, unit: units[level.productId] ?? level.unit, stockInitial, entrees, sorties, stockRestant };
  });
  await Promise.all(sources.map(async row => {
    if (row.name === "GLACE") Object.assign(row, await getGlaceAggregateForRange(start, end));
    if (row.name === "TOPPINGS") {
      const parts = await getToppingsBreakdown(start || end ? match : null, date => !!start && date < start, {});
      for (const key of ["stockInitial", "entrees", "sorties", "stockRestant"] as const) row[key] = parts.reduce((sum, part) => sum + part[key], 0);
    }
  }));
  const articles = [...new Set([...WEEKLY_ALL_ARTICLES, ...stockRecipeIngredients.map(row => row.name)])];
  for (const name of articles) {
    const known = stockRecipeIngredients.find(row => row.name === name);
    const id = known?.id ?? name;
    if (sources.some(row => row.id === id)) continue;
    sources.push({ id, name, category: "alimentaire", unit: units[id] ?? (known?.group === "Crème fraîche" ? "KILO" : "STOCK"), ...buildWeeklyAggregateTotals(weekly, [name], match, !start && !end, false, start) });
  }
  for (const aggregate of getStockRecipeAggregates(levels.map(row => ({ id: row.productId, name: row.productName })))) {
    try {
      const sum = combineStockSources(aggregate.sourceIds.filter(id => sources.some(row => row.id === id)), sources);
      sources.push({ id: aggregate.id, name: aggregate.name, category: aggregate.category, ...sum });
    } catch { /* Incompatible aggregates cannot be used as a custom source. */ }
  }
  return sources;
}