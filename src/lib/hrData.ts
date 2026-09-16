import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------ Types & libellés */

export type DayType = "travail" | "repos" | "conge" | "recuperation";

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  travail: "Travail",
  repos: "Repos",
  conge: "Congé",
  recuperation: "Récupération",
};

export const DAY_TYPES: DayType[] = ["travail", "repos", "conge", "recuperation"];

export const POSTES = ["Service", "Comptoir", "Caissier", "Passe", "Ménage", "Agent de sécurité"] as const;

export type StaffLevel = "agent" | "manager" | "direction";
export type WorkShift = "matin" | "apres_midi";

export interface HrAgent {
  id: string;
  pdv_id: string;
  full_name: string;
  active: boolean;
  poste: string | null;
  hire_date: string | null;
  staff_level: StaffLevel;
  /** true = l'agent peut travailler sur tous les PDV. */
  multi_pdv?: boolean;
}

export interface HrSchedule {
  id: string;
  pdv_id: string;
  agent_id: string;
  work_date: string;
  day_type: DayType;
  start_time: string | null;
  end_time: string | null;
  work_shift: WorkShift | null;
  notes: string | null;
}

export interface HrHoliday {
  id: string;
  holiday_date: string;
  label: string;
}

export type BalanceKind =
  | "conge_credit"
  | "conge_debit"
  | "recup_credit"
  | "recup_debit"
  /** Solde restant repris à la date de démarrage de l'application (point de départ du calcul). */
  | "conge_ouverture"
  | "recup_ouverture";

export interface HrBalanceEntry {
  id: string;
  pdv_id: string;
  agent_id: string;
  kind: BalanceKind;
  days: number;
  entry_date: string;
  reason: string | null;
}

/* ------------------------------------------------------------ Dates utilitaires */

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** Lundi de la semaine contenant la date. */
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return isoDate(d);
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatFr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export const DOW_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/* ------------------------------------------------------------ Agents */

