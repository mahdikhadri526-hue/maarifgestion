import { describe, expect, it } from "vitest";
import { computeProduitDay, emptyDay, type SaleArticle } from "@/lib/ecartProduit";

const arts: SaleArticle[] = [
  { id: "a", product: "CAFE", zone: "EMP", name: "Expresso", dose: 8, sort_order: 0 },
  { id: "b", product: "SIDIALI", zone: "SP", name: "Sidi Ali 50cl", dose: 1, sort_order: 0 },
];

describe("Écart Café Dubois / Sidi Ali", () => {
  it("convertit le café saisi en kg en grammes", () => {
    const d = emptyDay();
    d.SI = { EMP: 2, SP: 1 };
    d.ENTREE = { EMP: 1, SP: 0 };
    d.SF = { EMP: 1.5, SP: 0.5 };
    d.VENTES = { a: 100 };
    const r = computeProduitDay("CAFE", d, undefined, arts);
    expect(r.conso).toBe(2000); // 3000 + 1000 − 2000 g
    expect(r.ventes).toBe(800);
    expect(r.ecart).toBe(-1200);
  });

  it("reprend le stock final de la veille (bouteilles Sidi Ali)", () => {
    const prev = emptyDay();
    prev.SF = { EMP: 10, SP: 5 };
    const d = emptyDay();
    d.ENTREE = { EMP: 12, SP: 0 };
    d.SF = { EMP: 8, SP: 4 };
    d.VENTES = { b: 15 };
    const r = computeProduitDay("SIDIALI", d, prev, arts);
    expect(r.conso).toBe(15);
    expect(r.ecart).toBe(0);
  });
});
