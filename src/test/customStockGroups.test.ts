import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ supabase: {} }));
import { combineStockSources, groupIngredientId, type GroupSource } from "@/lib/customStockGroups";

const sources: GroupSource[] = [
  { id: "a", name: "A", category: "alimentaire", unit: "KILO", stockInitial: 7, entrees: 0, sorties: 8, stockRestant: -1 },
  { id: "b", name: "B", category: "alimentaire", unit: "kg", stockInitial: 5, entrees: 3, sorties: 2, stockRestant: 6 },
];
describe("Custom stock groups preserve source calculations", () => {
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