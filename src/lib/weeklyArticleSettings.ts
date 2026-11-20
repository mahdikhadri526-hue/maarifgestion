import { WEEKLY_GLACE_ARTICLES, WEEKLY_FRUIT_ARTICLES, WEEKLY_NETTOYANT_ARTICLES, WEEKLY_TARTE_DISPLAY_ARTICLES } from "./weeklyArticles";

export const WEEKLY_CATEGORIES = ["glace", "fruits", "nettoyant", "tarte"] as const;
export type WeeklyCategory = typeof WEEKLY_CATEGORIES[number];
export const WEEKLY_CATEGORY_LABELS: Record<WeeklyCategory, string> = { glace: "Glaces", fruits: "Fruits", nettoyant: "Nettoyants", tarte: "Tartes" };
export const WEEKLY_DEFAULTS: Record<WeeklyCategory, string[]> = {
  glace: WEEKLY_GLACE_ARTICLES, fruits: WEEKLY_FRUIT_ARTICLES,
  nettoyant: WEEKLY_NETTOYANT_ARTICLES, tarte: WEEKLY_TARTE_DISPLAY_ARTICLES,
};
export type WeeklyArticleSetting = { pdv_id: string; category: WeeklyCategory; article: string; active: boolean };

// Presentation only: never filter the historical rows used for stock calculations.
export function resolveWeeklyArticles(pdvId: string | null, category: WeeklyCategory, settings: readonly WeeklyArticleSetting[], includeRemoved = false): string[] {
  const scoped = settings.filter(row => row.pdv_id === pdvId && row.category === category);
  const articles = [...new Set([...WEEKLY_DEFAULTS[category], ...scoped.map(row => row.article)])];
  return includeRemoved ? articles : articles.filter(article => scoped.find(row => row.article === article)?.active !== false);
}

export function validateWeeklyArticle(article: string, category: WeeklyCategory, pdvId: string, settings: readonly WeeklyArticleSetting[]): string | null {
  const name = article.trim();
  if (!name || name.length > 120) return "Le nom doit contenir entre 1 et 120 caractères.";
  const key = name.toLocaleLowerCase("fr");
  for (const c of WEEKLY_CATEGORIES) {
    if (resolveWeeklyArticles(pdvId, c, settings, true).some(a => a.toLocaleLowerCase("fr") === key)) {
      return c === category ? "Cet article existe déjà. Vous pouvez le restaurer s’il a été supprimé." : "Cet article existe déjà dans un autre suivi.";
    }
  }
  return null;
}