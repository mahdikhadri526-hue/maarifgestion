import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ supabase: {} }));
import { previousStockCounts } from "@/lib/stockInitialTotal";
import { stockReferenceQuantity } from "@/lib/stockReference";

describe("Previous stock counting presentation", () => {
  it("selects the last previous count, excluding the current and future counts", () => {
    expect(previousStockCounts([
      { product_id: "a", week_start: "2026-11-02", quantity: 12 },
      { product_id: "a", week_start: "2026-11-09", quantity: 99 },
      { product_id: "a", week_start: "2026-10-19", quantity: 4 },
    ], "2026-11-09")).toEqual({ a: { date: "2026-11-02", quantity: 12 } });
  });
  it("uses the month boundary counting date rather than Monday", () => {
    expect(previousStockCounts([{ product_id: "a", week_start: "2026-10-26", quantity: 7 }], "2026-11-01")).toEqual({});
    expect(previousStockCounts([{ product_id: "a", week_start: "2026-10-26", quantity: 7 }], "2026-11-02")).toEqual({ a: { date: "2026-11-01", quantity: 7 } });
  });
  it("keeps zero counts and never treats legacy values as dated counts", () => {
    expect(previousStockCounts([{ product_id: "a", week_start: "2026-11-02", quantity: 0 }, { product_id: "b", week_start: "2000-01-03", quantity: 10 }], "2026-11-09")).toEqual({ a: { date: "2026-11-02", quantity: 0 } });
  });
  it("converts initial total with the existing reference factor", () => {
    expect(stockReferenceQuantity(20 + 12, "0.116")).toBe(3.71);
  });
});