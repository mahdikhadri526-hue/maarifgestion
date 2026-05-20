const PAGE_SIZE = 1000;

/**
 * Fetch all rows from a Supabase query, paging past the default 1000-row cap.
 * Pass a factory that returns a fresh query builder each call (so .range can be applied).
 */
export async function fetchAllRows<T = any>(
  buildQuery: () => any,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Cap iterations defensively (1M rows max)
  for (let i = 0; i < 1000; i++) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw error;
    const batch = (data || []) as T[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}