/**
 * Déduplication des requêtes identiques lancées en parallèle.
 * Plusieurs composants demandent souvent les mêmes données au même instant
 * (mouvements, stocks initiaux, unités...). On partage alors une seule requête
 * réseau au lieu d'en lancer plusieurs. Aucune mise en cache dans le temps :
 * dès que la requête est terminée, la prochaine demande refait un appel frais.
 */
const inFlight = new Map<string, Promise<any>>();

export function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, p);
  return p;
}
