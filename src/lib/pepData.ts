// ============================================================================
// Module AGENDA PEP — planification automatique des tâches du manager.
// Aucune table / logique existante n'est modifiée : tout vit dans pep_*.
// ============================================================================
import { supabase } from "@/lib/db";
import { supabase as rawSupabase } from "@/integrations/supabase/client";

export type PepFrequency =
  | "daily"
  | "twice_week"
  | "weekly"
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "biannual"
  | "annual"
  | "five_years";

export const PEP_FREQUENCIES: { key: PepFrequency; label: string }[] = [
  { key: "daily", label: "Quotidienne" },
  { key: "twice_week", label: "2 fois par semaine" },
  { key: "weekly", label: "Hebdomadaire" },
  { key: "monthly", label: "Mensuelle" },
  { key: "bimonthly", label: "Tous les 2 mois" },
  { key: "quarterly", label: "Trimestrielle" },
  { key: "biannual", label: "Semestrielle" },
  { key: "annual", label: "Annuelle" },
  { key: "five_years", label: "Tous les 5 ans" },
];

export const FREQ_LABEL: Record<string, string> = Object.fromEntries(
  PEP_FREQUENCIES.map((f) => [f.key, f.label]),
);

export type PepStatus = "todo" | "in_progress" | "done" | "postponed" | "missed";

