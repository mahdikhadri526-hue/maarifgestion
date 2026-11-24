export type FollowupArticle = { name: string; active: boolean };
export type WeeklyFollowup = { id: string; pdv_id: string; name: string; active: boolean; articles: FollowupArticle[] };

export function followupFicheKey(id: string): string {
  return `Suivi personnalisé:${id}`;
}

export function parseFollowupArticles(value: unknown): FollowupArticle[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== "object" || typeof item.name !== "string") return [];
    return [{ name: item.name, active: item.active !== false }];
  });
}

export function visibleFollowups(rows: readonly WeeklyFollowup[], pdvId: string | null): WeeklyFollowup[] {
  return rows.filter(row => row.pdv_id === pdvId && row.active);
}

export function validateFollowupName(name: string, existing: readonly string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120) return "Le nom doit contenir entre 1 et 120 caractères.";
  if (existing.some(item => item.trim().toLocaleLowerCase("fr") === trimmed.toLocaleLowerCase("fr"))) return "Ce nom existe déjà. Vous pouvez le restaurer s’il a été retiré.";
  return null;
}