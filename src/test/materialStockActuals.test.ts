import { describe, expect, it, vi } from "vitest";
import { buildMaterialStockActuals } from "@/lib/materialStockActuals";
import { computeMaterialVariance } from "@/lib/materialVariance";
import type { StockLevel, StockMovement } from "@/lib/stockData";

vi.mock("@/lib/stockData", () => ({ roundStockQuantity: (n: number) => Number(n.toFixed(2)) }));
const level = (id: string, name = id): StockLevel => ({ productId: id, productName: name, category: "alimentaire", conditionnement: "", unit: "PIECE", stockInitial: 0, totalEntrees: 0, totalSorties: 0, stockRestant: 0 });
const movement = (id: string, quantity: number, date = "2026-11-02"): StockMovement => ({ id: `${id}-${date}`, productId: id, productName: id, category: "alimentaire", type: "sortie", quantity, date });
const reference = (id: string, conversion = "1") => ({ product_id: id, conversion, unit_ref: "pièce" });
const recipes = [{ id: "r", finished_product_id: "p", version: 1, active: true }];

describe("Material stock output coverage", () => {
  it("reads saved tarte and fruit stock units without changing quantities or overriding reference units", () => {
    const weekly = ["Tarte 6", "Orange fruits"].flatMap(article => [
      { article, week_start: "2026-11-02", day_of_week: "Lundi", row_index: 0, stock_initial: 20, entrees: 5, sorties: null },
      { article, week_start: "2026-11-02", day_of_week: "Mardi", row_index: 0, stock_initial: 18, entrees: 0, sorties: null },
    ]);
    const actuals = buildMaterialStockActuals([], [], "2026-11-02", "2026-11-02", [], {}, weekly, {}, { "Tarte 6": "PIECE", "Orange fruits": "KILO" });
    expect(actuals["Tarte 6"]).toMatchObject({ quantity: 7, unit: "PIECE" });
    expect(actuals["Orange fruits"]).toMatchObject({ quantity: 7, unit: "KILO" });
    const converted = buildMaterialStockActuals([], [], "2026-11-02", "2026-11-02", [{ product_id: "Tarte 6", conversion: "2", unit_ref: "g" }], {}, weekly, {}, { "Tarte 6": "PIECE" });
    expect(converted["Tarte 6"]).toMatchObject({ quantity: 14, unit: "g" });
  });
  it("includes PDV-only stock products and restricts their outputs to the period", () => {
    const actuals = buildMaterialStockActuals([level("pdv-only")], [movement("pdv-only", 12), movement("pdv-only", 90, "2026-10-31")], "2026-11-01", "2026-11-13", [reference("pdv-only")], {}, [], {});
    expect(actuals["pdv-only"].quantity).toBe(12);
  });
  it("shows stock outputs without a linked current recipe, without inventing theoretical usage", () => {
    const result = computeMaterialVariance([], [], {}, { missing: { name: "Matière", category: "alimentaire", quantity: 12, unit: "pièce" } });
    expect(result).toHaveLength(1);
    expect(result[0].actual).toBe(12);
    expect(result[0].theoretical).toBeNull();
    expect(result[0].variance).toBeNull();
  });
  it("shows native outputs when a reference factor is missing and forbids a misleading variance", () => {
    const actuals = buildMaterialStockActuals([level("missing")], [movement("missing", 12)], "2026-11-01", "2026-11-13", [], {}, [], {});
    const result = computeMaterialVariance(recipes, [{ recipe_id: "r", product_id: "missing", category: "alimentaire", quantity: 1, unit: "PIECE", notes: null }], { p: 5 }, actuals);
    expect(result[0].actual).toBe(12);
    expect(result[0].variance).toBeNull();
    expect(actuals.missing.conversionMissing).toBe(true);
  });
  it("preserves explicit shared sorties, signed mise en place and reference conversion", () => {
    const actuals = buildMaterialStockActuals([level("ice", "GLACE")], [], "2026-11-01", "2026-11-13", [reference("ice", "2")], { ice: 3 }, [], { ice: { stockInitial: 99, entrees: 0, stockRestant: 99, sorties: 8 } });
    expect(actuals.ice.quantity).toBe(10);
  });
  it("includes Macaron, Amandes and Sirop with adjacent-count context and the chocolate component", () => {
    const weekly = ["Mac.Chocolat P", "Amd.Crml", "Sirop.Crml"].flatMap(article => [
      { article, week_start: "2026-11-02", day_of_week: "Lundi", row_index: 0, stock_initial: 20, entrees: 5, sorties: null },
      { article, week_start: "2026-11-02", day_of_week: "Mardi", row_index: 0, stock_initial: 18, entrees: 0, sorties: null },
    ]);
    const actuals = buildMaterialStockActuals([level("ali-9")], [movement("ali-9", 2)], "2026-11-02", "2026-11-02", [reference("__macaron_agg__"), reference("__amandes_agg__"), reference("__sirop_agg__")], {}, weekly, {});
    expect(actuals.__macaron_agg__.quantity).toBe(7);
    expect(actuals.__amandes_agg__.quantity).toBe(7);
    expect(actuals.__sirop_agg__.quantity).toBe(9);
  });
  it("includes Nespresso, tea and Nutella outputs using the combined row reference only", () => {
    const actuals = buildMaterialStockActuals([level("ali-29"), level("ali-12", "TCHABA"), level("ali-21"), level("ali-15")], [movement("ali-29", 12), movement("ali-12", 8), movement("ali-21", 3), movement("ali-15", 2)], "2026-11-01", "2026-11-13", [reference("__nespresso_agg__"), reference("__the_aromatise_agg__"), reference("__nutella_nestle_agg__", "0.5")], {}, [], {});
    expect(actuals.__nespresso_agg__.quantity).toBe(12);
    expect(actuals.__the_aromatise_agg__.quantity).toBe(8);
    expect(actuals.__nutella_nestle_agg__.quantity).toBe(2.5);
  });
});