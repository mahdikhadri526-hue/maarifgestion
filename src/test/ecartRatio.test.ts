import { describe, expect, it } from "vitest";
import { applyGlaceAuto, computeDay, lastFinalBefore, type DayData } from "@/lib/ecartRatio";

describe("Calcul des écarts — formule globale", () => {
  it("calcule consommation, ventes et écart sur une journée", () => {
    const day: DayData = {
      SI_EMP: { Nougat: 1000 },
      SI_SP: { Nougat: 500 },
      ENTREE_EMP: { Nougat: 1 },
      ENTREE_SP: { Nougat: 3550 },
      SF_EMP: { Nougat: 2000 },
      SF_CHAMBRE_EMP: { Nougat: 1 },
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
      SF_EMP: { Nougat: 1000 },
      SF_SP: { Nougat: 200 },
    };
    const day: DayData = {
      ENTREE_EMP: { Nougat: 1 },
      ENTREE_SP: { Nougat: 0 },
      SF_EMP: { Nougat: 800 },
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

  it("compose le report quand la veille contient seulement le stock chambre automatique", () => {
    const history = new Map<string, DayData>([
      ["2026-08-29", { SF_EMP: { Nougat: 1200 }, SF_SP: { Nougat: 300 } }],
      ["2026-08-30", { SF_CHAMBRE_EMP: { Nougat: 4 } }],
    ]);

    const prev = lastFinalBefore(history, "2026-08-31");
    expect(prev?.SF_EMP.Nougat).toBe(1200);
    expect(prev?.SF_SP.Nougat).toBe(300);
    expect(prev?.SF_CHAMBRE_EMP.Nougat).toBe(4);
  });

  it("conserve les produits absents de l'automatisation et applique les zéros explicites", () => {
    const history = new Map<string, DayData>([
      ["2026-08-30", { SF_CHAMBRE_EMP: { Framboise: 2, Nougat: 8 } }],
    ]);
    const auto = new Map([
      ["2026-08-30", { entrees: {}, sfChambre: { Nougat: 0 } }],
    ]);

    const merged = applyGlaceAuto(history, auto);
    expect(merged.get("2026-08-30")?.SF_CHAMBRE_EMP).toEqual({ Framboise: 2, Nougat: 0 });
  });
});
