export const DEFAULT_TRANSFER_LOCATIONS = [
  "Dar Bouazza", "Corniche", "Almaz", "Sidi Maarouf", "Bouskoura",
  "Hassan 2", "Anfa place", "Tachfine", "Rabat", "Morocco Mall",
  "Mohamedia", "Californie", "Franchise", "Événement", "Ville verte",
];

export function mergeTransferLocations(custom: string[]): string[] {
  const names = new Map<string, string>();
  for (const name of [...DEFAULT_TRANSFER_LOCATIONS, ...custom]) {
    const clean = name.trim();
    if (clean && !names.has(clean.toLocaleLowerCase("fr"))) {
      names.set(clean.toLocaleLowerCase("fr"), clean);
    }
  }
  return [...names.values()];
}

export function validateTransferLocation(name: string, existing: string[]): string | null {
  const clean = name.trim();
  if (!clean) return "Veuillez saisir le nom du site";
  if (clean.length > 100) return "Le nom du site est limité à 100 caractères";
  if (existing.some(value => value.trim().toLocaleLowerCase("fr") === clean.toLocaleLowerCase("fr"))) {
    return "Ce site existe déjà";
  }
  return null;
}