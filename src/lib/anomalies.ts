// Centre des anomalies — détection AUTOMATIQUE en LECTURE SEULE.
// Aucune écriture, aucun calcul métier existant modifié.
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePaginate";
import { getProducts } from "@/lib/stockData";

export type Severity = "urgent" | "attention";

export interface Anomaly {
  id: string;
  severity: Severity;
  date: string;   // ISO yyyy-mm-dd
  time: string;   // "07h00", "08h00 → 12h00", ou "—"
  label: string;
  product?: string | null;
  details?: string | null;
}

export interface ScoreLine {
  id: string;
  label: string;
  count: number;
  penalty: number; // points retirés (valeur positive)
  per: number;     // pénalité appliquée par tranche de "per" anomalies
  points: number;  // points retirés par tranche
}

export interface PdvScore {
  score: number; // note sur 10
  lines: ScoreLine[];
}

/** Barème configurable : chaque règle retire `points` par tranche de `per` anomalies. */
export interface ScoreRule {
  id: string;
  label: string;
  anomalyLabel: string | null; // null = source externe (reports PEP)
  product?: string;
  per: number;
  points: number;
}

export const DEFAULT_SCORE_RULES: ScoreRule[] = [
  { id: "temp_missing", label: "Température non saisie", anomalyLabel: "Température non saisie", per: 1, points: 0.5 },
  { id: "temp_late", label: "Retards température (≥30 min)", anomalyLabel: "Retard de saisie de la température", per: 10, points: 0.5 },
  { id: "stuff_missing", label: "Cassure/fissure non contrôlée", anomalyLabel: "Contrôle cassure/fissure des bacs de glace non effectué", per: 1, points: 0.5 },
  { id: "stuff_late", label: "Retards cassure/fissure (≥30 min)", anomalyLabel: "Retard de saisie du contrôle des STUFFS de glace", per: 10, points: 0.5 },
  { id: "pep_missed", label: "Tâche PEP non effectuée", anomalyLabel: "Tâche PEP non réalisée", per: 1, points: 0.5 },
  { id: "pep_postponed", label: "Tâches PEP reportées", anomalyLabel: null, per: 10, points: 0.5 },
  { id: "rupture", label: "Produit en rupture", anomalyLabel: "Produits en rupture", per: 1, points: 0 },
  { id: "negative", label: "Sorties négatives", anomalyLabel: "Sortie négative", per: 10, points: 0.5 },
  { id: "chantilly", label: "Suivi chantilly non rempli", anomalyLabel: "Suivi de la crème chantilly non rempli", per: 1, points: 0.5 },
  { id: "si_tarte", label: "SI lendemain Tarte non saisi", anomalyLabel: "Stock initial du lendemain non renseigné", product: "Tarte", per: 1, points: 0.5 },
  { id: "si_glace", label: "SI lendemain Glace non saisi", anomalyLabel: "Stock initial du lendemain non renseigné", product: "Glace", per: 1, points: 0.5 },
  { id: "si_clean", label: "SI lendemain produits nettoyants non saisi", anomalyLabel: "Stock initial du lendemain non renseigné", product: "Produits nettoyants", per: 1, points: 0.5 },
  { id: "visa", label: "Visas Manager non effectués", anomalyLabel: "Visa du manager non effectué", per: 5, points: 0.5 },
];

const RULES_KEY = "anomaly_score_rules_v1";

export function loadScoreRules(): ScoreRule[] {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return DEFAULT_SCORE_RULES;
    const saved = JSON.parse(raw) as Partial<ScoreRule>[];
    return DEFAULT_SCORE_RULES.map((d) => {
      const s = saved.find((x) => x.id === d.id);
      if (!s) return d;
      return {
        ...d,
        per: Math.max(1, Number(s.per) || d.per),
        points: Math.max(0, Number(s.points) ?? d.points),
      };
    });
  } catch {
    return DEFAULT_SCORE_RULES;
  }
}

export function saveScoreRules(rules: ScoreRule[]) {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules.map((r) => ({ id: r.id, per: r.per, points: r.points }))));
}


const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

