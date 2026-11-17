/** Emballage : convertit un poids de mise en place (g) en pièces via le taux « pièces / 1000 g ». */
export function mepPiecesFromGrams(grams: string, piecesPerKg: string): number | null {
  const g = parseFloat(grams);
  const perKg = parseFloat(piecesPerKg);
  if (!Number.isFinite(g) || !Number.isFinite(perKg) || perKg === 0) return null;
  const pieces = (g * perKg) / 1000;
  return Number.isInteger(pieces) ? pieces : Math.round(pieces * 100) / 100;
}
