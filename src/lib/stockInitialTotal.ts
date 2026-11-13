import { supabase } from "@/lib/db";
import { requireCurrentPdvId } from "@/lib/pdvStore";
import { inventoryDayOfWeek } from "@/lib/miseEnPlaceData";
import { formatISODate, buildWeeklyDailyStocks, type WeeklyTrackingOrderRecord } from "@/lib/stockWeeklyAggregates";
import { getMovements, getInitialStocks, getProductUnits, getProductUnitConfigs, movementPiecesToDisplay, getGlaceAggregateForRange, getToppingsBreakdown, getProducts, roundStockQuantity } from "@/lib/stockData";
import { fetchAllRows } from "@/lib/supabasePaginate";

export type StockCount = { product_id: string; quantity: number; week_start: string };

/** Total columns only; no writes or changes to ordinary remaining stock. */
export function calculateStockTotals(initialTotal: number | undefined, purchases: number, outputs: number, miseEnPlace: number) {
  const sortiesTotal = roundStockQuantity(outputs - miseEnPlace);
  const stockTotal = initialTotal === undefined
    ? undefined
    : roundStockQuantity(initialTotal + purchases - Math.abs(sortiesTotal));
  return { sortiesTotal, stockTotal };
}

/**
 * Somme de tous les comptages de mise en place strictement avant la période
 * affichée, par produit. Le stock initial total est le dernier stock total :
 * il enchaîne tous les comptages depuis le début, pas seulement le plus récent.
 */
export function sumPreviousCounts(rows: StockCount[], periodStart: string) {
  const result: Record<string, number> = {};
  for (const row of rows) {
    if (row.week_start === "2000-01-03") continue;
    const date = formatISODate(inventoryDayOfWeek(row.week_start));
    if (date >= periodStart) continue;
    result[row.product_id] = (result[row.product_id] ?? 0) + (Number(row.quantity) || 0);
  }
  return result;
}

/**
 * Enchaîne jour par jour : stock total du jour = stock total de la veille +
 * entrées − |sorties − mise en place|, identique à la colonne Stock total
 * affichée pour chaque journée.
 */
export function chainDailyStockTotals(
  start: number,
  moves: { date: string; type: string; qty: number }[],
  meps: { date: string; qty: number }[],
) {
  const days = new Map<string, { e: number; s: number; m: number }>();
  const get = (d: string) => { let v = days.get(d); if (!v) { v = { e: 0, s: 0, m: 0 }; days.set(d, v); } return v; };
  for (const mv of moves) { const v = get(mv.date); if (mv.type === "entree") v.e += mv.qty; else v.s += mv.qty; }
  for (const mp of meps) get(mp.date).m += mp.qty;
  let total = start;
  for (const d of [...days.keys()].sort()) {
    const v = days.get(d);
    if (!v) continue;
    const next = calculateStockTotals(total, v.e, v.s, v.m).stockTotal;
    if (next !== undefined) total = next;
  }
  return roundStockQuantity(total);
}

/** Read-only daily carry-forward, using the same weekly outputs as Stock restant. */
export function chainWeeklyStockTotals(
  records: WeeklyTrackingOrderRecord[], articles: readonly string[], periodStart: string,
  counts: StockCount[], productId: string,
  extraInitial = 0, extraMoves: { date: string; type: string; qty: number }[] = [],
) {
  // Normalize before filtering: the next day's count closes the previous day's outputs.
  const daily = buildWeeklyDailyStocks(records, articles).filter(row => row.date < periodStart);
  const meps = counts.filter(row => row.product_id === productId && row.week_start !== "2000-01-03")
    .map(row => ({ date: formatISODate(inventoryDayOfWeek(row.week_start)), qty: Number(row.quantity) || 0 }))
    .filter(row => row.date < periodStart);
  const moves = extraMoves.filter(row => row.date < periodStart);
  if (!daily.length && !meps.length && !moves.length && extraInitial === 0) return undefined;
  const firstByArticle = new Map<string, number>();
  for (const row of daily) {
    if (!firstByArticle.has(row.article)) firstByArticle.set(row.article, row.stockInitial);
    moves.push({ date: row.date, type: "entree", qty: row.entrees }, { date: row.date, type: "sortie", qty: row.sorties });
  }
  const initial = extraInitial + [...firstByArticle.values()].reduce((sum, value) => sum + value, 0);
  return chainDailyStockTotals(initial, moves, meps);
}

/**
 * Dernier stock total avant la période, par produit (lecture seule : ne
 * réécrit jamais le stock initial ni les mouvements). Même règle que la
 * colonne Stock total : initial + entrées − |sorties − mise en place|,
 * cumulée sur toute l'historique antérieur à la période.
 */
