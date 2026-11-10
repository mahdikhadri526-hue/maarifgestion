import { supabase } from "@/lib/db";
import { requireCurrentPdvId } from "@/lib/pdvStore";
import { inventoryDayOfWeek } from "@/lib/miseEnPlaceData";
import { formatISODate, buildWeeklyAggregateTotals, type WeeklyTrackingOrderRecord } from "@/lib/stockWeeklyAggregates";
import { getMovements, getInitialStocks, getProductUnits, getProductUnitConfigs, movementPiecesToDisplay, getGlaceAggregateForRange, getToppingsBreakdown, getProducts, roundStockQuantity } from "@/lib/stockData";
import { fetchAllRows } from "@/lib/supabasePaginate";

export type StockCount = { product_id: string; quantity: number; week_start: string };

/** Latest recorded count strictly before the displayed period, independently per product. */
export function previousStockCounts(rows: StockCount[], periodStart: string) {
  const result: Record<string, { date: string; quantity: number }> = {};
  for (const row of rows) {
    if (row.week_start === "2000-01-03") continue;
    const date = formatISODate(inventoryDayOfWeek(row.week_start));
    if (date >= periodStart || (result[row.product_id] && result[row.product_id].date >= date)) continue;
    result[row.product_id] = { date, quantity: Number(row.quantity) || 0 };
  }
  return result;
}

/** Read-only presentation: never feeds the existing initial stock or outputs calculations. */
export async function loadPreviousStockTotals(periodStart: string, weeklyGroups: Record<string, readonly string[]>) {
  const pdvId = requireCurrentPdvId();
  const counts = await fetchAllRows<StockCount>(() => supabase.from("mise_en_place_stocks")
    .select("product_id,quantity,week_start").eq("pdv_id", pdvId).lt("week_start", periodStart));
  const previous = previousStockCounts(counts, periodStart);
  if (!Object.keys(previous).length) return {};
  const [movements, initial, units, configs, weekly] = await Promise.all([
    getMovements(), getInitialStocks(), getProductUnits(), getProductUnitConfigs(),
    fetchAllRows<WeeklyTrackingOrderRecord>(() => supabase.from("weekly_tracking")
      .select("article,sorties,entrees,stock_initial,day_of_week,week_start,row_index")
      .eq("fiche_type", "Mouvement glaces & tartes")),
  ]);
  const products = getProducts();
  const result: Record<string, number> = {};
  await Promise.all(Object.entries(previous).map(async ([id, count]) => {
    let remaining = initial[id] ?? 0;
    for (const movement of movements) {
      if (movement.productId !== id || movement.date.slice(0, 10) > count.date) continue;
      const qty = movementPiecesToDisplay(movement.quantity, units[id] || "PIECE", configs[id], id);
      remaining += movement.type === "entree" ? qty : -qty;
    }
    const name = products.find(product => product.id === id)?.name;
    if (name === "GLACE") remaining = (await getGlaceAggregateForRange(count.date, count.date)).stockRestant;
    if (name === "TOPPINGS") remaining = (await getToppingsBreakdown(date => date === count.date, date => date < count.date, {}))
      .reduce((sum, row) => sum + row.stockRestant, 0);
    const articles = weeklyGroups[id];
    if (articles) remaining = buildWeeklyAggregateTotals(weekly, articles, date => date === count.date, false, false, count.date).stockRestant;
    result[id] = roundStockQuantity(remaining + count.quantity);
  }));
  return result;
}