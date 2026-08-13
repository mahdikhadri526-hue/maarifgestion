// Centre des anomalies — détection AUTOMATIQUE en LECTURE SEULE.
// Aucune écriture, aucun calcul métier existant modifié.
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePaginate";
import { getProducts } from "@/lib/stockData";

export interface Anomaly {
  id: string;
  date: string; // ISO, géré en arrière-plan (non affiché)
  label: string;
  product?: string | null;
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

const TEMP_SLOTS: { slot: string; hour: number }[] = [
  { slot: "07h", hour: 7 },
  { slot: "16h", hour: 16 },
  { slot: "00h", hour: 24 },
];

const STUFF_SLOTS = ["08h00", "10h00", "12h00", "14h00", "16h00", "18h00", "20h00", "22h00", "00h00"];

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

/** Un créneau est « échu » si son heure limite (+2h de tolérance) est dépassée. */
function slotPassed(dateISO: string, hour: number, now: Date) {
  const deadline = parseISO(dateISO);
  deadline.setHours(hour, 0, 0, 0);
  deadline.setHours(deadline.getHours() + 2);
  return now.getTime() > deadline.getTime();
}

export async function detectAnomalies(pdvId: string, start: string, end: string): Promise<Anomaly[]> {
  const now = new Date();
  const days = datesInRange(start, end);
  const weekStarts = Array.from(new Set(days.map(mondayOf).concat(mondayOf(addDaysISO(end, 1)))));
  const endPlus1 = addDaysISO(end, 1);

  const [temps, stuffs, weekly, cleaning, autoc, initialStocks, movements] = await Promise.all([
    fetchAllRows(() =>
      supabase.from("fridge_temperatures")
        .select("control_date, slot, equipment_name, temperature_haut, temperature_bas, visa_manager, created_at")
        .eq("pdv_id", pdvId).gte("control_date", start).lte("control_date", end)),
    fetchAllRows(() =>
      supabase.from("glace_stuff_controls")
        .select("control_date, slot, parfum, non_conformite, visa_manager")
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
  const push = (date: string, label: string, product?: string | null) =>
    out.push({ id: `${date}|${label}|${product ?? ""}`, date, label, product: product ?? null });

  // Index températures : date|slot
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
    // 1/2 — Températures
    for (const { slot, hour } of TEMP_SLOTS) {
      if (!slotPassed(date, hour, now)) continue;
      const rows = (tempBySlot.get(`${date}|${slot}`) ?? []).filter(
        (r) => r.temperature_haut !== null || r.temperature_bas !== null,
      );
      if (rows.length === 0) {
        push(date, `Température non saisie (créneau ${slot})`);
      } else {
        const first = Math.min(...rows.map((r) => new Date(r.created_at).getTime()));
        const limit = parseISO(date);
        limit.setHours(hour + 2, 0, 0, 0);
        if (first > limit.getTime()) push(date, `Retard de saisie de la température (créneau ${slot})`);
      }
    }

    // 5 — Contrôle cassures/fissures des bacs de glace (toutes les 2 heures)
    const missingStuff = STUFF_SLOTS.filter((s, i) => {
      const hour = s === "00h00" ? 24 : Number(s.slice(0, 2));
      if (!slotPassed(date, hour, now)) return false;
      const rows = (stuffBySlot.get(`${date}|${s}`) ?? []).filter(
        (r) => filled(r.parfum) || r.non_conformite !== null,
      );
      return rows.length === 0;
    });
    missingStuff.forEach((s) =>
      push(date, `Contrôle des cassures/fissures des bacs de glace non effectué (créneau ${s})`),
    );

    // 9 — Visa manager non effectué
    const tempDay = (temps as any[]).filter(
      (r) => r.control_date === date && (r.temperature_haut !== null || r.temperature_bas !== null),
    );
    if (tempDay.length > 0 && !tempDay.some((r) => filled(r.visa_manager)))
      push(date, "Visa du manager non effectué (Températures frigos)");

    const cleanDay = (cleaning as any[]).filter((r) => String(r.log_date) === date);
    cleanDay.filter((r) => !filled(r.visa_manager)).forEach((r) =>
      push(date, `Visa du manager non effectué (Nettoyage — ${r.zone})`),
    );

    (autoc as any[])
      .filter((r) => r.control_date === date && !filled(r.visa_manager))
      .forEach((r) => push(date, `Visa du manager non effectué (Autocontrôle — ${r.fiche_type})`, r.article));

    const stuffDay = (stuffs as any[]).filter(
      (r) => r.control_date === date && (filled(r.parfum) || r.non_conformite !== null),
    );
    if (stuffDay.length > 0 && !stuffDay.some((r) => filled(r.visa_manager)))
      push(date, "Visa du manager non effectué (Contrôle STUFFS de glace)");

    // Suivi hebdomadaire du jour
    const wk = mondayOf(date);
    const dn = dayName(date);
    const mvtDay = (weekly as any[]).filter(
      (r) => r.fiche_type === "Mouvement glaces & tartes" && r.week_start === wk && r.day_of_week === dn,
    );

    // 3 — Sortie négative (Glace et Tarte uniquement)
    mvtDay
      .filter((r) => r.sorties !== null && Number(r.sorties) < 0)
      .forEach((r) =>
        push(
          date,
          `Sortie négative (${GLACE_ARTICLES.has(r.article) ? "Glace" : "Tarte"})`,
          r.article,
        ),
      );

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
    if (!shiftFilled(0, 1)) push(date, "Suivi de la crème chantilly non rempli (matin)");
    if (!shiftFilled(2, 3)) push(date, "Suivi de la crème chantilly non rempli (soir)");

    // 7/8 — Stock initial du lendemain
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
      push(date, "Stock initial du lendemain (Glace) non renseigné");
    if (!nextRows.some((r) => !GLACE_ARTICLES.has(r.article)))
      push(date, "Stock initial du lendemain (Tarte) non renseigné");
  }

  // 4 — Produits en rupture (état actuel, listé si la période inclut aujourd'hui)
  const today = toISO(now);
  if (today >= start && today <= end) {
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
    getProducts().forEach((p) => names.set(p.id, names.get(p.id) ?? p.name));
    const ids = new Set<string>([...initMap.keys(), ...deltas.keys()]);
    ids.forEach((pid) => {
      const remaining = (initMap.get(pid) ?? 0) + (deltas.get(pid) ?? 0);
      if (remaining <= 0 && (initMap.has(pid) || deltas.has(pid)))
        push(today, "Produit en rupture", names.get(pid) ?? pid);
    });
  }

  return out.sort((a, b) => (a.date === b.date ? a.label.localeCompare(b.label) : a.date.localeCompare(b.date)));
}
