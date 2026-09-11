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

export const POSTES = ["Service", "Comptoir", "Passe", "Ménage", "Agent de sécurité"] as const;

export type StaffLevel = "agent" | "manager";

export interface HrAgent {
  id: string;
  pdv_id: string;
  full_name: string;
  active: boolean;
  poste: string | null;
  hire_date: string | null;
  staff_level: StaffLevel;
}

export interface HrSchedule {
  id: string;
  pdv_id: string;
  agent_id: string;
  work_date: string;
  day_type: DayType;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
}

export interface HrHoliday {
  id: string;
  holiday_date: string;
  label: string;
}

export type BalanceKind = "conge_credit" | "conge_debit" | "recup_credit" | "recup_debit";

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
    .select("id, pdv_id, full_name, active, poste, hire_date, staff_level")
    .order("full_name");
  if (pdvIds && pdvIds.length > 0) q = q.in("pdv_id", pdvIds);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as HrAgent[];
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
    .select("id, pdv_id, agent_id, work_date, day_type, start_time, end_time, notes")
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
  notes?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("hr_schedules" as any)
    .upsert(
      {
        ...row,
        start_time: row.day_type === "travail" ? row.start_time || null : null,
        end_time: row.day_type === "travail" ? row.end_time || null : null,
      },
      { onConflict: "agent_id,work_date" },
    );
  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from("hr_schedules" as any).delete().eq("id", id);
  if (error) throw error;
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
