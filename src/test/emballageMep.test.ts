import { describe, expect, it } from "vitest";
import { emballageMepTotal, mepPiecesFromGrams } from "@/lib/emballageMep";

describe("mepPiecesFromGrams (Emballage : MEP grammes → pièces)", () => {
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
