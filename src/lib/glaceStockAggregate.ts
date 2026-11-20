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
  const weights: Record<string, number> = { ...grams };
  if (records.some(r => r.article === "Panachés")) weights["Panachés"] = 750;
  const articles = [...new Set([...Object.keys(weights), ...records.flatMap(r => r.article ? [r.article] : [])])]
    .filter(a => a !== "Crème fraîche (mousse fouettée)" && (a in weights));
  const inRange = (date: string) => (!start || date >= start) && (!end || date <= end);
  return articles.sort((a, b) => a.localeCompare(b, "fr")).map(name => {
    // Panachés belongs to Tartes: GLACE consumption uses counts only, never
    // its receipts or saved outputs. Keep original Tartes records untouched.
    const countsOnly = name === "Panachés";
    const source = countsOnly ? records.filter(r => r.article === name).map(r => ({ ...r, entrees: 0, sorties: null })) : records;
    const calculated = buildWeeklyAggregateTotals(source, [name], inRange, false, false, start);
    const allDays = buildWeeklyDailyStocks(source, [name]);
    const daily = (countsOnly ? allDays.map((day, index) => {
      // Next count closes the previous day even when counts are sparse.
      const stockRestant = allDays[index + 1]?.stockInitial ?? day.stockRestant;
      return { ...day, entrees: 0, stockRestant, sorties: day.stockInitial - stockRestant };
    }) : allDays).filter(r => inRange(r.date));
    const first = daily[0];
    const last = daily[daily.length - 1];
    const counted = countsOnly && first && last
      ? { ...calculated, stockInitial: first.stockInitial, stockRestant: last.stockRestant }
      : calculated;
    const bacs = countsOnly ? { ...counted, entrees: 0, sorties: counted.stockInitial - counted.stockRestant } : calculated;
    const kgPerBac = Number(weights[name]) > 0 ? Number(weights[name]) / 1000 : 0;
    return {
      name, kgPerBac, missingGrammage: kgPerBac === 0, bacs,
      stockInitial: bacs.stockInitial * kgPerBac,
      entrees: bacs.entrees * kgPerBac,
      sorties: bacs.sorties * kgPerBac,
      stockRestant: bacs.stockRestant * kgPerBac,
      daily,
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