export const STATUS_META: Record<PepStatus | "late", { label: string; dot: string; badge: string }> = {
  todo: { label: "À faire", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-800" },
  in_progress: { label: "En cours", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-800" },
  done: { label: "Réalisée", dot: "bg-green-600", badge: "bg-green-100 text-green-800" },
  late: { label: "En retard", dot: "bg-red-600", badge: "bg-red-100 text-red-800" },
  postponed: { label: "Reportée", dot: "bg-purple-500", badge: "bg-purple-100 text-purple-800" },
  missed: { label: "Non réalisée", dot: "bg-neutral-700", badge: "bg-neutral-200 text-neutral-800" },
};

export interface PepTask {
  id: string;
  pdv_id: string;
  name: string;
  equipment: string | null;
  frequency: PepFrequency;
  responsable: string | null;
  category: string | null;
  weekend_allowed: boolean;
  requires_photo: boolean;
  active: boolean;
  start_date: string;
  next_due_date: string | null;
  notes: string | null;
}

export interface PepOccurrence {
  id: string;
  pdv_id: string;
  task_id: string;
  due_date: string;
  original_due_date: string;
  status: PepStatus;
  completed_at: string | null;
  completed_by_name: string | null;
  comment: string | null;
  photo_url: string | null;
}

export interface PepHoliday {
  id: string;
  pdv_id: string;
  holiday_date: string;
  label: string;
}

export interface PepPostponement {
  id: string;
  occurrence_id: string;
  task_id: string;
  from_date: string;
  to_date: string;
  reason: string | null;
  postponed_by_name: string | null;
  created_at: string;
}

// ------------------------------- dates --------------------------------------

export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(iso: string, n: number) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export function addMonths(iso: string, n: number) {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}
export function todayISO() {
  return toISO(new Date());
}
export function fmtFR(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
export function isWeekend(iso: string) {
  const day = parseISO(iso).getDay();
  return day === 0 || day === 6;
}
export function mondayOf(iso: string) {
  const d = parseISO(iso);
  const day = d.getDay();
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  return toISO(d);
}
export function datesBetween(start: string, end: string) {
  const out: string[] = [];
  let cur = start;
  for (let i = 0; i < 1000 && cur <= end; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// ---------------------------- accès données ---------------------------------

export async function getPepTasks(): Promise<PepTask[]> {
  const { data, error } = await supabase.from("pep_tasks" as any).select("*").order("name");
  if (error) throw error;
  return (data ?? []) as unknown as PepTask[];
}

export async function getPepHolidays(): Promise<PepHoliday[]> {
  const { data, error } = await supabase
    .from("pep_holidays" as any)
    .select("*")
    .order("holiday_date");
  if (error) throw error;
  return (data ?? []) as unknown as PepHoliday[];
}

export async function getOccurrences(start: string, end: string): Promise<PepOccurrence[]> {
  const { data, error } = await supabase
    .from("pep_occurrences" as any)
    .select("*")
    .gte("due_date", start)
    .lte("due_date", end)
    .order("due_date");
  if (error) throw error;
  return (data ?? []) as unknown as PepOccurrence[];
}

export async function getPostponements(occurrenceIds?: string[]): Promise<PepPostponement[]> {
  let q = supabase.from("pep_postponements" as any).select("*").order("created_at", { ascending: false });
  if (occurrenceIds && occurrenceIds.length) q = q.in("occurrence_id", occurrenceIds);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as PepPostponement[];
}

// ------------------------- planification automatique -------------------------

const PERIOD_MONTHS: Partial<Record<PepFrequency, number>> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  biannual: 6,
  annual: 12,
  five_years: 60,
};

/** Dates « théoriques » d'une tâche entre deux bornes, avant lissage. */
function rawDueDates(task: PepTask, from: string, to: string): string[] {
  const h = hash(task.id);
  const out: string[] = [];
  const start = task.start_date > from ? task.start_date : from;

  if (task.frequency === "daily") return datesBetween(start, to);

  if (task.frequency === "weekly" || task.frequency === "twice_week") {
    const dayA = 1 + (h % 5); // lundi..vendredi
    const dayB = ((dayA + 2) % 5) + 1; // espacé d'au moins 2 jours ouvrés
    const wanted = task.frequency === "weekly" ? [dayA] : [dayA, dayB];
    for (const iso of datesBetween(mondayOf(start), to)) {
      if (iso < start) continue;
      if (wanted.includes(parseISO(iso).getDay())) out.push(iso);
    }
    return out;
  }

  const period = PERIOD_MONTHS[task.frequency] ?? 1;
  // Répartition dans la période : décalage de mois + jour du mois déterministes.
  const monthOffset = h % period;
  const dayOfMonth = 3 + ((h >> 3) % 22); // entre le 3 et le 24
  let anchor = addMonths(task.start_date, monthOffset);
  anchor = `${anchor.slice(0, 7)}-${String(dayOfMonth).padStart(2, "0")}`;
  let guard = 0;
  while (anchor < from && guard++ < 400) anchor = addMonths(anchor, period);
  while (anchor <= to && guard++ < 400) {
    if (anchor >= task.start_date) out.push(anchor);
    anchor = addMonths(anchor, period);
  }
  return out;
}

/**
 * Décale une date vers le prochain jour ouvrable disponible en évitant
 * week-ends, jours fériés et journées déjà chargées.
 */
export function nextWorkday(iso: string, holidays: Set<string>, weekendAllowed = false) {
  let cur = iso;
  for (let i = 0; i < 30; i++) {
    if ((weekendAllowed || !isWeekend(cur)) && !holidays.has(cur)) return cur;
    cur = addDays(cur, 1);
  }
  return cur;
}

const MAX_TASKS_PER_DAY = 4;

function balancedDate(iso: string, holidays: Set<string>, load: Map<string, number>, weekendAllowed: boolean) {
  const first = nextWorkday(iso, holidays, weekendAllowed);
  let best = first;
  let bestLoad = load.get(first) ?? 0;
  if (bestLoad < MAX_TASKS_PER_DAY) return first;
  let cur = first;
  for (let i = 0; i < 10; i++) {
    cur = nextWorkday(addDays(cur, 1), holidays, weekendAllowed);
    const l = load.get(cur) ?? 0;
    if (l < bestLoad) {
      best = cur;
      bestLoad = l;
      if (l === 0) break;
    }
  }
  return best;
}

/**
 * Génère les occurrences manquantes jusqu'à l'horizon donné.
 * Idempotent : la contrainte (task_id, original_due_date) empêche les doublons.
 */
export async function ensurePlanning(horizonDays = 75): Promise<void> {
  const today = todayISO();
  const from = addDays(today, -30);
  const to = addDays(today, horizonDays);

  const [tasks, holidayRows, existing] = await Promise.all([
    getPepTasks(),
    getPepHolidays(),
    getOccurrences(from, to),
  ]);
  const active = tasks.filter((t) => t.active);
  if (!active.length) return;

  const holidays = new Set(holidayRows.map((h) => h.holiday_date));
  const known = new Set(existing.map((o) => `${o.task_id}|${o.original_due_date}`));
  const load = new Map<string, number>();
  existing.forEach((o) => load.set(o.due_date, (load.get(o.due_date) ?? 0) + 1));

  const toInsert: any[] = [];
  // Les quotidiennes d'abord (elles ne bougent jamais), puis les autres lissées.
  const ordered = [...active].sort((a, b) => (a.frequency === "daily" ? -1 : 1) - (b.frequency === "daily" ? -1 : 1));

  for (const task of ordered) {
    for (const raw of rawDueDates(task, today, to)) {
      const key = `${task.id}|${raw}`;
      if (known.has(key)) continue;
      known.add(key);
      const due =
        task.frequency === "daily"
          ? raw
          : balancedDate(raw, holidays, load, task.weekend_allowed);
      load.set(due, (load.get(due) ?? 0) + 1);
      toInsert.push({ task_id: task.id, due_date: due, original_due_date: raw, status: "todo" });
    }
  }

  if (!toInsert.length) return;
  for (let i = 0; i < toInsert.length; i += 200) {
    await supabase.from("pep_occurrences" as any).insert(toInsert.slice(i, i + 200) as any);
  }
}

// ------------------------------- actions ------------------------------------

export async function completeOccurrence(
  occ: PepOccurrence,
  opts: { comment?: string; photoUrl?: string | null; userName?: string | null },
) {
  const { data: auth } = await rawSupabase.auth.getUser();
  const { error } = await supabase
    .from("pep_occurrences" as any)
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: auth?.user?.id ?? null,
      completed_by_name: opts.userName ?? auth?.user?.email ?? null,
      comment: opts.comment ?? null,
      photo_url: opts.photoUrl ?? null,
    } as any)
    .eq("id", occ.id);
  if (error) throw error;
}

export async function setOccurrenceStatus(id: string, status: PepStatus) {
  const { error } = await supabase.from("pep_occurrences" as any).update({ status } as any).eq("id", id);
  if (error) throw error;
}

export async function postponeOccurrence(
  occ: PepOccurrence,
  newDate: string,
  reason: string,
  userName?: string | null,
) {
  const { data: auth } = await rawSupabase.auth.getUser();
  const { error } = await supabase
    .from("pep_occurrences" as any)
    .update({ due_date: newDate, status: "postponed" } as any)
    .eq("id", occ.id);
  if (error) throw error;
  const { error: e2 } = await supabase.from("pep_postponements" as any).insert({
    occurrence_id: occ.id,
    task_id: occ.task_id,
    from_date: occ.due_date,
    to_date: newDate,
    reason: reason || null,
    postponed_by: auth?.user?.id ?? null,
    postponed_by_name: userName ?? auth?.user?.email ?? null,
  } as any);
  if (e2) throw e2;
}

export async function saveTask(task: Partial<PepTask> & { name: string; frequency: PepFrequency }) {
  const payload: any = {
    name: task.name,
    equipment: task.equipment ?? null,
    frequency: task.frequency,
    responsable: task.responsable ?? null,
    category: task.category ?? null,
    weekend_allowed: !!task.weekend_allowed,
    requires_photo: !!task.requires_photo,
    active: task.active ?? true,
    start_date: task.start_date ?? todayISO(),
    next_due_date: task.next_due_date ?? null,
    notes: task.notes ?? null,
  };
  if (task.id) {
    const { error } = await supabase.from("pep_tasks" as any).update(payload).eq("id", task.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("pep_tasks" as any).insert(payload);
    if (error) throw error;
  }
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("pep_tasks" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function saveHoliday(h: { id?: string; holiday_date: string; label: string }) {
  if (h.id) {
    const { error } = await supabase
      .from("pep_holidays" as any)
      .update({ holiday_date: h.holiday_date, label: h.label })
      .eq("id", h.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("pep_holidays" as any)
      .insert({ holiday_date: h.holiday_date, label: h.label });
    if (error) throw error;
  }
}

export async function deleteHoliday(id: string) {
  const { error } = await supabase.from("pep_holidays" as any).delete().eq("id", id);
  if (error) throw error;
}

// ------------------------------ helpers UI ----------------------------------

export function effectiveStatus(occ: PepOccurrence, today = todayISO()): PepStatus | "late" {
  if (occ.status === "done" || occ.status === "missed") return occ.status;
  if (occ.due_date < today) return "late";
  return occ.status === "postponed" ? "todo" : occ.status;
}

export interface TodaySummary {
  todo: number;
  late: number;
  done: number;
}

export async function getTodaySummary(): Promise<TodaySummary> {
  const today = todayISO();
  const occ = await getOccurrences(addDays(today, -120), today);
  let todo = 0,
    late = 0,
    done = 0;
  for (const o of occ) {
    const s = effectiveStatus(o, today);
    if (s === "done") {
      if (o.due_date === today) done++;
    } else if (s === "late") late++;
    else if (o.due_date === today) todo++;
  }
  return { todo, late, done };
}

/** Compresse une image en dataURL JPEG (max 900px) pour le justificatif. */
export function fileToCompressedDataUrl(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image invalide"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponible"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
