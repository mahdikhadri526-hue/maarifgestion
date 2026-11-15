import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadMaterialAnalysis } from "@/lib/materialVarianceData";
import { getMiseEnPlaceTotalsForPeriod, getMiseEnPlaceStocksForWeek } from "@/lib/miseEnPlaceData";
import { buildMaterialActualDetails } from "@/lib/materialStockActuals";

vi.mock("@/lib/pdvStore", () => ({ requireCurrentPdvId: () => "pdv-test" }));
vi.mock("@/lib/supabasePaginate", () => ({ fetchAllRows: async () => [] }));
vi.mock("@/lib/customStockGroups", () => ({ loadCustomStockGroups: async () => [] }));
vi.mock("@/lib/stockData", () => ({
  roundStockQuantity: (n: number) => Number(n.toFixed(2)),
  getProductUnits: async () => ({}),
  getStockLevels: async () => [{ productId: "bande-pp", productName: "Bande PP", category: "emballage", unit: "PIECE" }],
  getMovements: async () => [{ productId: "bande-pp", type: "sortie", quantity: 100, date: "2026-08-10" }],
}));
vi.mock("@/lib/miseEnPlaceData", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/miseEnPlaceData")>();
  return {
    ...original,
    getMiseEnPlaceTotalsForPeriod: vi.fn(async (start, end) => original.mepTotalsFromRows([
      { product_id: "bande-pp", week_start: "2026-07-27", quantity: 8 },
      { product_id: "bande-pp", week_start: "2026-08-10", quantity: 12 },
      { product_id: "bande-pp", week_start: "2026-08-31", quantity: 50 },
    ], start, end)),
    getMiseEnPlaceStocksForWeek: vi.fn(async () => ({ "bande-pp": 12 })),
    getMiseEnPlaceStocks: vi.fn(async () => ({})),
  };
});

describe("Material analysis mise en place", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deducts all 20 Bande PP counted in August and shows them in the real detail", async () => {
    const result = await loadMaterialAnalysis("2026-08-01", "2026-08-31");
    expect(getMiseEnPlaceTotalsForPeriod).toHaveBeenCalledWith("2026-08-01", "2026-08-31");
    expect(getMiseEnPlaceStocksForWeek).not.toHaveBeenCalled();
    expect(result.actualDetails["bande-pp"].lines[0]).toMatchObject({ sorties: 100, miseEnPlace: 20, sortiesTotal: 80 });
    expect(result.actuals["bande-pp"].quantity).toBe(80);
  });

  it("keeps single-day mise en place on its counting day only", async () => {
    const counted = await loadMaterialAnalysis("2026-08-10", "2026-08-10");
    expect(counted.actualDetails["bande-pp"].lines[0].miseEnPlace).toBe(12);
    const other = await loadMaterialAnalysis("2026-08-11", "2026-08-11");
    expect(other.actualDetails["bande-pp"].lines[0].miseEnPlace).toBe(0);
    expect(getMiseEnPlaceTotalsForPeriod).not.toHaveBeenCalled();
  });

  it("also deducts mise en place for weekly stock articles without a reference conversion", () => {
    const { actuals, details } = buildMaterialActualDetails([], [], "2026-08-10", "2026-08-10", [], { "Tarte 6": 2 }, [
      { article: "Tarte 6", week_start: "2026-08-10", day_of_week: "Lundi", row_index: 0, stock_initial: 20, entrees: 5, sorties: null },
      { article: "Tarte 6", week_start: "2026-08-10", day_of_week: "Mardi", row_index: 0, stock_initial: 18, entrees: 0, sorties: null },
    ], {});
    expect(details["Tarte 6"].lines[0]).toMatchObject({ sorties: 7, miseEnPlace: 2, sortiesTotal: 5 });
    expect(actuals["Tarte 6"].quantity).toBe(5);
  });
});