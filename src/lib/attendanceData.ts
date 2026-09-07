import { supabase } from "@/integrations/supabase/client";

export type PunchType = "entree" | "pause" | "retour" | "sortie";

export const PUNCH_LABELS: Record<PunchType, string> = {
  entree: "Entrée",
  pause: "Départ pause",
  retour: "Retour pause",
  sortie: "Sortie",
};

/** Enchaînement attendu d'une journée. */
export const PUNCH_ORDER: PunchType[] = ["entree", "pause", "retour", "sortie"];

export function nextPunchType(done: PunchType[]): PunchType | null {
  for (const t of PUNCH_ORDER) if (!done.includes(t)) return t;
  return null;
}

export interface AttendanceAgent {
  id: string;
  pdv_id: string;
  full_name: string;
  descriptors: number[][];
  active: boolean;
  notes: string | null;
}

export interface AttendancePunch {
  id: string;
  pdv_id: string;
  agent_id: string | null;
  agent_name: string;
  punch_type: PunchType;
  punched_at: string;
  punch_date: string;
  match_score: number | null;
  method: string;
  device_label: string | null;
}

export async function getAgents(pdvId: string): Promise<AttendanceAgent[]> {
  const { data, error } = await supabase
    .from("attendance_agents" as any)
    .select("id, pdv_id, full_name, descriptors, active, notes")
    .eq("pdv_id", pdvId)
    .order("full_name");
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    descriptors: Array.isArray(r.descriptors) ? r.descriptors : [],
  })) as AttendanceAgent[];
}

export async function createAgent(
  pdvId: string,
  fullName: string,
  descriptors: number[][],
): Promise<void> {
  const { error } = await supabase.from("attendance_agents" as any).insert({
    pdv_id: pdvId,
    full_name: fullName.trim(),
    descriptors,
  });
  if (error) throw error;
}

export async function updateAgentDescriptors(id: string, descriptors: number[][]): Promise<void> {
  const { error } = await supabase
    .from("attendance_agents" as any)
    .update({ descriptors })
    .eq("id", id);
  if (error) throw error;
}

export async function setAgentActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("attendance_agents" as any).update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase.from("attendance_agents" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function getPunches(
  pdvId: string,
  fromDate: string,
  toDate: string,
): Promise<AttendancePunch[]> {
  const { data, error } = await supabase
    .from("attendance_punches" as any)
    .select("id, pdv_id, agent_id, agent_name, punch_type, punched_at, punch_date, match_score, method, device_label")
    .eq("pdv_id", pdvId)
    .gte("punch_date", fromDate)
    .lte("punch_date", toDate)
    .order("punched_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AttendancePunch[];
}

export async function addPunch(params: {
  pdvId: string;
  agentId: string;
  agentName: string;
  punchType: PunchType;
  matchScore?: number | null;
}): Promise<void> {
  const now = new Date();
  const punchDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const { error } = await supabase.from("attendance_punches" as any).insert({
    pdv_id: params.pdvId,
    agent_id: params.agentId,
    agent_name: params.agentName,
    punch_type: params.punchType,
    punched_at: now.toISOString(),
    punch_date: punchDate,
    match_score: params.matchScore ?? null,
    method: "face",
    device_label: navigator.userAgent.slice(0, 120),
  });
  if (error) throw error;
}

export async function deletePunch(id: string): Promise<void> {
  const { error } = await supabase.from("attendance_punches" as any).delete().eq("id", id);
  if (error) throw error;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Heures travaillées (entrée→pause + retour→sortie), en heures décimales. */
export function workedHours(punches: AttendancePunch[]): number {
  const at = (t: PunchType) => {
    const p = punches.find((x) => x.punch_type === t);
    return p ? new Date(p.punched_at).getTime() : null;
  };
  const e = at("entree");
  const p = at("pause");
  const r = at("retour");
  const s = at("sortie");
  let ms = 0;
  if (e && p) ms += p - e;
  else if (e && s && !p) ms += s - e;
  if (r && s) ms += s - r;
  return Math.max(0, ms) / 3_600_000;
}
