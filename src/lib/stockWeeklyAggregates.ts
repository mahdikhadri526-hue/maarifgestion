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

// Reconstitue le stock d'un article du suivi hebdo (entrées/sorties cumulées,
// SI du lundi reporté à la semaine suivante). Identique à la logique du
// tableau Stock restant pour les agrégats Macaron/Sirop/Chantilly/Amandes.
export function buildWeeklyAggregateTotals(
  records: WeeklyTrackingOrderRecord[],
  articleList: readonly string[],
  isInSelectedPeriod: (iso: string) => boolean,
  matchAll: boolean,
) {
  const byArticle = new Map<string, Map<string, { si: number | null; entrees: number; explicitSorties: number }>>();
  for (const r of records) {
    if (!r.article || !articleList.includes(r.article)) continue;
    const dayIdx = DAYS.indexOf((r.day_of_week || "") as (typeof DAYS)[number]);
    if (dayIdx < 0) continue;
    const date = trackingDate(r.week_start, dayIdx);
    let days = byArticle.get(r.article);
    if (!days) { days = new Map(); byArticle.set(r.article, days); }
    let bucket = days.get(date);
    if (!bucket) { bucket = { si: null, entrees: 0, explicitSorties: 0 }; days.set(date, bucket); }
    if (r.stock_initial != null) bucket.si = numericValue(r.stock_initial);
    bucket.entrees += numericValue(r.entrees);
    if (r.sorties != null) bucket.explicitSorties += numericValue(r.sorties);
  }

  const closedDates = new Set<string>();
  let aggStockInitial = 0;
  let aggEntrees = 0;
  let aggSorties = 0;
  let aggRestant = 0;
  for (const [, days] of byArticle) {
    const entries = Array.from(days.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    let prevSI: number | null = null;
    let spanStart: string | null = null;
    let pendingEntries = 0;
    let totalSortiesArt = 0;
    let latestStock = 0;
    let stockInitialPeriod: number | null = null;
    let lastSIBeforePeriod = 0;
    let entreesPeriodArt = 0;

    for (const [date, bucket] of entries) {
      if (bucket.si != null) {
        if (prevSI != null && spanStart) {
          const sortie = Math.max(0, prevSI + pendingEntries - bucket.si);
          if (isInSelectedPeriod(spanStart)) totalSortiesArt += sortie;
          for (let d = parseISODate(spanStart); formatISODate(d) < date; d.setDate(d.getDate() + 1)) {
            closedDates.add(formatISODate(d));
          }
        }
        prevSI = bucket.si;
        spanStart = date;
        pendingEntries = bucket.entrees;
        latestStock = bucket.si;
        if (isInSelectedPeriod(date)) {
          if (stockInitialPeriod === null) stockInitialPeriod = bucket.si;
        } else {
          lastSIBeforePeriod = bucket.si;
        }
      } else {
        pendingEntries += bucket.entrees;
      }
      if (isInSelectedPeriod(date)) entreesPeriodArt += bucket.entrees;
    }

    entries.forEach(([date, bucket]) => {
      if (bucket.explicitSorties > 0 && !closedDates.has(date) && isInSelectedPeriod(date)) {
        totalSortiesArt += bucket.explicitSorties;
      }
    });

    if (prevSI != null) {
      const openExplicit = entries.reduce((sum, [date, bucket]) => (
        !closedDates.has(date) && bucket.explicitSorties > 0 ? sum + bucket.explicitSorties : sum
      ), 0);
      latestStock = Math.max(0, prevSI + pendingEntries - openExplicit);
    }

    if (stockInitialPeriod === null) stockInitialPeriod = lastSIBeforePeriod;
    aggStockInitial += stockInitialPeriod;
    aggEntrees += entreesPeriodArt;
    aggSorties += totalSortiesArt;
    aggRestant += matchAll ? latestStock : (stockInitialPeriod + entreesPeriodArt - totalSortiesArt);
  }

  return {
    stockInitial: roundStockQuantity(aggStockInitial),
    entrees: roundStockQuantity(aggEntrees),
    sorties: roundStockQuantity(aggSorties),
    stockRestant: roundStockQuantity(aggRestant),
  };
}
