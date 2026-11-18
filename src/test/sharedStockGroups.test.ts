import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [
    { id: "stock-group:a", pdv_id: "pdv-a", name: "Chocolat", source_ids: ["ali-1", "ali-2"], exported: true },
    { id: "stock-group:b", pdv_id: "pdv-b", name: "Caramel", source_ids: ["ali-3", "ali-4"], exported: true },
  ],
  eq: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ supabase: { from: () => ({ select: () => ({
  order: () => Promise.resolve({ data: state.rows, error: null }), eq: state.eq,
}) }) } }));
vi.mock("@/lib/supabasePaginate", () => ({ fetchAllRows: async (query: () => Promise<{ data: unknown[] }>) => (await query()).data }));
import { loadCustomStockGroups } from "@/lib/customStockGroups";

describe("Regroupements partagés entre PDV", () => {
  it("charge les définitions de tous les PDV sans les copier ni changer leurs identifiants", async () => {
    const groups = await loadCustomStockGroups();
    expect(groups.map(group => group.id)).toEqual(["stock-group:a", "stock-group:b"]);
    expect(state.eq).not.toHaveBeenCalled();
  });
});