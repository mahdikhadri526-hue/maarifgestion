import { describe, expect, it } from "vitest";
import { computeConsommation, computeEcart } from "@/lib/ecartData";

// Valeurs de référence extraites du fichier RATIO MAARIF MAI.xlsx (feuille ECART GLACE)
const MAI = [
  { jour: "01", si: 840643, entrees: 0, sf: 823246, ventes: 258626, conso: 10087, ecart: 248539, sortiesSurplace: 7310 },
];

describe("Calcul des écarts — conformité RATIO MAI", () => {
  it("reproduit la consommation et l'écart du 1er mai (Emporter)", () => {
    const d = MAI[0];
    // Emporter : stock final inclut la sortie vers le surplace (entrée surplace)
    const row = {
      stock_initial: d.si,
      entrees: d.entrees,
      stock_final: d.sf + d.sortiesSurplace,
      ventes: d.ventes,
    };
    expect(computeConsommation(row)).toBe(d.conso);
    expect(computeEcart(row)).toBe(d.ecart);
  });

  it("Écart = Ventes − Consommation", () => {
    const row = { stock_initial: 100, entrees: 50, stock_final: 30, ventes: 90 };
    expect(computeConsommation(row)).toBe(120);
    expect(computeEcart(row)).toBe(-30);
  });
});