const TEMP_SLOTS: { slot: string; hour: number }[] = [
  { slot: "07h", hour: 7 },
  { slot: "16h", hour: 16 },
  { slot: "00h", hour: 24 },
];

const STUFF_SLOTS = ["08h00", "10h00", "12h00", "14h00", "16h00", "18h00", "20h00", "22h00", "00h00"];

/** Heure (locale) après laquelle la journée de travail est considérée terminée. */
const END_OF_WORKDAY_HOUR = 27; // 03h00 du lendemain

const GLACE_ARTICLES = new Set([
  "Nougat", "Praliné", "Vanille", "Chocolat", "Pistache", "Caramel", "Moka",
  "Parfait", "Fraise", "Framboise", "Orange", "Mangue", "Citron", "Pêche",
  "Banane", "Citron menthe", "Orange cannelle", "Réglisse",
  "Crème fraîche (mousse fouettée)",
]);

export function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDaysISO(iso: string, n: number) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

function mondayOf(iso: string) {
  const d = parseISO(iso);
  const day = d.getDay();
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  return toISO(d);
}

function dayName(iso: string) {
  const d = parseISO(iso);
  return DAYS[(d.getDay() + 6) % 7];
}

export function datesInRange(start: string, end: string) {
  const out: string[] = [];
  let cur = start;
  for (let i = 0; i < 400 && cur <= end; i++) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
}

const filled = (v: any) => v !== null && v !== undefined && String(v).trim() !== "";

function hourAt(dateISO: string, hour: number, minutes = 0) {
  const d = parseISO(dateISO);
  d.setHours(hour, minutes, 0, 0);
  return d;
}

/** Tolérance de retard de saisie : 30 minutes après l'heure prévue. */
const LATE_TOLERANCE_MIN = 30;

/** Produits exclus de la liste des ruptures (mots-clés sur le nom). */
const RUPTURE_EXCLUDED = ["fraise", "ananas", "glace", "topping"];
const isExcludedFromRupture = (name: string) => {
  const n = name.toLowerCase();
  return RUPTURE_EXCLUDED.some((k) => n.includes(k));
};

/** Un créneau est « échu » si son heure limite (+2h de tolérance) est dépassée. */
function slotPassed(dateISO: string, hour: number, now: Date) {
  const deadline = hourAt(dateISO, hour);
  deadline.setHours(deadline.getHours() + 2);
  return now.getTime() > deadline.getTime();
}

function workdayEnded(dateISO: string, now: Date) {
  return now.getTime() > hourAt(dateISO, END_OF_WORKDAY_HOUR).getTime();
}

