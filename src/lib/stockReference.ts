/** Display-only conversion using the Stock restant reference factor. */
export function stockReferenceQuantity(quantity: number, conversion: string): number | null {
  const factor = parseFloat(conversion);
  if (!Number.isFinite(factor) || factor === 0) return null;
  const value = quantity * factor;
  return Number.isInteger(value) ? value : Math.round(value * 100) / 100;
}