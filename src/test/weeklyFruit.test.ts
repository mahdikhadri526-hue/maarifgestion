import { describe, expect, it, vi } from "vitest";
import { WEEKLY_ALL_ARTICLES, WEEKLY_TARTE_ARTICLES, WEEKLY_TARTE_DISPLAY_ARTICLES, WEEKLY_FRUIT_ARTICLES } from "@/lib/weeklyArticles";
import { buildWeeklyAggregateTotals, type WeeklyTrackingOrderRecord } from "@/lib/stockWeeklyAggregates";

vi.mock("@/lib/stockData", () => ({ roundStockQuantity: (n: number) => Math.round(n * 1000) / 1000 }));

const fruits = ["Orange fruits", "Citron fruits", "POMME fruits", "POIRE fruits", "Ananas fruits", "Kiwi fruits"];

describe("weekly fruit separation", () => {
  it("shows exactly the six historical fruits separately from tartes", () => {
    expect(WEEKLY_FRUIT_ARTICLES).toEqual(fruits);
    expect(WEEKLY_TARTE_DISPLAY_ARTICLES.filter(a => fruits.includes(a))).toEqual([]);
    expect([...WEEKLY_TARTE_DISPLAY_ARTICLES, ...WEEKLY_FRUIT_ARTICLES]).toEqual(WEEKLY_TARTE_ARTICLES);
  });

  it("keeps every fruit in the historical order inputs with identical calculated totals", () => {
    const records: WeeklyTrackingOrderRecord[] = fruits.flatMap(article => [
      { article, week_start: "2026-10-19", day_of_week: "Lundi", stock_initial: 10, entrees: 3, sorties: null },
      { article, week_start: "2026-10-19", day_of_week: "Mardi", stock_initial: 8, entrees: null, sorties: null },
    ]);
    expect(fruits.every(a => WEEKLY_ALL_ARTICLES.includes(a))).toBe(true);
    const historical = buildWeeklyAggregateTotals(records, WEEKLY_TARTE_ARTICLES, () => true, true);
    const separated = buildWeeklyAggregateTotals(records, [...WEEKLY_TARTE_DISPLAY_ARTICLES, ...WEEKLY_FRUIT_ARTICLES], () => true, true);
    expect(historical).toEqual({ stockInitial: 60, entrees: 18, sorties: 30, stockRestant: 48 });
    expect(separated).toEqual(historical);
  });

  it("preserves each fruit stock and order input when loaded without the tartes", () => {
    const records: WeeklyTrackingOrderRecord[] = [
      { article: "Orange fruits", week_start: "2026-10-19", day_of_week: "Lundi", stock_initial: 10, entrees: 3, sorties: null },
      { article: "Orange fruits", week_start: "2026-10-19", day_of_week: "Mardi", stock_initial: 8, entrees: null, sorties: null },
      { article: "Tarte 6", week_start: "2026-10-19", day_of_week: "Lundi", stock_initial: 100, entrees: 50, sorties: 20 },
    ];
    const fruitRows = records.filter(r => WEEKLY_FRUIT_ARTICLES.includes(r.article ?? ""));
    const before = buildWeeklyAggregateTotals(records, ["Orange fruits"], () => true, true);
    const after = buildWeeklyAggregateTotals(fruitRows, ["Orange fruits"], () => true, true);
    expect(after).toEqual({ stockInitial: 10, entrees: 3, sorties: 5, stockRestant: 8 });
    expect(after).toEqual(before);
  });
});