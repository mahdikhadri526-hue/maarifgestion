import { describe, it, expect } from "vitest";
import { mepTotalsFromRows, inventoryDayOfWeek, canEditMiseEnPlace } from "@/lib/miseEnPlaceData";

// Règle : en filtre mois / période / tout, la colonne « Stock mise en place »
// affiche le TOTAL des quantités saisies dont le jour de comptage tombe dans
// la période (la semaine de fin de mois compte pour le mois qui se termine).

describe("mepTotalsFromRows", () => {
  it("additionne les saisies des semaines de la période", () => {
    const rows = [
      { product_id: "a", quantity: 2, week_start: "2026-11-02" }, // comptage dim. 08/11
      { product_id: "a", quantity: 3, week_start: "2026-11-09" }, // comptage dim. 15/11
      { product_id: "b", quantity: 5, week_start: "2026-11-09" },
    ];
    expect(mepTotalsFromRows(rows, "2026-11-01", "2026-11-30")).toEqual({ a: 5, b: 5 });
  });

  it("exclut les semaines hors période", () => {
    const rows = [
      { product_id: "a", quantity: 2, week_start: "2026-10-19" }, // comptage dim. 25/10
      { product_id: "a", quantity: 3, week_start: "2026-11-09" },
    ];
    expect(mepTotalsFromRows(rows, "2026-11-01", "2026-11-30")).toEqual({ a: 3 });
  });

  it("rattache la semaine chevauchant la fin du mois au mois qui se termine", () => {
    // Semaine du 26/10 au 01/11 : comptage le 31/10 → appartient à octobre.
    const rows = [{ product_id: "a", quantity: 4, week_start: "2026-10-26" }];
    expect(mepTotalsFromRows(rows, "2026-10-01", "2026-10-31")).toEqual({ a: 4 });
    expect(mepTotalsFromRows(rows, "2026-11-01", "2026-11-30")).toEqual({});
  });

  it("sans bornes (vue « Tout »), additionne toutes les saisies", () => {
    const rows = [
      { product_id: "a", quantity: 2, week_start: "2026-09-07" },
      { product_id: "a", quantity: 1, week_start: "2026-11-09" },
    ];
    expect(mepTotalsFromRows(rows, null, null)).toEqual({ a: 3 });
  });
});

describe("calendrier de saisie mise en place", () => {
  it("ouvre chaque dimanche et ferme les autres jours", () => {
    expect(inventoryDayOfWeek("2026-11-09").getDate()).toBe(15);
    expect(canEditMiseEnPlace("day", "2026-11-15", "2026-11-15", "2026-11-09")).toBe(true);
    expect(canEditMiseEnPlace("day", "2026-11-09", "2026-11-09", "2026-11-09")).toBe(false);
    expect(canEditMiseEnPlace("day", "2026-11-14", "2026-11-14", "2026-11-09")).toBe(false);
  });
  it("ouvre le dernier jour du mois au lieu du dimanche de la même semaine", () => {
    expect(canEditMiseEnPlace("day", "2026-11-30", "2026-11-30", "2026-11-30")).toBe(true);
    expect(canEditMiseEnPlace("day", "2026-12-06", "2026-12-06", "2026-11-30")).toBe(false);
    expect(canEditMiseEnPlace("day", "2026-10-31", "2026-10-31", "2026-10-26")).toBe(true);
    expect(canEditMiseEnPlace("day", "2026-11-01", "2026-11-01", "2026-10-26")).toBe(false);
    expect(inventoryDayOfWeek("2027-02-22").getDate()).toBe(28);
  });
  it("garde les jours passés et les totaux de période en lecture seule", () => {
    expect(canEditMiseEnPlace("day", "2026-11-15", "2026-11-16", "2026-11-09")).toBe(false);
    expect(canEditMiseEnPlace("month", "2026-11-15", "2026-11-15", "2026-11-09")).toBe(false);
  });
});
