import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { single, select, eq, update, from };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: db.from } }));
import { archiveFinishedProduct } from "@/lib/finishedProductLifecycle";

describe("suppression des produits finis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.single.mockResolvedValue({ data: { id: "produit-test" }, error: null });
  });
  it("retire seulement le produit demandé sans supprimer ses recettes ni ses ingrédients", async () => {
    await archiveFinishedProduct("produit-test", true);
    expect(db.from.mock.calls).toEqual([["finished_products"]]);
    expect(db.update.mock.calls).toEqual([[{ active: false }]]);
    expect(db.eq.mock.calls).toEqual([["id", "produit-test"]]);
  });
  it("refuse la suppression sans droit de gestion", async () => {
    await expect(archiveFinishedProduct("produit-test", false)).rejects.toThrow("non autorisée");
    expect(db.from).not.toHaveBeenCalled();
  });
  it("signale un refus d'enregistrement sans annoncer une suppression réussie", async () => {
    db.single.mockResolvedValue({ data: null, error: new Error("Refus") });
    await expect(archiveFinishedProduct("produit-test", true)).rejects.toThrow("Refus");
  });
});