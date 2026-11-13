import { describe, expect, it, vi } from "vitest";
import { computeMaterialVariance, materialActualReference, materialSalesSection } from "@/lib/materialVariance";
import { canonicalStockIngredientId, getStockRecipeAggregates, stockRecipeIngredients, stockRecipePeriodTotals } from "@/lib/stockRecipeIngredients";

vi.mock("@/lib/stockData", () => ({ roundStockQuantity: (n: number) => Math.round(n * 1000) / 1000 }));

describe("Analyse des écarts matières", () => {
  it("offers the three existing combined stock references for recipes", () => {
    const aggregates = getStockRecipeAggregates([{ id: "ali-12", name: "TCHABA VERVEINE DOUCE" }, { id: "ali-33", name: "TCHABA GARDEN" }, { id: "ali-7", name: "CAFE BRESIL" }]);
    expect(aggregates.map(row => row.id)).toEqual(["__nespresso_agg__", "__the_aromatise_agg__", "__nutella_nestle_agg__"]);
    expect(aggregates[0].sourceIds).toEqual(["ali-29", "ali-30", "ali-31", "ali-32"]);
    expect(aggregates[1].sourceIds).toEqual(["ali-12", "ali-33"]);
    expect(aggregates[2].sourceIds).toEqual(["ali-21", "ali-15"]);
  });
  it("links tartes and fruits to exact Stock restant article identities and cream to its existing aggregate", () => {
    expect(stockRecipeIngredients.find(row => row.name === "Bûche")?.id).toBe("Bûche");
    expect(stockRecipeIngredients.find(row => row.name === "Orange fruits")?.id).toBe("Orange fruits");
    expect(stockRecipeIngredients.find(row => row.name === "Crème fraîche (mousse fouettée)")?.id).toBe("__chantilly_agg__");
    expect(stockRecipeIngredients.find(row => row.name === "Chanty.Fruit confits")?.id).toBe("Chanty.Fruit confits");
    expect(canonicalStockIngredientId("ali-3")).toBe("ali-3");
  });
  it.each(["Bûche", "Orange fruits", "Crème fraîche (mousse fouettée)"])("uses the Stock restant period outputs in recipe calculations for %s", article => {
    const rows = stockRecipePeriodTotals([
      { article, week_start: "2026-11-02", day_of_week: "Lundi", row_index: 0, stock_initial: 20, entrees: 5, sorties: null },
      { article, week_start: "2026-11-02", day_of_week: "Mardi", row_index: 0, stock_initial: 18, entrees: 999, sorties: null },
    ], "2026-11-02", "2026-11-02");
    const stock = rows.find(row => row.name === article);
    expect(stock?.sorties).toBe(7);
    if (!stock) throw new Error("Missing stock ingredient");
    const result = computeMaterialVariance([{ id: "recipe", finished_product_id: "sold", version: 1, active: true }],
      [{ recipe_id: "recipe", product_id: `weekly:${article}`, category: "alimentaire", quantity: 0.5, unit: "STOCK", notes: null }],
      { sold: 10 }, { [stock.id]: { name: stock.name, category: stock.category, quantity: stock.sorties, unit: "STOCK" } });
    expect(result[0].actual).toBe(7);
    expect(result[0].theoretical).toBe(5);
    expect(result[0].variance).toBe(2);
  });
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
  it("shows a duplicated ingredient once without combining incompatible quantities or repeating its actual usage", () => {
    const mixed = [{ ...ingredients[0], unit: "KILO", quantity: 0.5 }, { ...ingredients[1], unit: "UA", quantity: 2 }];
    const result = computeMaterialVariance(recipes, mixed, { sp: 10, emp: 5 }, { sidi: { name: "Sidi", category: "alimentaire", quantity: 18, unit: "kg" } });
    expect(result).toHaveLength(1);
    expect(result[0].actual).toBe(18);
    expect(result[0].theoretical).toBeNull();
    expect(result[0].unit).toBe("5 KILO + 10 UA");
    expect(result[0].variance).toBeNull();
    expect(mixed.map(row => row.quantity)).toEqual([0.5, 2]);
  });
  it("separates saved sales by period end without touching existing discrepancy sections", () => {
    expect(materialSalesSection("2026-11-07")).toBe("MATIERES:VENTES:2026-11-07");
    expect(materialSalesSection("2026-11-08")).not.toBe(materialSalesSection("2026-11-07"));
  });
});