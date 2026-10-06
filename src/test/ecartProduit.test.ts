import { describe, expect, it } from "vitest";
import { PRODUITS, computeProduitDay, emptyDay, type SaleArticle } from "@/lib/ecartProduit";

const arts: SaleArticle[] = [
  { id: "a", product: "CAFE", zone: "EMP", name: "Expresso", dose: 8, sort_order: 0 },
  { id: "b", product: "SIDIALI", zone: "SP", name: "Sidi Ali 50cl", dose: 1, sort_order: 0 },
];

describe("Écart Café Dubois / Sidi Ali", () => {
  it("le café est saisi et calculé en grammes partout", () => {
    expect(PRODUITS.CAFE.inputUnit).toBe("g");
    expect(PRODUITS.CAFE.calcUnit).toBe("g");
    expect(PRODUITS.CAFE.factor).toBe(1);
  });

  it("calcule la consommation du café en grammes", () => {
    const d = emptyDay();
    d.SI = { EMP: 2000, SP: 1000 };
    d.ENTREE = { EMP: 1000, SP: 0 };
    d.SF = { EMP: 1500, SP: 500 };
    d.VENTES = { a: 100 };
    const r = computeProduitDay("CAFE", d, undefined, arts);
    expect(r.si).toBe(3000);
    expect(r.entrees).toBe(1000);
    expect(r.sf).toBe(2000);
    expect(r.conso).toBe(2000);
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
