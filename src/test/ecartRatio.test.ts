import { describe, expect, it } from "vitest";
import { computeDay, eachDate, type DayData } from "@/lib/ecartRatio";
import fixture from "./ratioMai.fixture.json";

const days = fixture.days as Record<string, DayData>;
const expected = fixture.expected as Record<string, Record<string, number>>;

describe("Calcul des écarts — conformité RATIO MAARIF MAI.xlsx", () => {
  it("reproduit exactement consommation, ventes et écarts sur les 31 jours de mai", () => {
    for (const date of eachDate("2026-05-01", "2026-05-31")) {
      const prev = days[
        new Date(new Date(`${date}T12:00:00`).getTime() - 86400000).toISOString().slice(0, 10)
      ];
      const r = computeDay(date, days[date], prev);
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
});
