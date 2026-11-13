import { describe, expect, it } from "vitest";
import { createStockReferenceSaver, type StockReferencePatch } from "@/lib/stockReferenceSave";

describe("reference conversion persistence", () => {
  it("executes lazy requests and keeps conversion and L unit after reloading", async () => {
    const database: Record<string, StockReferencePatch> = {};
    let executed = 0;
    const save = createStockReferenceSaver((id, patch) => ({
      then: (resolve) => {
        executed++;
        database[id] = { ...database[id], ...patch };
        return Promise.resolve(resolve?.({ error: null }));
      },
    }));
    await Promise.all([
      save("__chantilly_agg__", { conversion: "0.5" }),
      save("__chantilly_agg__", { conversion: "1" }),
      save("__chantilly_agg__", { unitRef: "L" }),
    ]);
    expect(executed).toBe(3);
    expect(JSON.parse(JSON.stringify(database)).__chantilly_agg__).toEqual({ conversion: "1", unitRef: "L" });
  });

  it("reports a refused write and allows the next retry", async () => {
    let attempts = 0;
    const save = createStockReferenceSaver(async () => ({ error: ++attempts === 1 ? new Error("network failure") : null }));
    await expect(save("tarte", { unitRef: "pièce" })).rejects.toThrow("network failure");
    await expect(save("tarte", { unitRef: "pièce" })).resolves.toBeUndefined();
    expect(attempts).toBe(2);
  });
});