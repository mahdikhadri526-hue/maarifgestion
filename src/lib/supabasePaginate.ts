const PAGE_SIZE = 1000;

export interface FetchAllOptions {
  /**
   * Nombre de pages demandées en parallèle dès le premier appel.
   * Utile pour les tables volumineuses connues (ex. suivi hebdo) : on évite
   * l'aller-retour « première page puis les suivantes ». Par défaut 1.
   */
  eagerPages?: number;
}

/**
 * Fetch all rows from a Supabase query, paging past the default 1000-row cap.
 * Pass a factory that returns a fresh query builder each call (so .range can be applied).
 */
export async function fetchAllRows<T = any>(
  buildQuery: () => any,
  opts: FetchAllOptions = {},
): Promise<T[]> {
  const all: T[] = [];
  const eager = Math.max(1, Math.min(16, opts.eagerPages ?? 1));

  // Premier lot : `eager` pages en parallèle (1 seule pour les petites tables).
  const firstResults = await Promise.all(
    Array.from({ length: eager }, (_, i) => buildQuery().range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1)),
  );
  let complete = false;
  for (const res of firstResults) {
    if (res.error) throw res.error;
    const batch = (res.data || []) as T[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) complete = true;
  }
  if (complete) return all;

  // Pages suivantes récupérées par lots parallèles (au lieu d'une par une).
  const PARALLEL = 6;
  let from = eager * PAGE_SIZE;
  for (let round = 0; round < 250; round++) {
    const ranges = Array.from({ length: PARALLEL }, (_, i) => from + i * PAGE_SIZE);
    const results = await Promise.all(
      ranges.map((start) => buildQuery().range(start, start + PAGE_SIZE - 1)),
    );
    let done = false;
    for (const res of results) {
      if (res.error) throw res.error;
      const batch = (res.data || []) as T[];
      all.push(...batch);
      if (batch.length < PAGE_SIZE) done = true;
    }
    if (done) break;
    from += PARALLEL * PAGE_SIZE;
  }
  return all;
}
