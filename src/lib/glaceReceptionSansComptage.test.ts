import { describe, it, expect } from "vitest";
import { buildWeeklyDailyStocks } from "@/lib/stockWeeklyAggregates";

describe("réception glace sans comptage du jour", () => {
  it("part du stock de la veille (Moka : 2 + 12 reçus − 10 comptés = 4 sorties)", () => {
    const w = "2026-09-21";
    const rows = [
      { article: "Moka", day_of_week: "Vendredi", week_start: w, row_index: 0, stock_initial: 2, entrees: null, sorties: null },
      { article: "Moka", day_of_week: "Samedi", week_start: w, row_index: 1, stock_initial: null, entrees: 12, sorties: null },
      { article: "Moka", day_of_week: "Dimanche", week_start: w, row_index: 0, stock_initial: 10, entrees: null, sorties: null },
    ];
    const sat = buildWeeklyDailyStocks(rows, ["Moka"]).find(d => d.date === "2026-09-26")!;
    expect(sat.stockInitial).toBe(2);
    expect(sat.sorties).toBe(4);
  });
});
