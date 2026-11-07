import { describe, expect, it } from "vitest";
import { latestRecipeVersions } from "@/lib/recipeVersions";
describe("recipe versions", () => {
  it("opens the latest active recipe without counting historical ingredients", () => {
    expect(latestRecipeVersions([
      { id: "old", finished_product_id: "coffee-sp", version: 1, active: false },
      { id: "current", finished_product_id: "coffee-sp", version: 2, active: true },
    ]).map(r => r.id)).toEqual(["current"]);
  });
  it("keeps sur place, emporter, autres and tartes independent", () => {
    const rows = ["surplace", "emporter", "autres", "tartes"].map(id => ({ id, finished_product_id: id, version: 1, active: true }));
    expect(latestRecipeVersions(rows).map(r => r.id)).toEqual(["surplace", "emporter", "autres", "tartes"]);
  });
});