export async function loadPreviousStockTotals(periodStart: string, weeklyGroups: Record<string, readonly string[]>) {
  const pdvId = requireCurrentPdvId();
  const counts = await fetchAllRows<StockCount>(() => supabase.from("mise_en_place_stocks")
    .select("product_id,quantity,week_start").eq("pdv_id", pdvId).lt("week_start", periodStart));
  const countSums = sumPreviousCounts(counts, periodStart);
  const [movements, initial, units, configs, weekly] = await Promise.all([
    getMovements(), getInitialStocks(), getProductUnits(), getProductUnitConfigs(),
    fetchAllRows<WeeklyTrackingOrderRecord>(() => supabase.from("weekly_tracking")
      .select("article,sorties,entrees,stock_initial,day_of_week,week_start,row_index")
      .eq("fiche_type", "Mouvement glaces & tartes")),
  ]);
  const products = getProducts();
  const prevDay = formatISODate(new Date(new Date(`${periodStart}T00:00:00`).getTime() - 86400000));
  const ids = new Set<string>([...Object.keys(initial), ...Object.keys(countSums), ...Object.keys(weeklyGroups)]);
  for (const movement of movements) ids.add(movement.productId);
  const result: Record<string, number> = {};
  await Promise.all([...ids].map(async (id) => {
    const sourceIds = id === "__nespresso_agg__" ? ["ali-29", "ali-30", "ali-31", "ali-32"]
      : id === "__nutella_nestle_agg__" ? ["ali-21", "ali-15"]
      : id === "__the_aromatise_agg__" ? products.filter(product => /tchaba/i.test(product.name)).map(product => product.id)
      : id === "__sirop_agg__" ? ["ali-9"] : [id];
    const articles = weeklyGroups[id];
    if (articles) {
      const combined = id === "__sirop_agg__";
      const previousTotal = chainWeeklyStockTotals(weekly, articles, periodStart, counts, id,
        combined ? sourceIds.reduce((sum, sourceId) => sum + (initial[sourceId] ?? 0), 0) : 0,
        combined ? movements.filter(row => sourceIds.includes(row.productId)).map(row => ({
          date: row.date.slice(0, 10), type: row.type,
          qty: movementPiecesToDisplay(row.quantity, units[row.productId] || "PIECE", configs[row.productId], row.productId),
        })) : []);
      if (previousTotal !== undefined) result[id] = previousTotal;
      return;
    }
    let stockInitial = sourceIds.reduce((sum, sourceId) => sum + (initial[sourceId] ?? 0), 0);
    let entrees = 0;
    let sorties = 0;
    for (const movement of movements) {
      if (!sourceIds.includes(movement.productId) || movement.date.slice(0, 10) >= periodStart) continue;
      const sourceId = movement.productId;
      const qty = movementPiecesToDisplay(movement.quantity, units[sourceId] || "PIECE", configs[sourceId], sourceId);
      if (movement.type === "entree") entrees += qty; else sorties += qty;
    }
    const name = products.find(product => product.id === id)?.name;
    if (name === "GLACE") {
      const agg = await getGlaceAggregateForRange(undefined, prevDay);
      stockInitial = agg.stockInitial;
      entrees = agg.entrees;
      sorties = agg.sorties;
    }
    if (name === "TOPPINGS") {
      const parts = await getToppingsBreakdown(date => date < periodStart, date => date < periodStart, {});
      stockInitial = parts.reduce((sum, row) => sum + row.stockInitial, 0);
      entrees = parts.reduce((sum, row) => sum + row.entrees, 0);
      sorties = parts.reduce((sum, row) => sum + row.sorties, 0);
    }
    const mep = countSums[id] ?? 0;
    if (!stockInitial && !entrees && !sorties && !mep) return;
    if (name !== "GLACE" && name !== "TOPPINGS" && !articles) {
      result[id] = chainDailyStockTotals(stockInitial, movements
        .filter(movement => sourceIds.includes(movement.productId) && movement.date.slice(0, 10) < periodStart)
        .map(movement => ({
          date: movement.date.slice(0, 10),
          type: movement.type,
          qty: movementPiecesToDisplay(movement.quantity, units[movement.productId] || "PIECE", configs[movement.productId], movement.productId),
        })), counts.filter(row => row.product_id === id && row.week_start !== "2000-01-03")
        .map(row => ({ date: formatISODate(inventoryDayOfWeek(row.week_start)), qty: Number(row.quantity) || 0 }))
        .filter(row => row.date < periodStart));
      return;
    }
    result[id] = roundStockQuantity(stockInitial + entrees - Math.abs(sorties - mep));
  }));
  return result;
}
