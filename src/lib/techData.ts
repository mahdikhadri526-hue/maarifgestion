// ============================================================================
// Suivi Technique — signalements de pannes / problèmes matériels issus de
// l'Agenda PEP. Table dédiée `tech_issues`, cloisonnée par PDV.
// ============================================================================
import { supabase } from "@/lib/db";
import { parsePhotos, serializePhotos } from "@/lib/pepData";

export type TechPriority = "critique" | "urgente" | "normale";
export type TechStatus = "a_traiter" | "en_cours" | "repare" | "cloture";

export const TECH_PRIORITIES: { key: TechPriority; label: string; className: string }[] = [
  { key: "critique", label: "Critique", className: "bg-destructive text-destructive-foreground" },
  { key: "urgente", label: "Urgente", className: "bg-amber-500 text-white" },
  { key: "normale", label: "Normale", className: "bg-muted text-foreground" },
];

export const TECH_STATUSES: { key: TechStatus; label: string; dot: string }[] = [
  { key: "a_traiter", label: "À traiter", dot: "bg-destructive" },
  { key: "en_cours", label: "En cours", dot: "bg-amber-500" },
  { key: "repare", label: "Réparé", dot: "bg-emerald-500" },
  { key: "cloture", label: "Clôturé", dot: "bg-muted-foreground" },
];

export const TECH_STATUS_ORDER: TechStatus[] = ["a_traiter", "en_cours", "repare", "cloture"];

export interface TechIssue {
  id: string;
  pdv_id: string;
  equipment: string;
  location: string | null;
  problem: string;
  photo_url: string | null;
  reported_by: string;
  reported_by_user: string | null;
  priority: TechPriority;
  reported_at: string;
  status: TechStatus;
  assigned_to: string | null;
  deadline: string | null;
  tech_notes: string | null;
  taken_at: string | null;
  repaired_at: string | null;
  closed_at: string | null;
  source_task_id: string | null;
  source_occurrence_id: string | null;
  created_at: string;
  updated_at: string;
}

const table = () => supabase.from("tech_issues" as any) as any;

export async function getTechIssues(): Promise<TechIssue[]> {
  const { data, error } = await table().select("*").order("reported_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TechIssue[];
}

export interface NewTechIssue {
  equipment: string;
  location?: string | null;
  problem: string;
  photoUrls?: string[];
  reported_by: string;
  reported_by_user?: string | null;
  priority: TechPriority;
  source_task_id?: string | null;
  source_occurrence_id?: string | null;
}

export async function reportTechIssue(input: NewTechIssue): Promise<TechIssue> {
  const payload = {
    equipment: input.equipment.trim(),
    location: input.location?.trim() || null,
    problem: input.problem.trim(),
    photo_url: serializePhotos(input.photoUrls ?? []),
    reported_by: input.reported_by.trim(),
    reported_by_user: input.reported_by_user ?? null,
    priority: input.priority,
    reported_at: new Date().toISOString(),
    status: "a_traiter",
    source_task_id: input.source_task_id ?? null,
    source_occurrence_id: input.source_occurrence_id ?? null,
  };
  const { data, error } = await table().insert(payload).select("*").single();
  if (error) throw error;
  return data as TechIssue;
}

export async function updateTechIssue(
  id: string,
  patch: Partial<Pick<TechIssue, "status" | "assigned_to" | "deadline" | "tech_notes" | "priority">>,
): Promise<void> {
  const now = new Date().toISOString();
  const p: Record<string, any> = { ...patch };
  if (patch.status === "en_cours") p.taken_at = now;
  if (patch.status === "repare") p.repaired_at = now;
  if (patch.status === "cloture") p.closed_at = now;
  const { error } = await table().update(p).eq("id", id);
  if (error) throw error;
}

export async function deleteTechIssue(id: string): Promise<void> {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
}

export function techPhotos(issue: TechIssue): string[] {
  return parsePhotos(issue.photo_url);
}

export function fmtDateTimeFR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Deadline dépassée pour un signalement non réparé/clôturé. */
export function isOverdue(issue: TechIssue, todayISO: string): boolean {
  return !!issue.deadline && issue.deadline < todayISO && (issue.status === "a_traiter" || issue.status === "en_cours");
}
