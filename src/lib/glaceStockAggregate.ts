import { buildWeeklyAggregateTotals, buildWeeklyDailyStocks, type WeeklyTrackingOrderRecord } from "@/lib/stockWeeklyAggregates";

export type GlaceTrackingRecord = WeeklyTrackingOrderRecord & { lot_number?: string | null };
export type GlaceStockDetail = {
  name: string;
  kgPerBac: number;
  missingGrammage: boolean;
  stockInitial: number;
  entrees: number;
  sorties: number;
  stockRestant: number;
  bacs: { stockInitial: number; entrees: number; sorties: number; stockRestant: number };
  daily: ReturnType<typeof buildWeeklyDailyStocks>;
};

/** One calculation for the GLACE row and its detail; kilograms never replace stored bac counts. */
export function buildGlaceStockDetails(
  records: GlaceTrackingRecord[], grams: Record<string, number>, start?: string, end?: string,
): GlaceStockDetail[] {
  const articles = [...new Set([...Object.keys(grams), ...records.flatMap(r => r.article ? [r.article] : [])])]
    .filter(a => a !== "Crème fraîche (mousse fouettée)" && (a in grams));
  const inRange = (date: string) => (!start || date >= start) && (!end || date <= end);
  return articles.sort((a, b) => a.localeCompare(b, "fr")).map(name => {
    const bacs = buildWeeklyAggregateTotals(records, [name], inRange, false, false, start);
    const kgPerBac = Number(grams[name]) > 0 ? Number(grams[name]) / 1000 : 0;
    return {
      name, kgPerBac, missingGrammage: kgPerBac === 0, bacs,
      stockInitial: bacs.stockInitial * kgPerBac,
      entrees: bacs.entrees * kgPerBac,
      sorties: bacs.sorties * kgPerBac,
      stockRestant: bacs.stockRestant * kgPerBac,
      daily: buildWeeklyDailyStocks(records, [name]).filter(r => inRange(r.date)),
    };
  });
}

export function sumGlaceStockDetails(rows: GlaceStockDetail[]) {
  return rows.reduce((total, row) => ({
    stockInitial: total.stockInitial + row.stockInitial,
    entrees: total.entrees + row.entrees,
    sorties: total.sorties + row.sorties,
    stockRestant: total.stockRestant + row.stockRestant,
  }), { stockInitial: 0, entrees: 0, sorties: 0, stockRestant: 0 });
}