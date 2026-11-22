import { describe, expect, it } from "vitest";
import { moveMaterialSale, orderMaterialSales, readMaterialSalesOrder } from "@/lib/materialSalesOrder";

describe("ordre des produits vendus", () => {
  it("déplace un produit au-dessus et en dessous sans modifier les ventes", () => {
    const products = [{ id: "A", qty: 12 }, { id: "B", qty: 5 }, { id: "C", qty: 8 }];
    const up = moveMaterialSale(["A", "B", "C"], ["A", "B", "C"], "B", -1);
    expect(orderMaterialSales(products, up)).toEqual([products[1], products[0], products[2]]);
    expect(moveMaterialSale(up, up, "B", 1)).toEqual(["A", "B", "C"]);
    expect(products.map(row => row.qty)).toEqual([12, 5, 8]);
  });
  it("respecte les limites et laisse les produits masqués à leur place", () => {
    expect(moveMaterialSale(["A", "hidden", "B"], ["A", "B"], "B", -1)).toEqual(["B", "hidden", "A"]);
    expect(moveMaterialSale(["A", "B"], ["A", "B"], "A", -1)).toEqual(["A", "B"]);
    expect(moveMaterialSale(["A", "B"], ["A", "B"], "B", 1)).toEqual(["A", "B"]);
  });
  it("relit l’ordre par PDV et conserve les nouveaux produits", () => {
    localStorage.setItem("material-sales-order:pdv-test", JSON.stringify(["B", "A"]));
    expect(orderMaterialSales([{ id: "A" }, { id: "B" }, { id: "new" }], readMaterialSalesOrder("pdv-test"))).toEqual([{ id: "B" }, { id: "A" }, { id: "new" }]);
    expect(readMaterialSalesOrder("other-pdv")).toEqual([]);
    localStorage.removeItem("material-sales-order:pdv-test");
  });
});