function hhmm(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Heure réelle de saisie : dernière écriture connue (updated_at), sinon création. */
function entryTime(r: any): number | null {
  const ts = r?.updated_at ?? r?.created_at;
  if (!ts) return null;
  const t = new Date(ts).getTime();
  return isNaN(t) ? null : t;
}


/** Regroupe une liste de créneaux en une plage lisible. */
function slotRange(slots: string[]) {
  if (slots.length === 0) return "—";
  if (slots.length === 1) return slots[0];
  return `${slots[0]} → ${slots[slots.length - 1]}`;
}

export interface AnalysisResult {
  rows: Anomaly[];
  postponedCount: number;
}

export async function detectAnomalies(pdvId: string, start: string, end: string): Promise<Anomaly[]> {
  return (await analyzePdv(pdvId, start, end)).rows;
}

export async function analyzePdv(pdvId: string, start: string, end: string): Promise<AnalysisResult> {
  const now = new Date();
  const days = datesInRange(start, end);
  const weekStarts = Array.from(new Set(days.map(mondayOf).concat(mondayOf(addDaysISO(end, 1)))));

  const [temps, stuffs, weekly, cleaning, autoc, initialStocks, movements] = await Promise.all([
    fetchAllRows(() =>
      supabase.from("fridge_temperatures")
        .select("control_date, slot, zone, equipment_name, temperature_haut, temperature_bas, visa_manager, created_at, updated_at")
        .eq("pdv_id", pdvId).gte("control_date", start).lte("control_date", end)),
    fetchAllRows(() =>
      supabase.from("glace_stuff_controls")
        .select("control_date, slot, zone, parfum, non_conformite, visa_manager, created_at, updated_at")
        .eq("pdv_id", pdvId).gte("control_date", start).lte("control_date", end)),
    fetchAllRows(() =>
      supabase.from("weekly_tracking")
        .select("fiche_type, week_start, day_of_week, row_index, article, stock_initial, entrees, sorties, couleur, odeur, texture, quantity, visa_manager")
        .eq("pdv_id", pdvId).in("week_start", weekStarts)),
    fetchAllRows(() =>
      supabase.from("cleaning_logs").select("log_date, zone, visa_manager")
        .eq("pdv_id", pdvId).gte("log_date", start).lte("log_date", end)),
    fetchAllRows(() =>
      supabase.from("autocontrols").select("control_date, fiche_type, article, visa_manager")
        .eq("pdv_id", pdvId).gte("control_date", start).lte("control_date", end)),
    supabase.from("initial_stocks").select("product_id, quantity").eq("pdv_id", pdvId),
    fetchAllRows(() =>
      supabase.from("stock_movements")
        .select("product_id, product_name, type, quantity, date")
        .eq("pdv_id", pdvId)
        .lte("date", end)),
  ]);

  const out: Anomaly[] = [];
  const push = (a: Omit<Anomaly, "id">) =>
    out.push({ ...a, id: `${a.date}|${a.time}|${a.label}|${a.product ?? ""}` });

  const tempBySlot = new Map<string, any[]>();
  (temps as any[]).forEach((r) => {
    const k = `${r.control_date}|${r.slot}`;
    if (!tempBySlot.has(k)) tempBySlot.set(k, []);
    tempBySlot.get(k)!.push(r);
  });

  const stuffBySlot = new Map<string, any[]>();
  (stuffs as any[]).forEach((r) => {
    const k = `${r.control_date}|${r.slot}`;
    if (!stuffBySlot.has(k)) stuffBySlot.set(k, []);
    stuffBySlot.get(k)!.push(r);
  });

  for (const date of days) {
    // 1/2 — Températures (regroupées par jour)
    const missingTemp: string[] = [];
    const lateRowsAll: { slot: string; at: string; zone: string; equip: string; atTime: number }[] = [];
    for (const { slot, hour } of TEMP_SLOTS) {
      if (!slotPassed(date, hour, now)) continue;
      const rows = (tempBySlot.get(`${date}|${slot}`) ?? []).filter(
        (r) => r.temperature_haut !== null || r.temperature_bas !== null,
      );
      if (rows.length === 0) {
        missingTemp.push(`${slot}00`);
      } else {
        const limit = hourAt(date, hour, LATE_TOLERANCE_MIN).getTime();
        // Un relevé est en retard dès qu'UN matériel est saisi après la limite.
        rows.forEach((r) => {
          const t = entryTime(r);
          if (t === null || t <= limit) return;
          lateRowsAll.push({
            slot: `${slot}00`,
            at: hhmm(new Date(t).toISOString()),
            zone: r.zone ?? "",
            equip: r.equipment_name ?? "?",
            atTime: t,
          });
        });
      }
    }
    if (missingTemp.length)
      push({
        severity: "urgent",
        date,
        time: slotRange(missingTemp),
        label: "Température non saisie",
        product: "Frigos / Congélateurs",
        details: `${missingTemp.length} créneau(x) manquant(s) : ${missingTemp.join(", ")}`,
      });
    // Une ligne distincte par matériel en retard : Zone + matériel + heure saisie + heure prévue
    lateRowsAll
      .sort((a, b) => a.atTime - b.atTime)
      .forEach((l) => {
        push({
          severity: "attention",
          date,
          time: l.at,
          label: "Retard de saisie de la température",
          product: l.zone ? `${l.zone} : ${l.equip}` : l.equip,
          details: `${l.at} au lieu de ${l.slot}`,
        });
      });


    // 5 — Contrôle cassures/fissures des bacs de glace (regroupé)
    const missingStuff = STUFF_SLOTS.filter((s) => {
      const hour = s === "00h00" ? 24 : Number(s.slice(0, 2));
      if (!slotPassed(date, hour, now)) return false;
      const rows = (stuffBySlot.get(`${date}|${s}`) ?? []).filter(
        (r) => filled(r.parfum) || r.non_conformite !== null,
      );
      return rows.length === 0;
    });
    if (missingStuff.length)
      push({
        severity: missingStuff.length >= 3 ? "urgent" : "attention",
        date,
        time: slotRange(missingStuff),
        label: "Contrôle cassure/fissure des bacs de glace non effectué",
        product: "Bacs de glace",
        details: `${missingStuff.length} contrôle(s) manquant(s) sur ${STUFF_SLOTS.length} : ${missingStuff.join(", ")}`,
      });

    // 5 bis — Retard de saisie des contrôles STUFFS (une ligne par saisie)
    const lateStuff: { slot: string; at: string; atTime: number; label: string }[] = [];
    for (const s of STUFF_SLOTS) {
      const hour = s === "00h00" ? 24 : Number(s.slice(0, 2));
      const rows = (stuffBySlot.get(`${date}|${s}`) ?? []).filter(
        (r) => (filled(r.parfum) || r.non_conformite !== null) && entryTime(r) !== null,
      );
      if (rows.length === 0) continue;
      const limit = hourAt(date, hour, LATE_TOLERANCE_MIN).getTime();
      rows.forEach((r) => {
        const t = entryTime(r) as number;
        if (t <= limit) return;
        const zone = r.zone ? String(r.zone) : "";
        const parfum = filled(r.parfum) ? String(r.parfum) : "Bac de glace";
        lateStuff.push({
          slot: s,
          at: hhmm(new Date(t).toISOString()),
          atTime: t,
          label: zone ? `${zone} : ${parfum}` : parfum,
        });
      });
    }
    lateStuff
      .sort((a, b) => a.atTime - b.atTime)
      .forEach((l) => {
        push({
          severity: "attention",
          date,
          time: l.at,
          label: "Retard de saisie du contrôle des STUFFS de glace",
          product: l.label,
          details: `${l.at} au lieu de ${l.slot}`,
        });
      });


    // 9 — Visas manager (regroupés par module)
    const tempDay = (temps as any[]).filter(
      (r) => r.control_date === date && (r.temperature_haut !== null || r.temperature_bas !== null),
    );
    if (tempDay.length > 0 && !tempDay.some((r) => filled(r.visa_manager)))
      push({
        severity: "attention", date, time: "—",
        label: "Visa du manager non effectué",
        product: "Températures frigos",
        details: `${tempDay.length} relevé(s) sans visa`,
      });

    const cleanNoVisa = (cleaning as any[]).filter(
      (r) => String(r.log_date) === date && !filled(r.visa_manager),
    );
    if (cleanNoVisa.length)
      push({
        severity: "attention", date, time: "—",
        label: "Visa du manager non effectué",
        product: "Nettoyage",
        details: `Zone(s) : ${cleanNoVisa.map((r) => r.zone).join(", ")}`,
      });

    const autocNoVisa = (autoc as any[]).filter(
      (r) => r.control_date === date && !filled(r.visa_manager),
    );
    const byFiche = new Map<string, string[]>();
    autocNoVisa.forEach((r) => {
      if (!byFiche.has(r.fiche_type)) byFiche.set(r.fiche_type, []);
      if (filled(r.article)) byFiche.get(r.fiche_type)!.push(r.article);
    });
    byFiche.forEach((articles, fiche) =>
      push({
        severity: "attention", date, time: "—",
        label: "Visa du manager non effectué",
        product: `Autocontrôle — ${fiche}`,
        details: articles.length ? `Article(s) : ${Array.from(new Set(articles)).join(", ")}` : null,
      }),
    );

    const stuffDay = (stuffs as any[]).filter(
      (r) => r.control_date === date && (filled(r.parfum) || r.non_conformite !== null),
    );
    if (stuffDay.length > 0 && !stuffDay.some((r) => filled(r.visa_manager)))
      push({
        severity: "attention", date, time: "—",
        label: "Visa du manager non effectué",
        product: "Contrôle STUFFS de glace",
        details: `${stuffDay.length} ligne(s) sans visa`,
      });

    // Suivi hebdomadaire du jour
    const wk = mondayOf(date);
    const dn = dayName(date);
    const mvtDay = (weekly as any[]).filter(
      (r) => r.fiche_type === "Mouvement glaces & tartes" && r.week_start === wk && r.day_of_week === dn,
    );

    // 3 — Sortie négative (Glace et Tarte uniquement) — toutes les occurrences
    mvtDay
      .filter((r) => r.sorties !== null && Number(r.sorties) < 0 && filled(r.article))
      .forEach((r) =>
        push({
          severity: "urgent",
          date,
          time: "—",
          label: "Sortie négative",
          product: r.article,
          details: `${GLACE_ARTICLES.has(r.article) ? "Glace" : "Tarte"} · Sortie ${Number(r.sorties)} · SI ${r.stock_initial ?? 0} · Entrées ${r.entrees ?? 0}`,
        }),
      );

    // 3 bis — Sortie négative CALCULÉE du suivi hebdomadaire Glaces & Tartes
    // (SI du jour + entrées du jour − SI du lendemain), comme dans le tableau.
    {
      const nextDate = addDaysISO(date, 1);
      const wkNext = mondayOf(nextDate);
      const dnNext = dayName(nextDate);
      const articles = Array.from(
        new Set(
          (weekly as any[])
            .filter((r) => r.fiche_type === "Mouvement glaces & tartes" && filled(r.article))
            .map((r) => r.article as string),
        ),
      ).filter((a) => a !== "Crème fraîche (mousse fouettée)");
      for (const article of articles) {
        const dayRows = mvtDay.filter((r) => r.article === article);
        if (dayRows.length === 0) continue;
        // sortie déjà saisie manuellement : déjà traitée plus haut
        if (dayRows.some((r) => r.sorties !== null)) continue;
        const siRow = dayRows.find((r) => (r.row_index ?? 0) === 0 && r.stock_initial !== null);
        const nextRow = (weekly as any[]).find(
          (r) =>
            r.fiche_type === "Mouvement glaces & tartes" &&
            r.week_start === wkNext &&
            r.day_of_week === dnNext &&
            r.article === article &&
            (r.row_index ?? 0) === 0 &&
            r.stock_initial !== null,
        );
        if (!nextRow) continue;
        const si = Number(siRow?.stock_initial ?? 0);
        const entrees = dayRows.reduce((s, r) => s + (Number(r.entrees) || 0), 0);
        const sortie = si + entrees - Number(nextRow.stock_initial);
        if (sortie < 0)
          push({
            severity: "urgent",
            date,
            time: "—",
            label: "Sortie négative",
            product: article,
            details: `${GLACE_ARTICLES.has(article) ? "Glace" : "Tarte"} · Sortie calculée ${sortie} · SI ${si} · Entrées ${entrees} · SI lendemain ${Number(nextRow.stock_initial)}`,
          });
      }
    }

    // 6 — Suivi crème chantilly (matin / soir)
    const cremeDay = (weekly as any[]).filter(
      (r) => r.fiche_type === "Crème fraîche" && r.week_start === wk && r.day_of_week === dn,
    );
    const shiftFilled = (from: number, to: number) =>
      cremeDay.some(
        (r) =>
          (r.row_index ?? 0) >= from &&
          (r.row_index ?? 0) <= to &&
          (filled(r.couleur) || filled(r.odeur) || filled(r.texture) || filled(r.quantity) || filled(r.entrees)),
      );
    const missingShifts: string[] = [];
    if (slotPassed(date, 12, now) && !shiftFilled(0, 1)) missingShifts.push("matin");
    if (workdayEnded(date, now) && !shiftFilled(2, 3)) missingShifts.push("soir");
    if (missingShifts.length)
      push({
        severity: "attention", date, time: "—",
        label: "Suivi de la crème chantilly non rempli",
        product: "Crème chantilly",
        details: `Non rempli : ${missingShifts.join(" et ")}`,
      });

    // 7/8 — Stock initial du lendemain (seulement après la fin de la journée de travail)
    if (workdayEnded(date, now)) {
      const nextDate = addDaysISO(date, 1);
      const nextRows = (weekly as any[]).filter(
        (r) =>
          r.fiche_type === "Mouvement glaces & tartes" &&
          r.week_start === mondayOf(nextDate) &&
          r.day_of_week === dayName(nextDate) &&
          (r.row_index ?? 0) === 0 &&
          r.stock_initial !== null,
      );
      if (!nextRows.some((r) => GLACE_ARTICLES.has(r.article)))
        push({
          severity: "urgent", date, time: "—",
          label: "Stock initial du lendemain non renseigné",
          product: "Glace",
          details: `Stock initial du ${nextDate.split("-").reverse().join(".")} manquant`,
        });
      if (!nextRows.some((r) => !GLACE_ARTICLES.has(r.article)))
        push({
          severity: "urgent", date, time: "—",
          label: "Stock initial du lendemain non renseigné",
          product: "Tarte",
          details: `Stock initial du ${nextDate.split("-").reverse().join(".")} manquant`,
        });
      // SI lendemain — Produits nettoyants
      const nextClean = (weekly as any[]).some(
        (r) =>
          r.fiche_type === "Mouvement produits nettoyants" &&
          r.week_start === mondayOf(nextDate) &&
          r.day_of_week === dayName(nextDate) &&
          r.stock_initial !== null,
      );
      if (!nextClean)
        push({
          severity: "urgent", date, time: "—",
          label: "Stock initial du lendemain non renseigné",
          product: "Produits nettoyants",
          details: `Stock initial du ${nextDate.split("-").reverse().join(".")} manquant`,
        });
    }
  }

  // 4 — Produits en rupture (état au jour le jour) — une seule ligne groupée par jour
  {
    const initMap = new Map<string, number>();
    ((initialStocks as any).data ?? []).forEach((r: any) =>
      initMap.set(r.product_id, Number(r.quantity) || 0),
    );
    const names = new Map<string, string>();
    (movements as any[]).forEach((m) => {
      if (m.product_name) names.set(m.product_id, m.product_name);
    });
    getProducts().forEach((p) => names.set(p.id, p.name || names.get(p.id) || p.id));

    // Mouvements regroupés par produit puis par date (date au format ISO yyyy-mm-dd)
    const movementsByProduct = new Map<string, Map<string, number>>();
    (movements as any[]).forEach((m) => {
      const q = Number(m.quantity) || 0;
      const delta = m.type === "entree" ? q : -q;
      if (!movementsByProduct.has(m.product_id)) movementsByProduct.set(m.product_id, new Map());
      const byDate = movementsByProduct.get(m.product_id)!;
      byDate.set(m.date, (byDate.get(m.date) ?? 0) + delta);
    });

    const ids = new Set<string>([...initMap.keys(), ...movementsByProduct.keys()]);

    for (const date of days) {
      const ruptures: { name: string; remaining: number }[] = [];
      ids.forEach((pid) => {
        const name = names.get(pid);
        if (!name) return; // on n'affiche jamais un code produit inconnu
        if (isExcludedFromRupture(name)) return;
        const initial = initMap.get(pid) ?? 0;
        let remaining = initial;
        const byDate = movementsByProduct.get(pid);
        if (byDate) {
          byDate.forEach((delta, mDate) => {
            if (mDate <= date) remaining += delta;
          });
        }
        if (remaining <= 0 && (initMap.has(pid) || byDate?.size))
          ruptures.push({ name, remaining });
      });
      if (ruptures.length) {
        ruptures.sort((a, b) => a.name.localeCompare(b.name));
        const hasNegative = ruptures.some((r) => r.remaining < 0);
        const list = ruptures.map((r) => r.name).join(", ");
        push({
          severity: hasNegative ? "urgent" : "attention",
          date,
          time: "—",
          label: "Produits en rupture",
          product: `${ruptures.length} produit(s)`,
          details: list,
        });
      }
    }
  }

  // 9 — Tâches PEP non réalisées (échéance dépassée, ni réalisée ni reportée)
  let postponedCount = 0;
  try {
    const todayISO = toISO(now);
    const { count: pc } = await supabase
      .from("pep_postponements" as any)
      .select("id", { count: "exact", head: true })
      .eq("pdv_id", pdvId)
      .gte("to_date", start)
      .lte("to_date", end);
    postponedCount = pc ?? 0;
    const { data: pepOcc } = await supabase
      .from("pep_occurrences" as any)
      .select("id, due_date, status, task_id, pep_tasks(name, equipment, frequency, responsable)")
      .eq("pdv_id", pdvId)
      .gte("due_date", start)
      .lte("due_date", end < todayISO ? end : todayISO);
    ((pepOcc ?? []) as any[]).forEach((o) => {
      if (o.status === "done" || o.status === "missed") return;
      if (o.due_date >= todayISO) return;
      const t = o.pep_tasks ?? {};
      push({
        severity: "urgent",
        date: o.due_date,
        time: "—",
        label: "Tâche PEP non réalisée",
        product: t.name ?? "Tâche PEP",
        details: [
          t.equipment ? `Matériel : ${t.equipment}` : null,
          t.frequency ? `Fréquence : ${t.frequency}` : null,
          t.responsable ? `Responsable : ${t.responsable}` : null,
          `Prévue le ${o.due_date.split("-").reverse().join(".")}`,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    });
  } catch {
    // module PEP indisponible : aucune anomalie ajoutée
  }

  const sevRank = (s: Severity) => (s === "urgent" ? 0 : 1);
  const rows = out.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      sevRank(a.severity) - sevRank(b.severity) ||
      a.label.localeCompare(b.label),
  );
  return { rows, postponedCount };
}

/** Note automatique /10 d'un PDV à partir des anomalies détectées. */
export function computeScore(rows: Anomaly[], postponedCount: number): PdvScore {
  const countLabel = (label: string, product?: string) =>
    rows.filter((r) => r.label === label && (product === undefined || r.product === product)).length;

  const lines: ScoreLine[] = [];
  const add = (label: string, count: number, penalty: number) => {
    if (count > 0 || penalty > 0) lines.push({ label, count, penalty });
  };

  const cTempMissing = countLabel("Température non saisie");
  add("Température non saisie", cTempMissing, cTempMissing * 0.5);

  const cTempLate = countLabel("Retard de saisie de la température");
  add("Retards température (≥30 min)", cTempLate, Math.floor(cTempLate / 10) * 0.5);

  const cStuffMissing = countLabel("Contrôle cassure/fissure des bacs de glace non effectué");
  add("Cassure/fissure non contrôlée", cStuffMissing, cStuffMissing * 0.5);

  const cStuffLate = countLabel("Retard de saisie du contrôle des STUFFS de glace");
  add("Retards cassure/fissure (≥30 min)", cStuffLate, Math.floor(cStuffLate / 10) * 0.5);

  const cPepMissed = countLabel("Tâche PEP non réalisée");
  add("Tâche PEP non effectuée", cPepMissed, cPepMissed * 0.5);

  add("Tâches PEP reportées", postponedCount, Math.floor(postponedCount / 10) * 0.5);

  const cRupture = countLabel("Produits en rupture");
  add("Produit en rupture", cRupture, 0);

  const cNeg = countLabel("Sortie négative");
  add("Sorties négatives", cNeg, Math.floor(cNeg / 10) * 0.5);

  const cChantilly = countLabel("Suivi de la crème chantilly non rempli");
  add("Suivi chantilly non rempli", cChantilly, cChantilly * 0.5);

  const cSiTarte = countLabel("Stock initial du lendemain non renseigné", "Tarte");
  add("SI lendemain Tarte non saisi", cSiTarte, cSiTarte * 0.5);

  const cSiGlace = countLabel("Stock initial du lendemain non renseigné", "Glace");
  add("SI lendemain Glace non saisi", cSiGlace, cSiGlace * 0.5);

  const cSiClean = countLabel("Stock initial du lendemain non renseigné", "Produits nettoyants");
  add("SI lendemain produits nettoyants non saisi", cSiClean, cSiClean * 0.5);

  const cVisa = countLabel("Visa du manager non effectué");
  add("Visas Manager non effectués", cVisa, Math.floor(cVisa / 5) * 0.5);

  const totalPenalty = lines.reduce((s, l) => s + l.penalty, 0);
  const score = Math.max(0, Math.round((10 - totalPenalty) * 10) / 10);
  return { score, lines };
}
