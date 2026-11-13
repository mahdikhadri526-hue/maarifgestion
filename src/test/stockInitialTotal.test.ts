import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ supabase: {} }));
import { calculateStockTotals, sumPreviousCounts, chainWeeklyStockTotals } from "@/lib/stockInitialTotal";
import { stockReferenceQuantity } from "@/lib/stockReference";

describe("Previous stock counting presentation", () => {
  it("sums all previous counts, excluding the current and future counts", () => {
    expect(sumPreviousCounts([
      { product_id: "a", week_start: "2026-11-02", quantity: 12 },
      { product_id: "a", week_start: "2026-11-09", quantity: 99 },
      { product_id: "a", week_start: "2026-10-19", quantity: 4 },
    ], "2026-11-09")).toEqual({ a: 16 });
  });
  it("uses the month boundary counting date rather than Monday", () => {
    expect(sumPreviousCounts([{ product_id: "a", week_start: "2026-10-26", quantity: 7 }], "2026-11-01")).toEqual({});
    expect(sumPreviousCounts([{ product_id: "a", week_start: "2026-10-26", quantity: 7 }], "2026-11-02")).toEqual({ a: 7 });
  });
  it("keeps zero counts and never treats legacy values as dated counts", () => {
    expect(sumPreviousCounts([{ product_id: "a", week_start: "2026-11-02", quantity: 0 }, { product_id: "b", week_start: "2000-01-03", quantity: 10 }], "2026-11-09")).toEqual({ a: 0 });
  });
  it("converts initial total with the existing reference factor", () => {
    expect(stockReferenceQuantity(20 + 12, "0.116")).toBe(3.71);
  });
});

describe("Stock remaining total columns", () => {
  it("calculates sorties total as sorties minus stock mise en place", () => {
    expect(calculateStockTotals(100, 20, 40, 10).sortiesTotal).toBe(30);
  });
  it("calculates stock total from the previous initial total plus purchases minus total outputs", () => {
    expect(calculateStockTotals(100, 20, 40, 10).stockTotal).toBe(90);
  });
  it("deducts the magnitude of negative total outputs without changing their displayed sign", () => {
    expect(calculateStockTotals(100, 0, 5, 10)).toEqual({ sortiesTotal: -5, stockTotal: 95 });
  });
  it("returns minus one for Café Brésil with initial total seven, zero entries and total outputs minus eight", () => {
    expect(calculateStockTotals(7, 0, 0, 8)).toEqual({ sortiesTotal: -8, stockTotal: -1 });
  });
  it("does not invent initial total when no previous count exists", () => {
    expect(calculateStockTotals(undefined, 20, 40, 10)).toEqual({ sortiesTotal: 30, stockTotal: undefined });
  });
  it("uses zero as a valid previous total and converts the calculated totals", () => {
    const totals = calculateStockTotals(0, 50, 40, 10);
    expect(totals.stockTotal).toBe(20);
    expect(stockReferenceQuantity(totals.sortiesTotal, "0.116")).toBe(3.48);
    expect(stockReferenceQuantity(totals.stockTotal ?? 0, "0.116")).toBe(2.32);
  });
});
import { chainDailyStockTotals } from "@/lib/stockInitialTotal";
describe("chainDailyStockTotals", () => {
  it("enchaîne le stock total jour par jour", () => {
    // J1: 7 + 0 - |2 - 10| = -1 ; J2: -1 + 15 - |4 - 0| = 10
    expect(chainDailyStockTotals(7, [
      { date: "2026-11-14", type: "sortie", qty: 2 },
      { date: "2026-11-15", type: "entree", qty: 15 },
      { date: "2026-11-15", type: "sortie", qty: 4 },
    ], [{ date: "2026-11-14", qty: 10 }])).toBe(10);
  });
});

describe("weekly category total carry-forward", () => {
  it.each(["Tarte 6", "Orange fruits", "Vanille", "Crème fraîche (mousse fouettée)", "Détergent"])("uses the same daily totals for %s without changing inputs", article => {
    const rows = [
      { article, week_start: "2026-11-09", day_of_week: "Samedi", stock_initial: 7, entrees: 0, sorties: 2 },
      { article, week_start: "2026-11-09", day_of_week: "Dimanche", stock_initial: null, entrees: 15, sorties: 4 },
    ];
    const snapshot = structuredClone(rows);
    const previous = chainWeeklyStockTotals(rows, [article], "2026-11-16", [{ product_id: article, week_start: "2026-11-09", quantity: 10 }], article);
    // Monday count: 7 - 10 = -3; Saturday: -3 - 2 = -5; Sunday: -5 + 15 - 4 = 6.
    expect(previous).toBe(6);
    expect(calculateStockTotals(previous, 5, 3, 1)).toEqual({ sortiesTotal: 2, stockTotal: 9 });
    expect(rows).toEqual(snapshot);
  });
  it("keeps tomorrow's count as output context but excludes tomorrow's purchases", () => {
    expect(chainWeeklyStockTotals([
      { article: "Tarte 6", week_start: "2026-11-09", day_of_week: "Samedi", stock_initial: 7, entrees: 3, sorties: null },
      { article: "Tarte 6", week_start: "2026-11-09", day_of_week: "Dimanche", stock_initial: 4, entrees: 99, sorties: null },
    ], ["Tarte 6"], "2026-11-15", [], "Tarte 6")).toBe(4);
  });
  it("preserves a real zero total but does not invent missing previous stock", () => {
    expect(chainWeeklyStockTotals([{ article: "Tarte 6", week_start: "2026-11-09", day_of_week: "Lundi", stock_initial: 0, entrees: 0, sorties: 0 }], ["Tarte 6"], "2026-11-16", [], "Tarte 6")).toBe(0);
    expect(chainWeeklyStockTotals([], ["Tarte 6"], "2026-11-16", [], "Tarte 6")).toBeUndefined();
  });
});
