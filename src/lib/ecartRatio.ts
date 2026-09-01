import { supabase } from "@/lib/db";
import { requireCurrentPdvId } from "@/lib/pdvStore";
import { fetchAllRows } from "@/lib/supabasePaginate";

/**
 * Module « Calcul des écarts » — reproduction fidèle du fichier RATIO MAARIF.
 * Toutes les valeurs sont en grammes ; l'équipe ne saisit que des quantités.
 */

export type Section =
  | "VENTE_EMP"
  | "VENTE_SP"
  | "ENTREE_EMP"
  | "ENTREE_SP"
  | "SF_EMP"
  | "SF_FRIGO_EMP"
  | "SF_TRANSIT_EMP"
  | "SF_CHAMBRE_EMP"
  | "SF_SP"
  | "SI_EMP"
  | "SI_CHAMBRE_EMP"
  | "SI_SP";

export interface Item {
  name: string;
  gram: number;
}

/** Parfums + grammage d'un stuff (feuille ENTREE EMPORTER). */
export const PARFUMS: Item[] = [
  { name: "Nougat", gram: 3725 },
  { name: "Praliné", gram: 3672 },
  { name: "Vanille", gram: 3550 },
  { name: "Chocolat", gram: 3696 },
  { name: "Caramel", gram: 3650 },
  { name: "Pistache", gram: 3620 },
  { name: "Parfait", gram: 2020 },
  { name: "Moka", gram: 3670 },
  { name: "Fraise", gram: 4450 },
  { name: "Framboise", gram: 4510 },
  { name: "Orange", gram: 4350 },
  { name: "Pêche", gram: 4263 },
  { name: "Citron", gram: 4279 },
  { name: "Mangue", gram: 4268 },
  { name: "BANANE CARAMILISE", gram: 3745 },
  { name: "ORANGE CANELLE", gram: 4259 },
  { name: "CITRON MENTHE", gram: 4280 },
  { name: "REGLISSE", gram: 3616 },
];

/** Articles vendus — Emporter (feuille VENTES, lignes 17→45). */
export const VENTES_EMP: Item[] = [
  { name: "MILK SHAKE EMP", gram: 180 },
  { name: "SUPP 1B EMP", gram: 60 },
  { name: "CAFE LIEGEOIS EMP", gram: 180 },
  { name: "CHOCOLAT LIEGOIS EM", gram: 180 },
  { name: "ORANGE SHAKE EMP", gram: 180 },
  { name: "JUS PANACHE EMP", gram: 180 },
  { name: "CREPONE CITRON EMP", gram: 180 },
  { name: "MERINGUE GLACEE EMP", gram: 120 },
  { name: "CORNET 1B EMP", gram: 60 },
  { name: "CORNET 2B EMP", gram: 120 },
  { name: "TULIPE 2 b EMP", gram: 120 },
  { name: "TULIPE 3 b EMP", gram: 180 },
  { name: "PETIT POT", gram: 160 },
  { name: "FRESH TOPPING 2B", gram: 120 },
  { name: "FRESH TOPPING  3B", gram: 180 },
  { name: "POT 75", gram: 750 },
  { name: "0,5 L", gram: 500 },
  { name: "1 l", gram: 1000 },
  { name: "STUFF 5,5L", gram: 3846 },
  { name: "BAC 5L", gram: 3496 },
  { name: "BAC 2,5", gram: 1748 },
  { name: "CREPE GLACEE EMP", gram: 70 },
  { name: "GAUFFRE GLACEE EMP", gram: 70 },
  { name: "BROWNIE GLACEE EMP", gram: 70 },
  { name: "ANANAS MELBA EMP", gram: 175 },
  { name: "PECHE MELBA EMP", gram: 255 },
  { name: "FRAISE MELBA EMP", gram: 280 },
  { name: "MACEDOINE DE FRUITS EMP", gram: 120 },
  { name: "AFFOGATO EMP", gram: 170 },
];

