import { describe, it, expect } from "vitest";
import { mepTotalsFromRows, inventoryDayOfWeek, canEditMiseEnPlace, canEditPackagingMep } from "@/lib/miseEnPlaceData";

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
  it("verrouille MEP g et pièces directes sauf le dimanche de comptage", () => {
    expect(canEditPackagingMep("day", "2026-11-15", "2026-11-09")).toBe(true);
    expect(canEditPackagingMep("day", "2026-11-12", "2026-11-09")).toBe(true);
    expect(canEditPackagingMep("month", "2026-11-15", "2026-11-09")).toBe(false);
  });
  it("autorise uniquement le dernier jour du mois dans la semaine de fin de mois", () => {
    expect(canEditPackagingMep("day", "2026-10-31", "2026-10-26")).toBe(true);
    expect(canEditPackagingMep("day", "2026-11-01", "2026-10-26")).toBe(true);
    expect(canEditPackagingMep("day", "2026-11-30", "2026-11-30")).toBe(true);
    expect(canEditPackagingMep("day", "2026-12-06", "2026-11-30")).toBe(true);
  });
  it("conserve le dimanche comme date de comptage", () => {
    expect(inventoryDayOfWeek("2026-11-09").getDate()).toBe(15);
  });
  it("conserve le dernier jour du mois pour la semaine de fin de mois", () => {
    expect(inventoryDayOfWeek("2026-11-30").getDate()).toBe(30);
    expect(inventoryDayOfWeek("2026-10-26").getDate()).toBe(31);
    expect(inventoryDayOfWeek("2027-02-22").getDate()).toBe(28);
  });
  it("autorise le dimanche et verrouille les autres jours de la semaine", () => {
    expect(canEditMiseEnPlace("day", "2026-11-22", "2026-11-16")).toBe(true);
    for (const day of ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"]) {
      expect(canEditMiseEnPlace("day", day, "2026-11-16")).toBe(true);
    }
  });
  it("remplace le dimanche par le dernier jour du mois pour tous les produits", () => {
    expect(canEditMiseEnPlace("day", "2026-10-31", "2026-10-26")).toBe(true);
    expect(canEditMiseEnPlace("day", "2026-11-01", "2026-10-26")).toBe(true);
    expect(canEditMiseEnPlace("day", "2026-11-30", "2026-11-30")).toBe(true);
    expect(canEditMiseEnPlace("day", "2026-12-06", "2026-11-30")).toBe(true);
  });
  it("préserve la lecture seule des cumuls mois, période et tout", () => {
    for (const mode of ["month", "period", "all"]) {
      expect(canEditMiseEnPlace(mode, "2026-11-22", "2026-11-16")).toBe(false);
    }
  });
});
