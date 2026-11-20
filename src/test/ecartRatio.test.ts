import { afterEach, describe, expect, it } from "vitest";
import { applyGlaceAuto, computeDay, configureEcartExtraParfums, computeTotals, lastFinalBefore, PARFUMS, type DayData } from "@/lib/ecartRatio";

afterEach(() => configureEcartExtraParfums([]));

describe("Kg/bac partagés avec les écarts glace", () => {
  it("répercute une modification sur les entrées, le stock chambre et les écarts sans modifier les saisies ni les doses de vente", () => {
    const day = { ENTREE_EMP: { Nougat: 2 }, SF_CHAMBRE_EMP: { Nougat: 1 }, VENTE_EMP: { "CORNET 1B EMP": 10 } };
    configureEcartExtraParfums([], { Nougat: 4000 });
    expect(computeDay("2026-11-20", day, undefined)).toMatchObject({ entreeEmpG: 8000, sfChambreG: 4000, consoTotalG: 4000, ventesTotalG: 600, ecartTotalG: -3400 });
    configureEcartExtraParfums([], { Nougat: 4500 });
    expect(computeDay("2026-11-20", day, undefined)).toMatchObject({ entreeEmpG: 9000, sfChambreG: 4500, consoTotalG: 4500, ventesTotalG: 600, ecartTotalG: -3900 });
    expect(day.ENTREE_EMP.Nougat).toBe(2);
  });

  it("applique les poids des articles renommés sans créer de doublons", () => {
    configureEcartExtraParfums([{ name: "Banane", gram: 0 }], { Banane: 5000, "Citron menthe": 4200, "Orange cannelle": 4100, Réglisse: 3900 });
    expect(computeTotals({ ENTREE_EMP: { "BANANE CARAMILISE": 1, "CITRON MENTHE": 1, "ORANGE CANELLE": 1, REGLISSE: 1 } }).entreeEmpG).toBe(17200);
    expect(PARFUMS.filter(p => p.name === "Banane")).toHaveLength(0);
  });

  it("répercute les poids des ajouts et les zéros, en conservant le repli des poids absents", () => {
    configureEcartExtraParfums([{ name: "Nouveau parfum", gram: 0 }], { "Nouveau parfum": 3200, Nougat: 0 });
    expect(computeTotals({ ENTREE_EMP: { "Nouveau parfum": 2, Nougat: 3, Vanille: 1 } }).entreeEmpG).toBe(9950);
  });
});

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
