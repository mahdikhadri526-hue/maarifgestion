import { describe, expect, it } from "vitest";
import { dailyMepValues, emballageMepTotal, mepPiecesFromGrams } from "@/lib/emballageMep";

describe("mepPiecesFromGrams (Emballage : MEP grammes → pièces)", () => {
  it("affiche immédiatement 50 pièces calculées + 20 directes = 70 le jour du comptage", () => {
    const total = emballageMepTotal("500", "100", "20");
    expect(dailyMepValues({ emballage: 12 }, true, ["emballage"], { emballage: total })).toEqual({ emballage: 70 });
  });
  it("conserve la somme enregistrée après rechargement sans modifier les autres catégories ni semaines", () => {
    expect(dailyMepValues({ emballage: 70, alimentaire: 8 }, false, ["emballage"], {})).toEqual({});
    expect(dailyMepValues({ emballage: 12, alimentaire: 8 }, true, ["emballage"], {})).toEqual({ emballage: 12, alimentaire: 8 });
    expect(dailyMepValues({}, false, ["emballage"], {})).toEqual({});
  });
  it("stock mise en place = MEP pièces + MEP directement en pièces", () => {
    expect(emballageMepTotal("500", "100", "20")).toBe(70);
    expect(emballageMepTotal("", "", "20")).toBe(20);
    expect(emballageMepTotal("500", "100", "")).toBe(50);
    expect(emballageMepTotal("", "", "")).toBe(0);
  });
  it("convertit les grammes en pièces via le taux pièces / 1000 g", () => {
    // 500 g pesés, 100 pièces par 1000 g → 50 pièces
    expect(mepPiecesFromGrams("500", "100")).toBe(50);
  });

  it("arrondit à deux décimales les résultats non entiers", () => {
    // 250 g pesés, 33 pièces par 1000 g → 8,25 pièces
    expect(mepPiecesFromGrams("250", "33")).toBe(8.25);
  });

  it("retourne null si une valeur manque ou si le taux est zéro", () => {
    expect(mepPiecesFromGrams("", "100")).toBeNull();
    expect(mepPiecesFromGrams("500", "")).toBeNull();
    expect(mepPiecesFromGrams("500", "0")).toBeNull();
  });
});
