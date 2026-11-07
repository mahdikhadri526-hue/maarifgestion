import { describe, expect, it } from "vitest";
import { changedRecipeIngredientUnits } from "@/lib/recipeIngredientUnits";

describe("shared recipe ingredient units", () => {
  it("identifies an explicit purchase-unit change independently of recipe category", () => {
    expect(changedRecipeIngredientUnits(
      [{ product_id: "ali-3", category: "alimentaire", unit: "UA" }],
      [{ product_id: "ali-3", category: "alimentaire", unit: "PIECE" }],
    )).toEqual([{ product_id: "ali-3", category: "alimentaire", unit: "PIECE" }]);
  });
  it("does not synchronize unchanged units, removed ingredients or stock remappings", () => {
    expect(changedRecipeIngredientUnits(
      [{ product_id: "ali-3", category: "alimentaire", unit: "UA" }, { product_id: "emb-3", category: "emballage", unit: "UA" }],
      [{ product_id: "ali-3", category: "alimentaire", unit: "UA" }, { product_id: "emb-4", category: "emballage", unit: "PIECE" }],
    )).toEqual([]);
  });
  it("sends only the unit and identity, never a quantity", () => {
    const original = { product_id: "emb-3", category: "emballage", unit: "UA", quantity: 2 };
    const edited = { ...original, unit: "PIECE", quantity: 2 };
    expect(changedRecipeIngredientUnits([original], [edited]))
      .toEqual([{ product_id: "emb-3", category: "emballage", unit: "PIECE" }]);
  });
});