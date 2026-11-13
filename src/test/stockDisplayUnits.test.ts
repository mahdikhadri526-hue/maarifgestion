import { describe, expect, it } from "vitest";
import { resolveStockDisplayUnit } from "@/lib/stockData";

describe("Stock remaining saved display units", () => {
  it("keeps the saved Litre for Crème chantilly after rebuilding the row", () => {
    const persisted = JSON.parse(JSON.stringify({ __chantilly_agg__: "LITRE" }));
    expect(resolveStockDisplayUnit("__chantilly_agg__", "KILO", persisted)).toBe("LITRE");
  });

  it("prefers saved units for other aggregate and ordinary products", () => {
    expect(resolveStockDisplayUnit("__macaron_agg__", "PIECE", { __macaron_agg__: "COLIS" })).toBe("COLIS");
    expect(resolveStockDisplayUnit("ali-7", "KILO", { "ali-7": "LITRE" })).toBe("LITRE");
  });

  it("keeps the original default when this PDV has no saved unit", () => {
    expect(resolveStockDisplayUnit("__chantilly_agg__", "KILO", {})).toBe("KILO");
  });
});