/** Articles vendus — Surplace / Salle (feuille VENTES, lignes 51→84). */
export const VENTES_SP: Item[] = [
  { name: "0,5 L", gram: 500 },
  { name: "1 L", gram: 1000 },
  { name: "ANANAS MELBA", gram: 175 },
  { name: "PECHE MELBA", gram: 255 },
  { name: "FRAISE MELBA", gram: 240 },
  { name: "MACEDOINE DE FRUITS", gram: 120 },
  { name: "COUPE MAISON", gram: 250 },
  { name: "COUPE JARDINET", gram: 250 },
  { name: "COUPE REGINA", gram: 250 },
  { name: "COUPE MOKA FOURE", gram: 205 },
  { name: "COUPE MONTJOIE", gram: 250 },
  { name: "COUPE ALASKA", gram: 250 },
  { name: "COUPE GILDA", gram: 250 },
  { name: "GRAND VERRE PANACHE", gram: 320 },
  { name: "COUPE DE GLACE", gram: 205 },
  { name: "MERINGUE GLACEE", gram: 120 },
  { name: "Tulipe 3B SP", gram: 165 },
  { name: "Tulipe 2B SP", gram: 110 },
  { name: "BROWNIE GLACEE SP", gram: 70 },
  { name: "CREPE GLACEE", gram: 70 },
  { name: "GAUFFRE GLACEE", gram: 70 },
  { name: "CORNET 1 B SP", gram: 60 },
  { name: "CORNET 2B SP", gram: 120 },
  { name: "MINI COUPE", gram: 130 },
  { name: "JUS D'ORANGE", gram: 0 },
  { name: "JUS DE CITRON", gram: 0 },
  { name: "MILK SHAKE ", gram: 180 },
  { name: "ORANGE SHAKE", gram: 180 },
  { name: "JUS PANACHE", gram: 180 },
  { name: "CHOC LIEGOIS", gram: 180 },
  { name: "CAFE LIEGEOIS", gram: 180 },
  { name: "CREPONE CITRON", gram: 180 },
  { name: "SUPP 1B SP", gram: 60 },
  { name: "AFFOGATO", gram: 170 },
];

/** Sections saisies en grammes directement (pesée), pas en quantité. */
export const GRAM_SECTIONS: Section[] = ["ENTREE_SP", "SF_EMP", "SF_FRIGO_EMP", "SF_SP", "SI_EMP", "SI_SP"];

export const SECTION_ITEMS: Record<Section, Item[]> = {
  VENTE_EMP: VENTES_EMP,
  VENTE_SP: VENTES_SP,
  ENTREE_EMP: PARFUMS,
  ENTREE_SP: PARFUMS,
  SF_EMP: PARFUMS,
  SF_FRIGO_EMP: PARFUMS,
  SF_TRANSIT_EMP: PARFUMS,
  SF_CHAMBRE_EMP: PARFUMS,
  SF_SP: PARFUMS,
  SI_EMP: PARFUMS,
  SI_CHAMBRE_EMP: PARFUMS,
  SI_SP: PARFUMS,
};

export type DayData = Record<string, Record<string, number>>;

export interface DayTotals {
  entreeEmpG: number;
  entreeSpG: number;
  sfFrigoG: number;
  sfTransitG: number;
  sfChambreG: number;
  sfEmpG: number;
  sfSpG: number;
  ventesEmpG: number;
  ventesSpG: number;
}

