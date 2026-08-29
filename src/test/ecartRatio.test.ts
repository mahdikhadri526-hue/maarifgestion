import { describe, expect, it } from "vitest";
import { computeDay, type DayData } from "@/lib/ecartRatio";

describe("Calcul des écarts — formule globale", () => {
  it("calcule consommation, ventes et écart sur une journée", () => {
    const day: DayData = {
      SI_EMP: { Nougat: 1000 },
      SI_SP: { Nougat: 500 },
      ENTREE_EMP: { Nougat: 1 },
      ENTREE_SP: { Nougat: 3550 },
      SF_EMP: { Nougat: 2000 },
      SF_CHAMBRE_EMP: { Nougat: 3725 },
      SF_SP: { Nougat: 300 },
      VENTE_EMP: { "CORNET 1B EMP": 10 },
      VENTE_SP: { "0,5 L": 2 },
    };

    const r = computeDay("2026-05-01", day, undefined);

    // Ventes = 10×60 + 2×500 = 1600
    expect(r.ventesTotalG).toBe(1600);

    // Consommation = (SI_EMP 1000 + SI_SP 500) + (ENTREE_EMP 3725 + ENTREE_SP 3550) − (SF_EMP 2000 + SF_CHAMBRE 3725 + SF_SP 300)
    // = 1500 + 7275 - 6025 = 2750
    expect(r.consoTotalG).toBe(2750);

    // Écart = Ventes − Consommation = 1600 − 2750 = -1150
    expect(r.ecartTotalG).toBe(-1150);
  });

  it("reprend le stock final de la veille comme stock initial", () => {
    const prev: DayData = {
      SF_EMP: { TOTAL: 1000 },
      SF_SP: { Nougat: 200 },
    };
    const day: DayData = {
      ENTREE_EMP: { Nougat: 1 },
      ENTREE_SP: { Nougat: 0 },
      SF_EMP: { TOTAL: 800 },
      SF_SP: { Nougat: 100 },
      VENTE_EMP: { "CORNET 1B EMP": 5 },
      VENTE_SP: {},
    };

    const r = computeDay("2026-05-02", day, prev);

    // SI total = 1000 + 200 = 1200 ; SF total = 800 + 100 = 900 ; Entrées = 3725
    // Consommation = 1200 + 3725 - 900 = 4025
    expect(r.consoTotalG).toBe(4025);

    // Ventes = 5×60 = 300
    expect(r.ventesTotalG).toBe(300);

    // Écart = 300 - 4025 = -3725
    expect(r.ecartTotalG).toBe(-3725);
  });
});
