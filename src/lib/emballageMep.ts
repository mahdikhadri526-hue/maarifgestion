/** Emballage : convertit un poids de mise en place (g) en pièces via le taux « pièces / 1000 g ». */
export function mepPiecesFromGrams(grams: string, piecesPerKg: string): number | null {
  const g = parseFloat(grams);
  const perKg = parseFloat(piecesPerKg);
  if (!Number.isFinite(g) || !Number.isFinite(perKg) || perKg === 0) return null;
  const pieces = (g * perKg) / 1000;
  return Number.isInteger(pieces) ? pieces : Math.round(pieces * 100) / 100;
}

/** Additionne les pièces calculées à la balance et les pièces comptées directement. */
export function emballageMepTotal(grams: string, piecesPerKg: string, directPieces: string): number {
  const calculated = mepPiecesFromGrams(grams, piecesPerKg) ?? 0;
  const direct = Number(directPieces);
  return Math.round((calculated + (Number.isFinite(direct) ? direct : 0)) * 100) / 100;
}

/** Packaging edits remain visible on any unlocked day; other daily rows retain counting-day visibility. */
export function dailyMepValues(
  saved: Record<string, number>,
  countingDay: boolean,
  packagingIds: string[],
  drafts: Record<string, number>,
): Record<string, number> {
  const visible = countingDay ? { ...saved } : Object.fromEntries(
    packagingIds.filter(id => saved[id] !== undefined).map(id => [id, saved[id]]),
  );
  return { ...visible, ...drafts };
}
