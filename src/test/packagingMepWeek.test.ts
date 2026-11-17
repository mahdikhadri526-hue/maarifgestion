import { describe, expect, it, vi } from "vitest";
const { upsert, pdv } = vi.hoisted(() => ({
  upsert: vi.fn().mockResolvedValue({ error: null }), pdv: "pdv-test",
}));
vi.mock("@/lib/db", () => ({ supabase: { from: () => ({ upsert }) } }));
vi.mock("@/lib/pdvStore", () => ({ requireCurrentPdvId: () => pdv }));
import { setMiseEnPlaceStockForWeek } from "@/lib/miseEnPlaceData";

describe("saisies emballage propres à chaque semaine", () => {
  it("enregistre poids, pièces directes et somme dans la seule semaine choisie", async () => {
    await setMiseEnPlaceStockForWeek("bac-2.5", 70, "2026-11-09", { mepGrams: "500", mepDirectPieces: "20" });
    await setMiseEnPlaceStockForWeek("bac-2.5", 10, "2026-11-16", { mepGrams: "", mepDirectPieces: "10" });
    expect(upsert.mock.calls[0][0]).toEqual({ pdv_id: pdv, product_id: "bac-2.5", quantity: 70, week_start: "2026-11-09", mep_grams: "500", mep_direct_pieces: "20" });
    expect(upsert.mock.calls[1][0]).toEqual({ pdv_id: pdv, product_id: "bac-2.5", quantity: 10, week_start: "2026-11-16", mep_grams: "", mep_direct_pieces: "10" });
    expect(upsert.mock.calls[1][1]).toEqual({ onConflict: "pdv_id,product_id,week_start" });
  });
});