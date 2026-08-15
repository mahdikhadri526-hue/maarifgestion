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

function hourAt(dateISO: string, hour: number) {
  const d = parseISO(dateISO);
  d.setHours(hour, 0, 0, 0);
  return d;
}

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

/** Regroupe une liste de créneaux en une plage lisible. */
function slotRange(slots: string[]) {
  if (slots.length === 0) return "—";
  if (slots.length === 1) return slots[0];
  return `${slots[0]} → ${slots[slots.length - 1]}`;
}

export async function detectAnomalies(pdvId: string, start: string, end: string): Promise<Anomaly[]> {
  const now = new Date();
  const days = datesInRange(start, end);
  const weekStarts = Array.from(new Set(days.map(mondayOf).concat(mondayOf(addDaysISO(end, 1)))));

  const [temps, stuffs, weekly, cleaning, autoc, initialStocks, movements] = await Promise.all([
    fetchAllRows(() =>
      supabase.from("fridge_temperatures")
        .select("control_date, slot, equipment_name, temperature_haut, temperature_bas, visa_manager, created_at")
        .eq("pdv_id", pdvId).gte("control_date", start).lte("control_date", end)),
    fetchAllRows(() =>
      supabase.from("glace_stuff_controls")
        .select("control_date, slot, parfum, non_conformite, visa_manager, created_at")
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
      supabase.from("stock_movements").select("product_id, product_name, type, quantity").eq("pdv_id", pdvId)),
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
    const lateTemp: { slot: string; at: string }[] = [];
    for (const { slot, hour } of TEMP_SLOTS) {
      if (!slotPassed(date, hour, now)) continue;
      const rows = (tempBySlot.get(`${date}|${slot}`) ?? []).filter(
        (r) => r.temperature_haut !== null || r.temperature_bas !== null,
      );
      if (rows.length === 0) {
        missingTemp.push(`${slot}00`);
      } else {
        const first = Math.min(...rows.map((r) => new Date(r.created_at).getTime()));
        const limit = hourAt(date, hour + 2).getTime();
        if (first > limit) lateTemp.push({ slot: `${slot}00`, at: hhmm(new Date(first).toISOString()) });
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
    if (lateTemp.length)
      push({
        severity: "attention",
        date,
        time: slotRange(lateTemp.map((l) => l.slot)),
        label: "Retard de saisie de la température",
        product: "Frigos / Congélateurs",
        details: lateTemp.map((l) => `${l.slot} saisi à ${l.at}`).join(" · "),
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

    // 5 bis — Retard de saisie des contrôles STUFFS (plus de 2 h après le créneau)
    const lateStuff: { slot: string; at: string }[] = [];
    for (const s of STUFF_SLOTS) {
      const hour = s === "00h00" ? 24 : Number(s.slice(0, 2));
      const rows = (stuffBySlot.get(`${date}|${s}`) ?? []).filter(
        (r) => (filled(r.parfum) || r.non_conformite !== null) && r.created_at,
      );
      if (rows.length === 0) continue;
      const first = Math.min(...rows.map((r) => new Date(r.created_at).getTime()));
      if (first > hourAt(date, hour + 2).getTime())
        lateStuff.push({ slot: s, at: hhmm(new Date(first).toISOString()) });
    }
    if (lateStuff.length)
      push({
        severity: "attention",
        date,
        time: slotRange(lateStuff.map((l) => l.slot)),
        label: "Retard de saisie du contrôle des STUFFS de glace",
        product: "Bacs de glace",
        details: lateStuff.map((l) => `${l.slot} saisi à ${l.at}`).join(" · "),
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
    }
  }

  // 4 — Produits en rupture (état actuel) — une seule ligne groupée, affichée chaque jour
  {
    const initMap = new Map<string, number>();
    ((initialStocks as any).data ?? []).forEach((r: any) =>
      initMap.set(r.product_id, Number(r.quantity) || 0),
    );
    const deltas = new Map<string, number>();
    const names = new Map<string, string>();
    (movements as any[]).forEach((m) => {
      const q = Number(m.quantity) || 0;
      deltas.set(m.product_id, (deltas.get(m.product_id) ?? 0) + (m.type === "entree" ? q : -q));
      if (m.product_name) names.set(m.product_id, m.product_name);
    });
    getProducts().forEach((p) => names.set(p.id, p.name || names.get(p.id) || p.id));
    const ids = new Set<string>([...initMap.keys(), ...deltas.keys()]);
    const ruptures: { name: string; remaining: number }[] = [];
    ids.forEach((pid) => {
      const name = names.get(pid);
      if (!name) return; // on n'affiche jamais un code produit inconnu
      const remaining = (initMap.get(pid) ?? 0) + (deltas.get(pid) ?? 0);
      if (remaining <= 0 && (initMap.has(pid) || deltas.has(pid)))
        ruptures.push({ name, remaining });
    });
    if (ruptures.length) {
      ruptures.sort((a, b) => a.name.localeCompare(b.name));
      const hasNegative = ruptures.some((r) => r.remaining < 0);
      const list = ruptures.map((r) => r.name).join(", ");
      for (const date of days) {
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

  const sevRank = (s: Severity) => (s === "urgent" ? 0 : 1);
  return out.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      sevRank(a.severity) - sevRank(b.severity) ||
      a.label.localeCompare(b.label),
  );
}
