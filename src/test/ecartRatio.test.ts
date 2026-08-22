import { describe, expect, it } from "vitest";
import { computeDay, type DayData } from "@/lib/ecartRatio";

describe("Calcul des écarts — formule globale", () => {
  it("calcule consommation, ventes et écart sur une journée", () => {
    const day: DayData = {
      SI_EMP: { TOTAL: 1000 },
      SI_SP: { Nougat: 500 },
      ENTREE_EMP: { Nougat: 1 },
      ENTREE_SP: { Nougat: 3550 },
      SF_FRIGO_EMP: { Nougat: 2000 },
      SF_CHAMBRE_EMP: { Nougat: 1 },
      SF_SP: { Nougat: 300 },
      VENTE_EMP: { "CORNET 1B EMP": 10 },
      VENTE_SP: { "0,5 L": 2 },
    };

    const r = computeDay("2026-05-01", day, undefined);

    // Ventes = 10×60 + 2×500 = 1600
    expect(r.ventesTotalG).toBe(1600);

    // Consommation = (SI_EMP 1000 + SI_SP 500) + (ENTREE_EMP 3725 + ENTREE_SP 3550) − (SF_EMP 2000+3725 + SF_SP 300)
    // = 1500 + 7275 - 5725 - 300 = 2750
    expect(r.consoTotalG).toBe(2750);

    // Écart = Consommation − Ventes = 2750 − 1600 = 1150
    expect(r.ecartTotalG).toBe(1150);
  });

  it("reprend le stock final de la veille comme stock initial", () => {
    const prev: DayData = {
      SF_FRIGO_EMP: { Nougat: 1000 },
      SF_CHAMBRE_EMP: { Nougat: 500 },
      SF_SP: { Nougat: 200 },
    };
    const day: DayData = {
      ENTREE_EMP: { Nougat: 1 },
      ENTREE_SP: { Nougat: 0 },
      SF_FRIGO_EMP: { Nougat: 800 },
      SF_CHAMBRE_EMP: { Nougat: 400 },
      SF_SP: { Nougat: 100 },
      VENTE_EMP: { "CORNET 1B EMP": 5 },
      VENTE_SP: {},
    };

    const r = computeDay("2026-05-02", day, prev);

    // SI total = 1000+500+200 = 1700 ; SF total = 800+400×3725+100 = 149900 ; Entrées = 3725
    // Consommation = 1700 + 3725 - 149900 = -144475
    expect(r.consoTotalG).toBe(-144475);

    // Ventes = 5×60 = 300
    expect(r.ventesTotalG).toBe(300);

    // Écart = -144475 - 300 = -144775
    expect(r.ecartTotalG).toBe(-144775);
  });
});
