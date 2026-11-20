import { describe, expect, it } from "vitest";
import { fetchAllRows } from "@/lib/supabasePaginate";

function fakeTable(total: number) {
  const calls: { order?: string; from: number }[] = [];
  const build = () => {
    const call: { order?: string; from: number } = { from: -1 };
    const q = {
      order(col: string) { call.order = col; return q; },
      range(from: number, to: number) {
        call.from = from; calls.push(call);
        const data = Array.from({ length: Math.max(0, Math.min(total, to + 1) - from) }, (_, i) => ({ id: from + i }));
        return Promise.resolve({ data, error: null });
      },
    };
    return q;
  };
  return { build, calls };
}

describe("fetchAllRows", () => {
  it("trie chaque page par id pour que les totaux ne varient pas d'un chargement à l'autre", async () => {
    const t = fakeTable(2500);
    const rows = await fetchAllRows<{ id: number }>(t.build, { eagerPages: 2 });
    expect(rows).toHaveLength(2500);
    expect(new Set(rows.map(r => r.id)).size).toBe(2500);
    expect(t.calls.every(c => c.order === "id")).toBe(true);
  });

  it("accepte une autre colonne unique pour les tables sans id", async () => {
    const t = fakeTable(10);
    await fetchAllRows(t.build, { orderBy: "product_id" });
    expect(t.calls[0].order).toBe("product_id");
  });
});