export interface DayResult extends DayTotals {
  date: string;
  siEmpG: number;
  siSpG: number;
  consoEmpG: number;
  consoSpG: number;
  consoTotalG: number;
  ventesTotalG: number;
  ecartEmpG: number;
  ecartSpG: number;
  ecartTotalG: number;
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function sumSection(day: DayData, section: Section): number {
  const map = day?.[section] ?? {};
  const gramInput = GRAM_SECTIONS.includes(section);
  return SECTION_ITEMS[section].reduce((acc, it) => {
    const q = num(map[it.name]);
    return acc + (gramInput ? q : q * it.gram);
  }, 0);
}

export function computeTotals(day: DayData): DayTotals {
  const hasNewEmp = "SF_EMP" in (day ?? {});
  const sfEmpCombined = hasNewEmp ? sumSection(day, "SF_EMP") : 0;
  const sfFrigoG = sumSection(day, "SF_FRIGO_EMP");
  const sfTransitG = sumSection(day, "SF_TRANSIT_EMP");
  const sfChambreG = sumSection(day, "SF_CHAMBRE_EMP");
  const sfEmpPortionG = hasNewEmp ? sfEmpCombined : sfFrigoG + sfTransitG;
  return {
    entreeEmpG: sumSection(day, "ENTREE_EMP"),
    entreeSpG: sumSection(day, "ENTREE_SP"),
    sfFrigoG,
    sfTransitG,
    sfChambreG,
    sfEmpG: sfEmpPortionG + sfChambreG,
    sfSpG: sumSection(day, "SF_SP"),
    ventesEmpG: sumSection(day, "VENTE_EMP"),
    ventesSpG: sumSection(day, "VENTE_SP"),
  };
}

/** A-t-on une saisie de stock final sur cette journée ? */
export function hasFinalStock(day: DayData | undefined): boolean {
  if (!day) return false;
  const t = computeTotals(day);
  return t.sfEmpG !== 0 || t.sfSpG !== 0;
}

/**
 * Calcul d'une journée, formule globale demandée :
 *  Consommation = Total stocks initiaux (Emporter + Salle) + Entrées (Emporter + Salle) − Total stocks finaux (Emporter + Salle)
 *  Ventes = Total des ventes (Surplace + Emporter)
 *  Écart = Ventes − Consommation
 * Le stock initial d'un jour est le stock final de la veille (sinon la saisie manuelle de départ).
 */
export function computeDay(date: string, day: DayData, prev: DayData | undefined): DayResult {
  const t = computeTotals(day);
  const prevTotals = prev ? computeTotals(prev) : null;
  const siEmpG = prevTotals && hasFinalStock(prev) ? prevTotals.sfEmpG : sumSection(day, "SI_EMP") + sumSection(day, "SI_CHAMBRE_EMP");
  const siSpG = prevTotals && hasFinalStock(prev) ? prevTotals.sfSpG : sumSection(day, "SI_SP");

  const siTotalG = siEmpG + siSpG;
  const entreeTotalG = t.entreeEmpG + t.entreeSpG;
  const sfTotalG = t.sfEmpG + t.sfSpG;

  const consoTotalG = siTotalG + entreeTotalG - sfTotalG;
  const ventesTotalG = t.ventesEmpG + t.ventesSpG;
  const ecartTotalG = ventesTotalG - consoTotalG;

  return {
    date,
    ...t,
    siEmpG,
    siSpG,
    consoEmpG: 0,
    consoSpG: 0,
    consoTotalG,
    ventesTotalG,
    ecartEmpG: 0,
    ecartSpG: 0,
    ecartTotalG,
  };
}

/** Dernière journée saisie (avec stock final) avant `date`, en remontant jusqu'à `lookback` jours. */
export function lastFinalBefore(
  history: Map<string, DayData>,
  date: string,
  lookback = 60,
): DayData | undefined {
  const merged: DayData = {};
  const finalSections: Section[] = ["SF_EMP", "SF_FRIGO_EMP", "SF_TRANSIT_EMP", "SF_CHAMBRE_EMP", "SF_SP"];
  let cur = shiftDate(date, -1);
  for (let i = 0; i < lookback; i++) {
    const d = history.get(cur);
    if (d) {
      for (const section of finalSections) {
        // Une journée peut contenir uniquement le stock Chambre automatique.
        // Chaque partie du stock final doit donc être reprise depuis sa dernière
        // journée réellement renseignée, sans effacer les autres parties.
        if (!(section in merged) && section in d) merged[section] = { ...d[section] };
      }
      const hasEmp = "SF_EMP" in merged || "SF_FRIGO_EMP" in merged || "SF_TRANSIT_EMP" in merged;
      if (hasEmp && "SF_CHAMBRE_EMP" in merged && "SF_SP" in merged) return merged;
    }
    cur = shiftDate(cur, -1);
  }
  return hasFinalStock(merged) ? merged : undefined;
}

/** Stock initial dérivé du stock final de la veille (report automatique). */
export function initialFromFinal(prev: DayData | undefined): DayData | undefined {
  if (!hasFinalStock(prev)) return undefined;
  const day = prev as DayData;
  const copy = (section: Section): Record<string, number> => {
    const src = day[section] ?? {};
    const out: Record<string, number> = {};
    for (const it of SECTION_ITEMS[section]) out[it.name] = num(src[it.name]);
    return out;
  };
  return {
    SI_EMP: copy("SF_EMP"),
    SI_CHAMBRE_EMP: copy("SF_CHAMBRE_EMP"),
    SI_SP: copy("SF_SP"),
  };
}

export interface EcartLine {
  entry_date: string;
  section: string;
  item: string;
  qty: number;
}

/** Migration temporaire : les anciennes saisies par parfum des stocks finaux
 *  Emporter sont regroupées en un seul total (SF_EMP / SF_CHAMBRE_EMP). */
export function migrateFinalStock(day: DayData): DayData {
  const out: DayData = { ...day };
  if (!("SF_EMP" in out)) {
    const frigo = out.SF_FRIGO_EMP ?? {};
    const transit = out.SF_TRANSIT_EMP ?? {};
    const conv: Record<string, number> = {};
    let total = 0;
    for (const it of PARFUMS) {
      const g = (num(frigo[it.name]) + num(transit[it.name])) * it.gram;
      conv[it.name] = g;
      total += g;
    }
    if (total > 0) out.SF_EMP = conv;
  } else if (typeof out.SF_EMP?.TOTAL === "number" && Object.keys(out.SF_EMP).length === 1) {
    // ancienne saisie « TOTAL » : conservée sur le premier parfum pour ne rien perdre
    out.SF_EMP = { [PARFUMS[0].name]: num(out.SF_EMP.TOTAL) };
  }
  if (out.SF_CHAMBRE_EMP && typeof out.SF_CHAMBRE_EMP.TOTAL === "number" && Object.keys(out.SF_CHAMBRE_EMP).length === 1) {
    out.SF_CHAMBRE_EMP = { [PARFUMS[0].name]: num(out.SF_CHAMBRE_EMP.TOTAL) };
  }
  return out;
}

export async function fetchEcartLines(start: string, end: string): Promise<Map<string, DayData>> {
  const pdvId = requireCurrentPdvId();
  // Pagination obligatoire : 60 jours × ~135 lignes dépassent la limite de 1000 lignes
  // par requête, ce qui tronquait silencieusement les journées les plus récentes.
  const data = await fetchAllRows<EcartLine>(() =>
    supabase
      .from("ecart_lines")
      .select("entry_date, section, item, qty")
      .eq("pdv_id", pdvId)
      .gte("entry_date", start)
      .lte("entry_date", end)
      .order("entry_date", { ascending: true })
      .order("section", { ascending: true })
      .order("item", { ascending: true }),
  );
  const days = new Map<string, DayData>();
  for (const r of (data ?? []) as EcartLine[]) {
    const d = days.get(r.entry_date) ?? {};
    d[r.section] = { ...(d[r.section] ?? {}), [r.item]: num(r.qty) };
    days.set(r.entry_date, d);
  }
  const migrated = new Map<string, DayData>();
  for (const [k, v] of days) {
    migrated.set(k, migrateFinalStock(v));
  }
  return migrated;
}

// ===== Alimentation automatique depuis le Suivi hebdo « Mouvement glaces » =====
const GLACE_FICHE = "Mouvement glaces & tartes";
const WEEKLY_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
/** Correspondance nom d'article du suivi hebdo -> parfum du calcul des écarts. */
const WEEKLY_TO_PARFUM: Record<string, string> = {
  Banane: "BANANE CARAMILISE",
  "Citron menthe": "CITRON MENTHE",
  "Orange cannelle": "ORANGE CANELLE",
  Réglisse: "REGLISSE",
};
const PARFUM_NAMES = new Set(PARFUMS.map((p) => p.name));

function weekRef(date: string): { weekStart: string } {
  const d = new Date(`${date}T12:00:00`);
  const offset = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - offset);
  return { weekStart: d.toISOString().slice(0, 10) };
}

