import { describe, expect, it, vi } from "vitest";
import { buildWeeklyAggregateTotals, buildWeeklyDailyStocks, type WeeklyTrackingOrderRecord } from "@/lib/stockWeeklyAggregates";

vi.mock("@/lib/stockData", () => ({ roundStockQuantity: (n: number) => Math.round(n * 1000) / 1000 }));
const row = (article: string, day_of_week: string, stock_initial: number | null, entrees: number | null = null, sorties: number | null = null, row_index = 0, week_start = "2026-10-05"): WeeklyTrackingOrderRecord =>
  ({ article, day_of_week, stock_initial, entrees, sorties, row_index, week_start });
const dayTotals = (records: WeeklyTrackingOrderRecord[], article: string, date: string) =>
  buildWeeklyAggregateTotals(records, [article], d => d === date, false, false, date);

describe("weekly outgoing stock matches the daily tracking sheet", () => {
  it.each([
    ["Cornet", 660, 562, 870, 352],
    ["Orange fruits", 60, 0, 50, 10],
    ["Mac.Chocolat P", 12, 0, 6, 6],
    ["Sirop.Crml", 4.5, 10, 13, 1.5],
    ["Crème fraîche (mousse fouettée)", 190, 100, 250, 40],
    ["Vanille", 4, 1, 3, 2],
    ["Rc 20", 5, 2, 4, 3],
  ])("closes the selected day for %s with the next day's count", (article, si, e, next, sorties) => {
    const records = [row(article, "Mardi", si, e), row(article, "Mercredi", next, 999)];
    expect(dayTotals(records, article, "2026-10-06")).toEqual({ stockInitial: si, entrees: e, sorties, stockRestant: next });
  });

  it("sums every lot receipt without letting non-root rows overwrite counts", () => {
    const records = [row("Cornet", "Mardi", 660), row("Cornet", "Mardi", 9999, 300, 999, 1), row("Cornet", "Mardi", null, 262, null, 2), row("Cornet", "Mercredi", 870)];
    expect(dayTotals(records, "Cornet", "2026-10-06")).toEqual({ stockInitial: 660, entrees: 562, sorties: 352, stockRestant: 870 });
  });

  it("does not suppress one article's explicit outgoing quantity with another's count", () => {
    const records = [row("A", "Lundi", 10), row("A", "Mardi", 8), row("B", "Lundi", 10, null, 3)];
    expect(buildWeeklyAggregateTotals(records, ["A", "B"], () => true, true)).toEqual({ stockInitial: 20, entrees: 0, sorties: 5, stockRestant: 15 });
    expect(buildWeeklyAggregateTotals([...records].reverse(), ["A", "B"], () => true, true).sorties).toBe(5);
  });

  it("does not invent a daily sortie across a missing next-day count", () => {
    expect(dayTotals([row("A", "Lundi", 10), row("A", "Mercredi", 7)], "A", "2026-10-05").sorties).toBe(0);
  });

  it("uses zero opening stock for a newly received article", () => {
    expect(dayTotals([row("A", "Lundi", null, 5, null, 1), row("A", "Mardi", 2)], "A", "2026-10-05")).toEqual({ stockInitial: 0, entrees: 5, sorties: 3, stockRestant: 2 });
  });

  it("preserves negative discrepancies as displayed in weekly tracking", () => {
    expect(dayTotals([row("A", "Lundi", 10), row("A", "Mardi", 12)], "A", "2026-10-05").sorties).toBe(-2);
  });

  it("closes Sunday using next Monday without including Monday's receipts", () => {
    const records = [row("A", "Dimanche", 10, 3), row("A", "Lundi", 8, 50, null, 0, "2026-10-12")];
    expect(dayTotals(records, "A", "2026-10-11")).toEqual({ stockInitial: 10, entrees: 3, sorties: 5, stockRestant: 8 });
  });

  it("never takes a future count as the opening stock", () => {
    const records = [row("A", "Lundi", 10), row("A", "Mercredi", 2)];
    expect(dayTotals(records, "A", "2026-10-06").stockInitial).toBe(10);
  });

  it("carries a sparse article's last stock into a later selected period", () => {
    expect(dayTotals([row("A", "Lundi", 10)], "A", "2026-10-22")).toEqual({ stockInitial: 10, entrees: 0, sorties: 0, stockRestant: 10 });
  });

  it("adds later receipts to the last known stock when there is no closing count", () => {
    const records = [row("Cornet", "Mercredi", 870), row("Cornet", "Mardi", null, 20, null, 1, "2026-10-19"), row("Cornet", "Mercredi", null, 40, null, 1, "2026-10-19")];
    expect(buildWeeklyAggregateTotals(records, ["Cornet"], () => true, true).stockRestant).toBe(930);
  });

  it("calculates history sorties even when the stored sorties column is empty", () => {
    const days = buildWeeklyDailyStocks([row("Biscuit", "Lundi", 10, 3), row("Biscuit", "Mardi", 8)], ["Biscuit"]);
    expect(days[0]).toMatchObject({ sorties: 5, stockRestant: 8 });
  });

  it("retains historical Sunday week keys when assigning dates", () => {
    const records = [row("A", "Lundi", 10, 3, null, 0, "2026-04-26"), row("A", "Mardi", 8, null, null, 0, "2026-04-26")];
    expect(dayTotals(records, "A", "2026-04-27").sorties).toBe(5);
  });
});