export async function getHrAgents(pdvIds: string[] | null): Promise<HrAgent[]> {
  let q = supabase
    .from("attendance_agents" as any)
    .select("id, pdv_id, full_name, active, poste, hire_date, staff_level, multi_pdv")
    .order("full_name");
  if (pdvIds && pdvIds.length > 0) q = q.or(`pdv_id.in.(${pdvIds.join(",")}),multi_pdv.eq.true`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as HrAgent[];
}

export async function createHrAgent(row: {
  pdv_id: string;
  full_name: string;
  poste?: string | null;
  hire_date?: string | null;
  staff_level?: StaffLevel;
  matricule?: string | null;
  multi_pdv?: boolean;
}): Promise<void> {
  const { data, error } = await supabase
    .from("attendance_agents" as any)
    .insert({
      pdv_id: row.pdv_id,
      full_name: row.full_name.trim(),
      poste: row.poste || null,
      hire_date: row.hire_date || null,
      staff_level: row.staff_level ?? "agent",
      matricule: row.matricule?.trim() || null,
      multi_pdv: row.multi_pdv ?? false,
      descriptors: [],
      active: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  // Alimente aussi la table « planning » (liste des agents par PDV)
  const { error: pErr } = await supabase.from("planning" as any).insert({
    pdv_id: row.pdv_id,
    agent_id: (data as any)?.id ?? null,
    full_name: row.full_name.trim(),
    poste: row.poste || null,
    staff_level: row.staff_level ?? "agent",
    matricule: row.matricule?.trim() || null,
    hire_date: row.hire_date || null,
    multi_pdv: row.multi_pdv ?? false,
    active: true,
  });
  if (pErr) throw pErr;
}

export async function deleteHrAgent(id: string): Promise<void> {
  const { error } = await supabase.from("attendance_agents" as any).delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------ Table Planning */

export interface PlanningRow {
  id: string;
  pdv_id: string;
  agent_id: string | null;
  full_name: string;
  matricule: string | null;
  hire_date: string | null;
  poste: string | null;
  staff_level: StaffLevel;
  active: boolean;
}

export async function getPlanningRows(pdvIds: string[] | null): Promise<PlanningRow[]> {
  let q = supabase
    .from("planning" as any)
    .select("id, pdv_id, agent_id, full_name, matricule, hire_date, poste, staff_level, active")
    .order("full_name");
  if (pdvIds && pdvIds.length > 0) q = q.in("pdv_id", pdvIds);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as PlanningRow[];
}

export async function updateAgentHr(
  id: string,
  patch: { poste?: string | null; hire_date?: string | null; staff_level?: StaffLevel },
): Promise<void> {
  const { error } = await supabase.from("attendance_agents" as any).update(patch).eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------ Planning */

export async function getSchedules(
  pdvIds: string[],
  from: string,
  to: string,
): Promise<HrSchedule[]> {
  const { data, error } = await supabase
    .from("hr_schedules" as any)
    .select("id, pdv_id, agent_id, work_date, day_type, start_time, end_time, work_shift, notes")
    .in("pdv_id", pdvIds)
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date");
  if (error) throw error;
  return (data ?? []) as unknown as HrSchedule[];
}

export async function saveSchedule(row: {
  pdv_id: string;
  agent_id: string;
  work_date: string;
  day_type: DayType;
  start_time?: string | null;
  end_time?: string | null;
  work_shift?: WorkShift | null;
  notes?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("hr_schedules" as any)
    .upsert(
      {
        ...row,
        start_time: row.day_type === "travail" ? row.start_time || null : null,
        end_time: row.day_type === "travail" ? row.end_time || null : null,
        work_shift: row.day_type === "travail" ? row.work_shift || null : null,
      },
      { onConflict: "agent_id,work_date" },
    );
  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from("hr_schedules" as any).delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------ Horaires de shift par PDV */

export interface PdvShiftTime {
  id: string;
  pdv_id: string;
  shift: WorkShift;
  /** 1 = lundi … 7 = dimanche */
  day_of_week: number;
  start_time: string;
  end_time: string | null;
}

export const SHIFT_LABELS: Record<WorkShift, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
};

export const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 7, label: "Dimanche" },
];

/** ISO : lundi = 1 … dimanche = 7, à partir d'une date "YYYY-MM-DD". */
export function isoDayOfWeek(date: string): number {
  const d = new Date(`${date}T00:00:00`).getDay();
  return d === 0 ? 7 : d;
}

export async function getShiftTimes(): Promise<PdvShiftTime[]> {
  const { data, error } = await supabase
    .from("pdv_shift_times" as any)
    .select("id, pdv_id, shift, day_of_week, start_time, end_time");
  if (error) throw error;
  return (data ?? []) as unknown as PdvShiftTime[];
}

export async function saveShiftTime(row: {
  pdv_id: string;
  shift: WorkShift;
  day_of_week: number;
  start_time: string;
  end_time?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("pdv_shift_times" as any)
    .upsert({ ...row, end_time: row.end_time || null }, { onConflict: "pdv_id,shift,day_of_week" });
  if (error) throw error;
}

/** Clé `${pdv_id}|${shift}|${day_of_week}` → heure de début. */
export function shiftStartMap(rows: PdvShiftTime[]): Record<string, string> {
  const out: Record<string, string> = {};
  rows.forEach((r) => {
    out[`${r.pdv_id}|${r.shift}|${r.day_of_week}`] = r.start_time;
  });
  return out;
}

/* ------------------------------------------------------------ Jours fériés */

export async function getHolidays(from?: string, to?: string): Promise<HrHoliday[]> {
  let q = supabase.from("hr_holidays" as any).select("id, holiday_date, label").order("holiday_date");
  if (from) q = q.gte("holiday_date", from);
  if (to) q = q.lte("holiday_date", to);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as HrHoliday[];
}

export async function addHoliday(holiday_date: string, label: string): Promise<void> {
  const { error } = await supabase
    .from("hr_holidays" as any)
    .upsert({ holiday_date, label }, { onConflict: "holiday_date" });
  if (error) throw error;
}

export async function deleteHoliday(id: string): Promise<void> {
  const { error } = await supabase.from("hr_holidays" as any).delete().eq("id", id);
  if (error) throw error;
}

/** Jours fériés nationaux marocains à date fixe (grégorienne). */
export function fixedMoroccanHolidays(year: number): { holiday_date: string; label: string }[] {
  return [
    { md: "01-01", label: "Nouvel An" },
    { md: "01-11", label: "Manifeste de l'Indépendance" },
    { md: "01-14", label: "Nouvel An amazigh" },
    { md: "05-01", label: "Fête du Travail" },
    { md: "07-30", label: "Fête du Trône" },
    { md: "08-14", label: "Oued Eddahab" },
    { md: "08-20", label: "Révolution du Roi et du Peuple" },
    { md: "08-21", label: "Fête de la Jeunesse" },
    { md: "11-06", label: "Marche Verte" },
    { md: "11-18", label: "Fête de l'Indépendance" },
  ].map((h) => ({ holiday_date: `${year}-${h.md}`, label: h.label }));
}

/* ------------------------------------------------------------ Soldes */

export async function getBalanceEntries(pdvIds: string[]): Promise<HrBalanceEntry[]> {
  const { data, error } = await supabase
    .from("hr_balance_entries" as any)
    .select("id, pdv_id, agent_id, kind, days, entry_date, reason")
    .in("pdv_id", pdvIds)
    .order("entry_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as HrBalanceEntry[];
}

export async function addBalanceEntry(row: {
  pdv_id: string;
  agent_id: string;
  kind: BalanceKind;
  days: number;
  entry_date: string;
  reason?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("hr_balance_entries" as any).insert(row);
  if (error) throw error;
}

export async function deleteBalanceEntry(id: string): Promise<void> {
  const { error } = await supabase.from("hr_balance_entries" as any).delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------ Pointages (lecture RH) */

export async function getPunchesRange(pdvIds: string[], from: string, to: string) {
  const { data, error } = await supabase
    .from("attendance_punches" as any)
    .select("id, pdv_id, agent_id, agent_name, punch_type, punched_at, punch_date, match_score, method, device_label")
    .in("pdv_id", pdvIds)
    .gte("punch_date", from)
    .lte("punch_date", to)
    .order("punched_at");
  if (error) throw error;
  return (data ?? []) as any[];
}