export interface GlaceAutoDay {
  entrees: Record<string, number>; // parfum -> quantité de stuffs entrée ce jour
  sfChambre: Record<string, number>; // parfum -> stock final chambre = SI hebdo du lendemain
}

/**
 * Lit le Suivi hebdo « Mouvement glaces » et renvoie, pour chaque date de
 * [start..end] : les entrées du jour et le stock final chambre
 * (stock initial hebdo saisi le lendemain).
 */
export async function fetchGlaceAuto(start: string, end: string): Promise<Map<string, GlaceAutoDay>> {
  const pdvId = requireCurrentPdvId();
  const wkFrom = weekRef(start).weekStart;
  const wkTo = weekRef(shiftDate(end, 1)).weekStart;
  type WeeklyRow = {
    week_start: string;
    day_of_week: string;
    article: string | null;
    entrees: number | null;
    stock_initial: number | null;
  };
  // Filtre serveur sur les parfums + pagination : la fiche glace contient plus de
  // 1000 lignes par semaine, la limite par défaut tronquait les semaines récentes.
  const articles = Array.from(new Set([...PARFUM_NAMES, ...Object.keys(WEEKLY_TO_PARFUM)]));
  const data = await fetchAllRows<WeeklyRow>(() =>
    supabase
      .from("weekly_tracking")
      .select("week_start, day_of_week, article, entrees, stock_initial")
      .eq("pdv_id", pdvId)
      .eq("fiche_type", GLACE_FICHE)
      .in("article", articles)
      .gte("week_start", wkFrom)
      .lte("week_start", wkTo)
      .order("week_start", { ascending: true })
      .order("id", { ascending: true }),
  );

  const entreeByDate = new Map<string, Record<string, number>>();
  const siByDate = new Map<string, Record<string, number>>();
  for (const r of data) {
    if (!r.article) continue;
    const parfum = WEEKLY_TO_PARFUM[r.article] ?? r.article;
    if (!PARFUM_NAMES.has(parfum)) continue;
    const idx = WEEKLY_DAYS.indexOf(r.day_of_week as (typeof WEEKLY_DAYS)[number]);
    if (idx < 0) continue;
    const d = new Date(`${r.week_start}T12:00:00`);
    d.setDate(d.getDate() + idx);
    const date = d.toISOString().slice(0, 10);
    const e = num(r.entrees);
    if (r.entrees !== null) {
      const m = entreeByDate.get(date) ?? {};
      m[parfum] = (m[parfum] ?? 0) + e;
      entreeByDate.set(date, m);
    }
    const si = num(r.stock_initial);
    if (r.stock_initial !== null) {
      const m = siByDate.get(date) ?? {};
      m[parfum] = (m[parfum] ?? 0) + si;
      siByDate.set(date, m);
    }
  }

  const out = new Map<string, GlaceAutoDay>();
  for (const date of eachDate(start, end)) {
    out.set(date, {
      entrees: entreeByDate.get(date) ?? {},
      sfChambre: siByDate.get(shiftDate(date, 1)) ?? {},
    });
  }
  return out;
}

