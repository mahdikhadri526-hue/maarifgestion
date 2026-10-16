/**
 * Date de fabrication déduite d'un n° de lot (glaces & tartes), au format YYYY-MM-DD.
 * Formats reconnus : JJ.MM.AAAA, JJ.MM (année de référence), JJMM-XXX/AA, AAAA-MM-JJ.
 * Une année manifestement erronée (ex. 2016 au lieu de 2026) est remplacée par l'année de référence.
 */
export function lotDateKey(lot: string, refDate?: string, isGlace = false): string | null {
  const v = (lot ?? "").toString().trim();
  if (!v) return null;
  const refYear = Number((refDate || new Date().toISOString()).slice(0, 4));
  const build = (d: number, m: number, y: number | null) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    let year = y ?? refYear;
    if (y != null && Math.abs(y - refYear) > 1) year = refYear;
    let key = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (y == null && refDate && key > refDate.slice(0, 10)) {
      key = `${year - 1}${key.slice(4)}`;
    }
    return key;
  };
  if (isGlace) {
    const compact = v.match(/^(\d{2})(\d{2})[a-z]+\/(\d{2})$/i);
    if (compact) return build(+compact[1], +compact[2], 2000 + +compact[3]);
  }
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return build(+m[3], +m[2], +m[1]);
  m = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) return build(+m[1], +m[2], m[3].length === 2 ? 2000 + +m[3] : +m[3]);
  m = v.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (m) return build(+m[1], +m[2], null);
  m = v.match(/^(\d{2})(\d{2})\s*-.*?\/(\d{2})$/);
  if (m) return build(+m[1], +m[2], 2000 + +m[3]);
  m = v.match(/^(\d{2})(\d{2})\s*-/);
  if (m) return build(+m[1], +m[2], null);
  return null;
}

/**
 * Trie (en place) des lots pour respecter le FIFO réel : le lot le plus ancien
 * (d'après son n°) sort en premier, même s'il est arrivé après un lot plus récent.
 * Stock initial sans lot = le plus ancien. Lot illisible = rang de son arrivée.
 */
export function sortFifoByLot<T extends { lot: string; entryDate?: string }>(batches: T[], refDate?: string, isGlace = false): T[] {
  let prev = "";
  const keyed = batches.map((b, i) => {
    let k: string;
    if (!b.lot || !b.lot.trim()) k = "";
    else k = lotDateKey(b.lot, b.entryDate || refDate, isGlace) ?? (b.entryDate || prev);
    prev = k;
    return { b, k, i };
  });
  keyed.sort((a, c) => (a.k < c.k ? -1 : a.k > c.k ? 1 : a.i - c.i));
  keyed.forEach((x, i) => (batches[i] = x.b));
  return batches;
}
