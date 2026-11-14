import { describe, expect, it, vi } from "vitest";
import { materialTheoreticalDetails } from "@/lib/materialTheoreticalDetails";
import { computeMaterialVariance } from "@/lib/materialVariance";

vi.mock("@/lib/stockData", () => ({ roundStockQuantity: (n: number) => Math.round(n * 1000) / 1000 }));

describe("Material theoretical read-only detail", () => {
  const recipes = [
    { id: "sp", finished_product_id: "surplace", version: 1, active: true },
    { id: "emp", finished_product_id: "emporter", version: 1, active: true },
    { id: "old", finished_product_id: "surplace", version: 0, active: false },
  ];
  const ingredients = [
    { recipe_id: "sp", product_id: "weekly:Bûche", category: "alimentaire", quantity: 0.5, unit: "KG", notes: null },
    { recipe_id: "emp", product_id: "Bûche", category: "alimentaire", quantity: 0.25, unit: "KG", notes: null },
    { recipe_id: "old", product_id: "Bûche", category: "alimentaire", quantity: 99, unit: "KG", notes: null },
  ];
  it("explains sales × recipe dose across categories with canonical stock links, without changing results or inputs", () => {
    const sales = { surplace: 10, emporter: 4 };
    const actuals = { "Bûche": { name: "Bûche", category: "alimentaire", quantity: 8, unit: "KG" } };
    const before = computeMaterialVariance(recipes, ingredients, sales, actuals);
    const snapshot = JSON.stringify({ recipes, ingredients, sales, actuals });
    const detail = materialTheoreticalDetails("Bûche:KG", recipes, ingredients, sales);
    expect(detail.map(line => [line.productId, line.sold, line.dose, line.usage])).toEqual([["surplace", 10, 0.5, 5], ["emporter", 4, 0.25, 1]]);
    expect(detail.reduce((sum, line) => sum + line.usage, 0)).toBe(before[0].theoretical);
    expect(before[0].variance).toBe(2);
    expect(computeMaterialVariance(recipes, ingredients, sales, actuals)).toEqual(before);
    expect(JSON.stringify({ recipes, ingredients, sales, actuals })).toBe(snapshot);
  });
  it("keeps mixed recipe units separate in the explanation", () => {
    const detail = materialTheoreticalDetails("Bûche:KG", recipes, [ingredients[0], { ...ingredients[1], unit: "PIECE" }], { surplace: 10, emporter: 4 });
    expect(detail.map(line => [line.usage, line.unit])).toEqual([[5, "KG"], [1, "PIECE"]]);
  });
  it("excludes zero, missing, negative and invalid sales", () => {
    for (const sold of [0, -1, NaN, Infinity]) expect(materialTheoreticalDetails("Bûche:KG", recipes, ingredients, { surplace: sold })).toEqual([]);
    expect(materialTheoreticalDetails("unlinked:KG", recipes, ingredients, { surplace: 10 })).toEqual([]);
  });
});