/** Injecte les valeurs automatiques (prioritaires) dans les journées chargées. */
export function applyGlaceAuto(
  history: Map<string, DayData>,
  auto: Map<string, GlaceAutoDay>,
): Map<string, DayData> {
  const out = new Map<string, DayData>(history);
  for (const [date, a] of auto) {
    const d: DayData = { ...(out.get(date) ?? {}) };
    // Les produits qui n'existent pas dans le suivi hebdomadaire (ou dans une
    // ancienne semaine) conservent leur valeur enregistrée dans Calcul écarts.
    // Les valeurs automatiques présentes, y compris 0, restent prioritaires.
    if (Object.keys(a.entrees).length > 0) d.ENTREE_EMP = { ...(d.ENTREE_EMP ?? {}), ...a.entrees };
    if (Object.keys(a.sfChambre).length > 0) d.SF_CHAMBRE_EMP = { ...(d.SF_CHAMBRE_EMP ?? {}), ...a.sfChambre };
    out.set(date, d);
  }
  return out;
}

export async function saveEcartDay(date: string, day: DayData, sections: Section[]): Promise<void> {
  const pdv_id = requireCurrentPdvId();
  const rows: { pdv_id: string; entry_date: string; section: string; item: string; qty: number }[] = [];
  for (const section of sections) {
    const map = day[section] ?? {};
    for (const it of SECTION_ITEMS[section]) {
      const qty = num(map[it.name]);
      rows.push({ pdv_id, entry_date: date, section, item: it.name, qty });
    }
  }
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("ecart_lines")
    .upsert(rows, { onConflict: "pdv_id,entry_date,section,item" });
  if (error) throw error;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard++ < 400) {
    out.push(cur);
    cur = shiftDate(cur, 1);
  }
  return out;
}

export const fmtG = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(v));
