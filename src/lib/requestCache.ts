import { getCurrentPdvId } from "@/lib/pdvStore";

/**
 * Cache mémoire court + déduplication des requêtes Supabase.
 *
 * Objectif : éviter que plusieurs composants rechargent les mêmes grosses
 * tables (mouvements, suivi hebdo, stocks initiaux) à quelques millisecondes
 * d'intervalle. Les données restent fraîches car :
 *  - la durée de vie est courte (quelques secondes) ;
 *  - toute modification temps réel invalide immédiatement les entrées liées.
 */
type Entry = { promise: Promise<any>; ts: number; tables: string[] };

const store = new Map<string, Entry>();
const DEFAULT_TTL = 15000;

export function cached<T>(
  key: string,
  tables: string[],
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL,
): Promise<T> {
  const scopedKey = `${getCurrentPdvId() ?? "no-pdv"}:${key}`;
  const now = Date.now();
  const hit = store.get(scopedKey);
  if (hit && now - hit.ts < ttlMs) return hit.promise as Promise<T>;
  const promise = fn().catch((err) => {
    store.delete(scopedKey);
    throw err;
  });
  store.set(scopedKey, { promise, ts: now, tables });
  return promise;
}

/** Alias historique : simple déduplication (pas de conservation dans le temps). */
export function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return cached(key, [], fn, 0);
}

export function invalidateTables(tables: string[]) {
  for (const [key, entry] of store) {
    if (entry.tables.some((t) => tables.includes(t))) store.delete(key);
  }
}

export function invalidateAll() {
  store.clear();
}
