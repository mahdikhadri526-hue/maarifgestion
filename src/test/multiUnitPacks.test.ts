import { describe, expect, it } from "vitest";
import { totalPieces, type MultiUnitValues } from "@/components/MultiUnitInput";
import type { ProductUnitConfig } from "@/lib/stockData";

// Regle metier : un produit peut avoir plusieurs conditionnements en meme temps
// (ex: Oreo en paquet de 24 ET en paquet de 16), chacun converti en pieces.
const OREO_CONFIG: ProductUnitConfig = {
  cartonEnabled: false,
  paquetEnabled: true,
  piecesPerCarton: 1,
  piecesPerPaquet: 24,
  extraPacks: [{ id: "pack-16", label: "Paquet de 16", piecesPerUnit: 16 }],
};

describe("conditionnements supplementaires", () => {
  it("1 paquet de 24 + 2 paquets de 16 = 56 pieces", () => {
    const values: MultiUnitValues = { cartons: "", paquets: "1", pieces: "", packs: { "pack-16": "2" } };
    expect(totalPieces(values, OREO_CONFIG)).toBe(56);
  });

  it("sans saisie du conditionnement supplementaire, le calcul reste inchange", () => {
    const values: MultiUnitValues = { cartons: "", paquets: "3", pieces: "5" };
    expect(totalPieces(values, OREO_CONFIG)).toBe(3 * 24 + 5);
  });

  it("les pieces seules continuent de compter", () => {
    const values: MultiUnitValues = { cartons: "", paquets: "", pieces: "7", packs: { "pack-16": "1" } };
    expect(totalPieces(values, OREO_CONFIG)).toBe(23);
  });
});
