const PAGE_SIZE = 1000;

/**
 * Fetch all rows from a Supabase query, paging past the default 1000-row cap.
 * Pass a factory that returns a fresh query builder each call (so .range can be applied).
 */
export async function fetchAllRows<T = any>(
  buildQuery: () => any,
): Promise<T[]> {
  const all: T[] = [];
  // Première page : la plupart des tables tiennent dedans.
  const first = await buildQuery().range(0, PAGE_SIZE - 1);
  if (first.error) throw first.error;
  const firstBatch = (first.data || []) as T[];
  all.push(...firstBatch);
  if (firstBatch.length < PAGE_SIZE) return all;

  // Pages suivantes récupérées par lots parallèles (au lieu d'une par une).
  const PARALLEL = 4;
  let from = PAGE_SIZE;
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