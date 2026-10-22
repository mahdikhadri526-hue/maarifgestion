// Helpers partagés entre le tableau « Stock restant » (StockTable) et la page
// Agrégats hebdomadaires partagés (StockTable) : mêmes constantes,
// même calcul d'agrégats, pour que les deux vues restent cohérentes.
import { roundStockQuantity } from "@/lib/stockData";

export const MACARON_ARTICLES = [
  "Mac.Chocolat P", "Mac.Pistache P", "Mac.Caramel P", "Mac.Cfé P", "Mac.Mng P", "Mac.Cit P",
  "Mac.Chocolat N", "Mac.Pistache N", "Mac.Caramel N", "Mac.Cfé N", "Mac.Mng N", "Mac.Cit N",
];
export const MACARON_AGG_ID = "__macaron_agg__";
export const SIROP_AGG_ID = "__sirop_agg__";
export const CHANTILLY_AGG_ID = "__chantilly_agg__";
export const AMANDES_AGG_ID = "__amandes_agg__";
export const NESPRESSO_AGG_ID_CONST = "__nespresso_agg__";
export const NUTELLA_NESTLE_AGG_ID = "__nutella_nestle_agg__";
export const THE_AROMATISE_AGG_ID = "__the_aromatise_agg__";
export const SIROP_CHOCOLAT_ALI_ID = "ali-9";
export const NUTELLA_ALI_ID = "ali-21";
export const NESTLE_CARAMEL_ALI_ID = "ali-15";
export const SIROP_CARAMEL_WEEKLY_ARTICLE = "Sirop.Crml";
export const CHANTILLY_WEEKLY_ARTICLE = "Crème fraîche (mousse fouettée)";
export const AMANDES_WEEKLY_ARTICLE = "Amd.Crml";
export const EXTRA_AGG_IDS = [SIROP_AGG_ID, CHANTILLY_AGG_ID, AMANDES_AGG_ID, NUTELLA_NESTLE_AGG_ID, THE_AROMATISE_AGG_ID];
export const isReadOnlyAggId = (id: string) =>
  id === NESPRESSO_AGG_ID_CONST || id === MACARON_AGG_ID || EXTRA_AGG_IDS.includes(id);
export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

export type WeeklyTrackingOrderRecord = {
  article: string | null;
  sorties: number | string | null;
  entrees: number | string | null;
  stock_initial: number | string | null;
  day_of_week: string;
  week_start: string;
  row_index?: number;
};

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function trackingDate(weekStart: string, dayIdx: number) {
  const date = parseISODate(weekStart);
  // Les anciennes fiches ont parfois un week_start au dimanche : on les corrige
  // ici pour que Commande lise toujours les mêmes dates que le suivi hebdo.
  date.setDate(date.getDate() + dayIdx + (date.getDay() === 0 ? 1 : 0));
  return formatISODate(date);
}

export function numericValue(value: unknown) {
  if (value === "" || value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Normalisation commune : SI/sorties sur la ligne principale, toutes les
// entrées de lots cumulées, sortie affectée au jour qui précède le comptage.
export function buildWeeklyDailyStocks(records: WeeklyTrackingOrderRecord[], articleList: readonly string[]) {
  type Bucket = { si: number | null; entrees: number; explicitSorties: number | null };
  const byArticle = new Map<string, Map<string, Bucket>>();
  for (const r of records) {
    if (!r.article || !articleList.includes(r.article) || !r.week_start) continue;
    const dayIdx = DAYS.indexOf(r.day_of_week as (typeof DAYS)[number]);
    if (dayIdx < 0) continue;
    const date = trackingDate(r.week_start, dayIdx);
    let days = byArticle.get(r.article);
    if (!days) { days = new Map(); byArticle.set(r.article, days); }
    let bucket = days.get(date);
    if (!bucket) { bucket = { si: null, entrees: 0, explicitSorties: null }; days.set(date, bucket); }
    if ((r.row_index ?? 0) === 0) {
      if (r.stock_initial !== "" && r.stock_initial != null) bucket.si = numericValue(r.stock_initial);
      if (r.sorties !== "" && r.sorties != null) bucket.explicitSorties = numericValue(r.sorties);
    }
    bucket.entrees += numericValue(r.entrees);
  }
  const out: Array<{ article: string; date: string; stockInitial: number; entrees: number; sorties: number; stockRestant: number }> = [];
  for (const [article, days] of byArticle) {
    const dates = Array.from(days.keys()).sort();
    const first = dates[0];
    const last = dates[dates.length - 1];
    if (!first || !last) continue;
    let stock = 0;
    for (const d = parseISODate(first); formatISODate(d) <= last; d.setDate(d.getDate() + 1)) {
      const date = formatISODate(d);
      const bucket = days.get(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const nextSI = days.get(formatISODate(next))?.si;
      const entrees = bucket?.entrees ?? 0;
      // Même SI effectif que Suivi hebdo pour un nouvel article réceptionné.
      const si = bucket?.si ?? (entrees > 0 ? 0 : null);
      const stockInitial = si ?? stock;
      const sorties = si != null && nextSI != null
        ? si + entrees - nextSI
        : (bucket?.explicitSorties ?? 0);
      stock = stockInitial + entrees - sorties;
      out.push({ article, date, stockInitial, entrees, sorties, stockRestant: stock });
    }
  }
  return out;
}

// La ligne du lendemain reste un contexte de calcul, jamais un mouvement
// de la période. Chaque article a son propre état (pas de dates partagées).
export function buildWeeklyAggregateTotals(
  records: WeeklyTrackingOrderRecord[],
  articleList: readonly string[],
  isInSelectedPeriod: (iso: string) => boolean,
  matchAll: boolean,
  closeOnNextDayCount = false,
  periodStart?: string,
) {
  void closeOnNextDayCount; // conservé pour les anciens appelants
  const daily = buildWeeklyDailyStocks(records, articleList);
  let aggStockInitial = 0;
  let aggEntrees = 0;
  let aggSorties = 0;
  let aggRestant = 0;
  for (const article of articleList) {
    const days = daily.filter(r => r.article === article);
    const selected = days.filter(r => isInSelectedPeriod(r.date));
    const first = selected[0];
    const last = selected[selected.length - 1];
    if (!first || !last) {
      // Période après la dernière saisie : reporter le stock, sans sorties.
      const latest = days[days.length - 1];
      if (latest) {
        if (periodStart && latest.date < periodStart) {
          aggStockInitial += latest.stockRestant;
          aggRestant += latest.stockRestant;
        }
      }
      continue;
    }
    aggStockInitial += first.stockInitial;
    aggEntrees += selected.reduce((s, r) => s + r.entrees, 0);
    aggSorties += selected.reduce((s, r) => s + r.sorties, 0);
    aggRestant += matchAll ? (days[days.length - 1]?.stockRestant ?? 0) : last.stockRestant;
  }

  return {
    stockInitial: roundStockQuantity(aggStockInitial),
    entrees: roundStockQuantity(aggEntrees),
    sorties: roundStockQuantity(aggSorties),
    stockRestant: roundStockQuantity(aggRestant),
  };
}
