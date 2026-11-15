import { describe, it, expect } from "vitest";
import { mepTotalsFromRows } from "@/lib/miseEnPlaceData";

// Règle : en filtre mois / période / tout, la colonne « Stock mise en place »
// affiche le TOTAL des quantités saisies dont le jour de comptage tombe dans
// la période (la semaine chevauchant la fin du mois compte pour le mois suivant).

describe("mepTotalsFromRows", () => {
  it("additionne les saisies des semaines de la période", () => {
    const rows = [
      { product_id: "a", quantity: 2, week_start: "2026-11-02" }, // comptage lun. 02/11
      { product_id: "a", quantity: 3, week_start: "2026-11-09" }, // comptage lun. 09/11
      { product_id: "b", quantity: 5, week_start: "2026-11-09" },
    ];
    expect(mepTotalsFromRows(rows, "2026-11-01", "2026-11-30")).toEqual({ a: 5, b: 5 });
  });

  it("exclut les semaines hors période", () => {
    const rows = [
      { product_id: "a", quantity: 2, week_start: "2026-10-19" }, // comptage lun. 19/10
      { product_id: "a", quantity: 3, week_start: "2026-11-09" },
    ];
    expect(mepTotalsFromRows(rows, "2026-11-01", "2026-11-30")).toEqual({ a: 3 });
  });

  it("rattache la semaine chevauchant la fin du mois au mois suivant", () => {
    // Semaine du 26/10 au 01/11 : comptage le 01/11 → appartient à novembre.
    const rows = [{ product_id: "a", quantity: 4, week_start: "2026-10-26" }];
    expect(mepTotalsFromRows(rows, "2026-10-01", "2026-10-31")).toEqual({});
    expect(mepTotalsFromRows(rows, "2026-11-01", "2026-11-30")).toEqual({ a: 4 });
  });

  it("sans bornes (vue « Tout »), additionne toutes les saisies", () => {
    const rows = [
      { product_id: "a", quantity: 2, week_start: "2026-09-07" },
      { product_id: "a", quantity: 1, week_start: "2026-11-09" },
    ];
    expect(mepTotalsFromRows(rows, null, null)).toEqual({ a: 3 });
  });
});
