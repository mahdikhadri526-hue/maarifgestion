import { describe, expect, it } from "vitest";
import { relinkRecipeIngredients } from "@/lib/recipeIngredientLinks";

describe("shared ingredient stock links", () => {
  it("links the same ingredient across Sur place, Emporter, Tartes and Autres without changing doses or units", () => {
    const rows = ["surplace", "emporter", "tartes", "autres"].map((recipe, i) => ({
      recipe, product_id: "custom:creme-fraiche", category: "alimentaire", quantity: i + 1,
      unit: i === 0 ? "KILO" : "UA", notes: "Crème fraîche",
    }));
    const result = relinkRecipeIngredients(rows, {
      source_product_id: "custom:creme-fraiche", source_category: "alimentaire",
      product_id: "chantilly-agg", category: "alimentaire",
    });
    expect(result.map(row => row.product_id)).toEqual(Array(4).fill("chantilly-agg"));
    expect(result.map(row => row.quantity)).toEqual([1, 2, 3, 4]);
    expect(result.map(row => row.unit)).toEqual(["KILO", "UA", "UA", "UA"]);
    expect(rows[0].product_id).toBe("custom:creme-fraiche");
  });
  it("leaves unrelated ingredients and other ingredient categories unchanged", () => {
    const rows = [
      { product_id: "ali-3", category: "alimentaire", notes: null },
      { product_id: "custom:fruit", category: "emballage", notes: null },
    ];
    expect(relinkRecipeIngredients(rows, {
      source_product_id: "custom:fruit", source_category: "alimentaire", product_id: "Fraise", category: "alimentaire",
    })).toEqual(rows);
  });
});