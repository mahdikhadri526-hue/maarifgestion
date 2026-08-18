import { describe, expect, it } from "vitest";
import { computeDay, eachDate, shiftDate, type DayData } from "@/lib/ecartRatio";
import fixture from "./ratioMai.fixture.json";

const days = fixture.days as Record<string, DayData>;
const expected = fixture.expected as Record<string, Record<string, number>>;

const run = (date: string) => computeDay(date, days[date], days[shiftDate(date, -1)]);

describe("Calcul des écarts — conformité RATIO MAARIF MAI.xlsx", () => {
  it("reproduit exactement consommation, ventes et écarts du 1er au 28 mai", () => {
    for (const date of eachDate("2026-05-01", "2026-05-28")) {
      const r = run(date);
      const e = expected[date];
      expect(Math.round(r.consoEmpG), `conso emporter ${date}`).toBe(Math.round(e.consoEmpG));
      expect(Math.round(r.consoSpG), `conso surplace ${date}`).toBe(Math.round(e.consoSpG));
      expect(Math.round(r.ventesEmpG), `ventes emporter ${date}`).toBe(Math.round(e.ventesEmpG));
      expect(Math.round(r.ventesSpG), `ventes surplace ${date}`).toBe(Math.round(e.ventesSpG));
      expect(Math.round(r.ecartEmpG), `écart emporter ${date}`).toBe(Math.round(e.ecartEmpG));
      expect(Math.round(r.ecartSpG), `écart surplace ${date}`).toBe(Math.round(e.ecartSpG));
      expect(Math.round(r.ecartTotalG), `écart total ${date}`).toBe(Math.round(e.ecartTotalG));
    }
  });

  // Le 29 mai, les cellules du fichier Excel sont décalées d'une colonne
  // (TOTAL STOCK FINAL!AE5 pointe sur AE23/AF23 au lieu de AD23/AE23),
  // le stock final y est donc lu à 0. La valeur corrigée est vérifiée ici.
  it("corrige la référence décalée du 29 mai (bug du fichier Excel)", () => {
    const r = run("2026-05-29");
    expect(Math.round(r.consoEmpG)).toBe(514573);
    expect(Math.round(r.consoSpG)).toBe(Math.round(expected["2026-05-29"].consoSpG));
    expect(Math.round(r.ventesEmpG)).toBe(Math.round(expected["2026-05-29"].ventesEmpG));
  });
});
