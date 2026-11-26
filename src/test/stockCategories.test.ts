import { describe, expect, it } from "vitest";
import { mergeStockCategories, matchesStockCategory } from "@/lib/stockCategories";

describe("stock categories shared display rules", () => {
  it("adds a category beside Alimentaire and Emballage", () => {
    expect(mergeStockCategories([{ category_key: "stock:fruits", name: "Fruits frais", base_category: "alimentaire", active: true }]).map(row => row.name)).toEqual(["Alimentaire", "Emballage", "Fruits frais"]);
  });
  it("renames the existing category without changing its calculation identity", () => {
    const rows = mergeStockCategories([{ category_key: "alimentaire", name: "Épicerie", base_category: "alimentaire", active: true }]);
    expect(rows[0]).toEqual({ category_key: "alimentaire", name: "Épicerie", base_category: "alimentaire", active: true });
  });
  it("uses the same product assignment for stock, order and movement lists", () => {
    const categories = mergeStockCategories([{ category_key: "stock:fruits", name: "Fruits", base_category: "alimentaire", active: true }]);
    expect(matchesStockCategory("ali-1", "alimentaire", "stock:fruits", categories, { "ali-1": "stock:fruits" })).toBe(true);
    expect(matchesStockCategory("ali-1", "alimentaire", "alimentaire", categories, { "ali-1": "stock:fruits" })).toBe(false);
    expect(matchesStockCategory("emb-1", "emballage", "emballage", categories, { "ali-1": "stock:fruits" })).toBe(true);
  });
  it("removes Alimentaire from all displayed lists without deleting its product assignment", () => {
    const categories = mergeStockCategories([{ category_key: "alimentaire", name: "Alimentaire", base_category: "alimentaire", active: false }]);
    const assignments = { "ali-1": "alimentaire" };
    expect(matchesStockCategory("ali-1", "alimentaire", "all", categories, assignments)).toBe(false);
    expect(assignments).toEqual({ "ali-1": "alimentaire" });
    expect(matchesStockCategory("emb-1", "emballage", "all", categories, assignments)).toBe(true);
  });
  it("restores products with the same identities after restoring a category", () => {
    const rows = [{ category_key: "stock:fruits", name: "Fruits", base_category: "alimentaire" as const, active: false }];
    const assignment = { "ali-1": "stock:fruits" };
    expect(matchesStockCategory("ali-1", "alimentaire", "all", mergeStockCategories(rows), assignment)).toBe(false);
    expect(matchesStockCategory("ali-1", "alimentaire", "all", mergeStockCategories(rows.map(row => ({ ...row, active: true }))), assignment)).toBe(true);
  });
});