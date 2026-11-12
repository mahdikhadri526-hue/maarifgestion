import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ supabase: {} }));
import { calculateStockTotals, sumPreviousCounts } from "@/lib/stockInitialTotal";
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