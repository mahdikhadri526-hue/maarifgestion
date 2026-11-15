import { describe, expect, it } from "vitest";
import { buildMaterialActualDetails } from "@/lib/materialStockActuals";
import { customGroupMaterialActualDetail, type CustomStockGroup, type GroupSource } from "@/lib/customStockGroups";
import type { StockLevel, StockMovement } from "@/lib/stockData";

const level = (id: string, name = id): StockLevel => ({ productId: id, productName: name, category: "alimentaire", unit: "KILO", stockInitial: 0, totalEntrees: 0, totalSorties: 0, stockRestant: 0 } as StockLevel);
const movement = (id: string, quantity: number, date = "2026-11-10"): StockMovement => ({ productId: id, type: "sortie", quantity, date } as StockMovement);

describe("buildMaterialActualDetails", () => {
  it("explains sorties − mise en place × conversion for a single product", () => {
    const { actuals, details } = buildMaterialActualDetails([level("cafe")], [movement("cafe", 10)], "2026-11-01", "2026-11-13",
      [{ product_id: "cafe", conversion: "1000", unit_ref: "g" }], { cafe: 2 }, [], {});
    expect(actuals.cafe.quantity).toBe(8000);
    const detail = details.cafe;
    expect(detail.lines).toHaveLength(1);
    expect(detail.lines[0]).toMatchObject({ sorties: 10, miseEnPlace: 2, sortiesTotal: 8 });
    expect(detail).toMatchObject({ totalSorties: 8, conversion: "1000", total: 8000, unit: "g", conversionMissing: false });
  });

  it("keeps the native quantity and flags the missing conversion", () => {
    const { details } = buildMaterialActualDetails([level("cafe")], [movement("cafe", 10)], "2026-11-01", "2026-11-13", [], {}, [], {});
    expect(details.cafe).toMatchObject({ totalSorties: 10, total: 10, unit: "KILO", conversionMissing: true });
  });
});

describe("customGroupMaterialActualDetail", () => {
  const group: CustomStockGroup = { id: "grp-1", pdv_id: "pdv", name: "Groupe", source_ids: ["a", "b"], exported: true };
  const sources: GroupSource[] = [
    { id: "a", name: "Produit A", category: "alimentaire", unit: "KILO", stockInitial: 0, entrees: 0, sorties: 5, stockRestant: 0 },
    { id: "b", name: "Produit B", category: "alimentaire", unit: "KILO", stockInitial: 0, entrees: 0, sorties: 3, stockRestant: 0 },
  ];

  it("sums each source converted with its own reference", () => {
    const detail = customGroupMaterialActualDetail(group, sources, { a: 1 }, {
      a: { conversion: "2", unitRef: "kg" }, b: { conversion: "4", unitRef: "kg" },
    });
    expect(detail.lines.map(line => [line.name, line.sortiesTotal, line.converted])).toEqual([["Produit A", 4, 8], ["Produit B", 3, 12]]);
    expect(detail).toMatchObject({ total: 20, unit: "kg", conversionMissing: false });
  });

  it("falls back to the group conversion for a source without its own", () => {
    const detail = customGroupMaterialActualDetail(group, sources, {}, {
      a: { conversion: "2", unitRef: "kg" }, "grp-1": { conversion: "0.5", unitRef: "kg" },
    });
    expect(detail.lines[1]).toMatchObject({ conversion: "0.5", converted: 1.5 });
    expect(detail.total).toBe(11.5);
  });
});
