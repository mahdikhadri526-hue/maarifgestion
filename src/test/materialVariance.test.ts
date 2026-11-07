import { describe, expect, it } from "vitest";
import { computeMaterialVariance, materialActualReference, materialSalesSection } from "@/lib/materialVariance";

describe("Analyse des écarts matières", () => {
  const recipes = [{ id: "surplace", finished_product_id: "sp", version: 1, active: true }, { id: "emporter", finished_product_id: "emp", version: 1, active: true }, { id: "old", finished_product_id: "sp", version: 0, active: false }];
  const ingredients = [{ recipe_id: "surplace", product_id: "sidi", category: "alimentaire", quantity: 1, unit: "PIECE", notes: null }, { recipe_id: "emporter", product_id: "sidi", category: "alimentaire", quantity: 1, unit: "PIECE", notes: null }, { recipe_id: "old", product_id: "sidi", category: "alimentaire", quantity: 99, unit: "PIECE", notes: null }];
  it("cumulates sold quantity times recipe dose across categories, excluding old recipes", () => {
    const result = computeMaterialVariance(recipes, ingredients, { sp: 10, emp: 5 }, { sidi: { name: "Sidi Ali", category: "alimentaire", quantity: 18, unit: "pièce" } });
    expect(result).toHaveLength(1);
    expect(result[0].theoretical).toBe(15);
    expect(result[0].variance).toBe(3);
  });
  it("uses Sorties total reference including mise en place", () => {
    expect(materialActualReference(100, 20, 80, 15, "0.116")).toBe(2.9);
  });
  it("keeps missing conversions unknown instead of zero", () => {
    expect(materialActualReference(100, 20, 80, 15, "")).toBeNull();
  });
  it("does not invent stock links for custom ingredients", () => {
    const result = computeMaterialVariance(recipes, [{ ...ingredients[0], product_id: "custom:cream" }], { sp: 10 }, {});
    expect(result[0].actual).toBeNull();
    expect(result[0].variance).toBeNull();
    expect(result[0].theoretical).toBe(10);
  });
  it("never subtracts different units", () => {
    const result = computeMaterialVariance(recipes, ingredients, { sp: 10 }, { sidi: { name: "Sidi", category: "alimentaire", quantity: 10, unit: "kg" } });
    expect(result[0].variance).toBeNull();
  });
  it("separates saved sales by period end without touching existing discrepancy sections", () => {
    expect(materialSalesSection("2026-11-07")).toBe("MATIERES:VENTES:2026-11-07");
    expect(materialSalesSection("2026-11-08")).not.toBe(materialSalesSection("2026-11-07"));
  });
});