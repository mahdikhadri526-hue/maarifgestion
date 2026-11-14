import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ supabase: {} }));
import { combineStockSources, sumGroupReferenceColumn, groupIngredientId, type GroupSource } from "@/lib/customStockGroups";

const sources: GroupSource[] = [
  { id: "a", name: "A", category: "alimentaire", unit: "KILO", stockInitial: 7, entrees: 0, sorties: 8, stockRestant: -1 },
  { id: "b", name: "B", category: "alimentaire", unit: "kg", stockInitial: 5, entrees: 3, sorties: 2, stockRestant: 6 },
];
describe("Custom stock groups preserve source calculations", () => {
  it("adds each numeric column of the selected products independently", () => {
    expect(combineStockSources(["a", "b"], sources, { a: 1, b: 2 }, { a: 7, b: 5 })).toMatchObject({ stockInitial: 12, entrees: 3, sorties: 10, stockRestant: 5, initialTotal: 12, miseEnPlace: 3, sortiesTotal: 7, stockTotal: 8 });
  });
  it("adds reference values with each product's own conversion", () => {
    expect(sumGroupReferenceColumn(["a", "b"], { a: 8, b: 2 }, { a: { conversion: "2", unitRef: "kg" }, b: { conversion: "3", unitRef: "kg" } })).toEqual({ quantity: 22, unit: "kg" });
  });
  it("does not mix incompatible reference units or omit missing values", () => {
    expect(sumGroupReferenceColumn(["a", "b"], { a: 8, b: 2 }, { a: { conversion: "2", unitRef: "kg" }, b: { conversion: "3", unitRef: "L" } })).toBeNull();
    expect(sumGroupReferenceColumn(["a", "b"], { a: 8 }, { a: { conversion: "2", unitRef: "kg" } })).toBeNull();
  });
  it("merges selected source stock calculations without mutating originals", () => {
    const before = structuredClone(sources);
    expect(combineStockSources(["a", "b"], sources)).toMatchObject({ stockInitial: 12, entrees: 3, sorties: 10, stockRestant: 5 });
    expect(sources).toEqual(before);
  });
  it("sums signed source outputs and source totals independently", () => {
    expect(combineStockSources(["a", "b"], sources, { a: 10 }, { a: 7, b: 5 })).toMatchObject({ miseEnPlace: 10, sortiesTotal: 0, initialTotal: 12, stockTotal: 11 });
  });
  it("does not invent an unavailable previous stock total", () => {
    expect(combineStockSources(["a", "b"], sources, {}, { a: 7 }).stockTotal).toBeUndefined();
  });
  it("rejects quantities in incompatible units", () => {
    expect(() => combineStockSources(["a", "b"], [sources[0], { ...sources[1], unit: "LITRE" }])).toThrow("même unité");
  });
  it("counts the same source once", () => {
    expect(combineStockSources(["a", "a"], sources).sorties).toBe(8);
  });
  it("keeps the existing stock identity when exporting an individual product", () => {
    expect(groupIngredientId({ id: "export", pdv_id: "pdv", name: "A", source_ids: ["a"], exported: true })).toBe("a");
  });
  it("exports the stable group identity when multiple products are merged", () => {
    expect(groupIngredientId({ id: "stock-group:1", pdv_id: "pdv", name: "A+B", source_ids: ["a", "b"], exported: true })).toBe("stock-group:1");
  });
});
describe("group reference fallback", () => {
  it("uses the group conversion for products without their own", async () => {
    const { sumGroupReferenceColumn } = await import("@/lib/customStockGroups");
    expect(sumGroupReferenceColumn(["a", "b"], { a: 2, b: 3 }, { a: { conversion: "0.5", unitRef: "kg" } }, { conversion: "2", unitRef: "kg" }))
      .toEqual({ quantity: 7, unit: "kg" });
  });
});
