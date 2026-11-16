/** Display-only conversion using the Stock restant reference factor. */
export function stockReferenceQuantity(quantity: number, conversion: string): number | null {
  const factor = parseFloat(conversion);
  if (!Number.isFinite(factor) || factor === 0) return null;
  const value = quantity * factor;
  return Number.isInteger(value) ? value : Math.round(value * 100) / 100;
}

export type StockReference = { conversion: string; unitRef: string };
export const normalizeReferenceUnit = (value: string) => {
  const unit = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  if (["KILO", "KG"].includes(unit)) return "kg";
  if (["LITRE", "L"].includes(unit)) return "L";
  if (["PIECE", "PIECES"].includes(unit)) return "pièce";
  return unit;
};

/** Add converted source columns, using the aggregate factor only for unconfigured sources. */
export function sumStockReferenceSources(
  ids: readonly string[], quantities: Record<string, number | undefined>,
  references: Record<string, StockReference>, fallback?: StockReference,
) {
  let total = 0;
  let unit: string | undefined;
  for (const id of new Set(ids)) {
    const quantity = quantities[id];
    const own = references[id];
    const ref = own?.unitRef.trim() && own.conversion.trim() ? own : fallback?.unitRef.trim() && fallback.conversion.trim() ? fallback : own;
    if (quantity === undefined || !ref?.unitRef.trim()) return null;
    const converted = stockReferenceQuantity(quantity, ref.conversion);
    if (converted === null) return null;
    const currentUnit = normalizeReferenceUnit(ref.unitRef);
    if (unit !== undefined && unit !== currentUnit) return null;
    unit = currentUnit;
    total += converted;
  }
  return unit === undefined ? null : { quantity: Number(total.toFixed(4)), unit };
}