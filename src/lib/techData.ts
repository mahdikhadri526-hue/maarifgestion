// ============================================================================
// Suivi Technique — signalements de pannes / problèmes matériels issus de
// l'Agenda PEP. Table dédiée `tech_issues`, cloisonnée par PDV.
// Historique automatique dans `tech_issue_events` (trigger côté base).
// ============================================================================
import { supabase } from "@/lib/db";
import { supabase as rawSupabase } from "@/integrations/supabase/client";
import { requireCurrentPdvId } from "@/lib/pdvStore";
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

/** Nombre de jours avant la deadline à partir duquel une alerte est affichée. */
export const TECH_ALERT_DAYS_BEFORE = 2;
/** Fenêtre (jours) et seuil de signalements pour détecter un problème récurrent. */
export const TECH_RECURRENT_WINDOW_DAYS = 90;
export const TECH_RECURRENT_THRESHOLD = 3;

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
  // Contrôle après réparation
  repair_photo_url: string | null;
  action_done: string | null;
  tech_comment: string | null;
  tech_validated_by: string | null;
  tech_validated_at: string | null;
  manager_validated_by: string | null;
  manager_validated_at: string | null;
  manager_comment: string | null;
}

export type TechEventType =
  | "signale" | "statut" | "deadline" | "responsable" | "priorite"
  | "validation_tech" | "validation_manager" | "refus_manager" | "note";

export interface TechEvent {
  id: string;
  pdv_id: string;
  issue_id: string;
  event_type: TechEventType;
  actor_name: string | null;
  actor_user: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

const table = () => supabase.from("tech_issues" as any) as any;

export async function getTechIssues(): Promise<TechIssue[]> {
  const { data, error } = await table().select("*").order("reported_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TechIssue[];
}

export async function getTechEvents(issueId?: string): Promise<TechEvent[]> {
  let q = (rawSupabase.from("tech_issue_events" as any) as any)
    .select("*")
    .eq("pdv_id", requireCurrentPdvId())
    .order("created_at", { ascending: false })
    .limit(500);
  if (issueId) q = q.eq("issue_id", issueId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TechEvent[];
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

/** Validation du responsable technique : réparation terminée. */
export async function validateRepair(
  id: string,
  input: { validated_by: string; action_done: string; tech_comment?: string | null; repairPhotoUrls?: string[]; repaired_at?: string | null },
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await table()
    .update({
      status: "repare",
      action_done: input.action_done.trim(),
      tech_comment: input.tech_comment?.trim() || null,
      repair_photo_url: serializePhotos(input.repairPhotoUrls ?? []),
      tech_validated_by: input.validated_by.trim(),
      tech_validated_at: now,
      repaired_at: input.repaired_at || now,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Validation (ou refus) du manager : le matériel fonctionne correctement → clôture. */
export async function managerValidate(id: string, managerName: string, ok: boolean, comment?: string | null): Promise<void> {
  const { error } = await rawSupabase.rpc("tech_manager_validate" as any, {
    _issue_id: id,
    _manager_name: managerName,
    _comment: comment ?? null,
    _ok: ok,
  } as any);
  if (error) throw error;
}

export async function deleteTechIssue(id: string): Promise<void> {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
}

export function techPhotos(issue: TechIssue): string[] {
  return parsePhotos(issue.photo_url);
}

export function techRepairPhotos(issue: TechIssue): string[] {
  return parsePhotos(issue.repair_photo_url);
}

export function fmtDateTimeFR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const isOpen = (i: TechIssue) => i.status === "a_traiter" || i.status === "en_cours";

/** Deadline dépassée pour un signalement non réparé/clôturé. */
export function isOverdue(issue: TechIssue, todayISO: string): boolean {
  return !!issue.deadline && issue.deadline < todayISO && isOpen(issue);
}

/** Jours restants avant la deadline (négatif = retard). */
export function daysToDeadline(issue: TechIssue, todayISO: string): number | null {
  if (!issue.deadline) return null;
  const a = new Date(issue.deadline + "T00:00:00").getTime();
  const b = new Date(todayISO + "T00:00:00").getTime();
  return Math.round((a - b) / 86_400_000);
}

/** Alerte « deadline proche » (J-2 à J) pour un dossier encore ouvert. */
export function isDeadlineSoon(issue: TechIssue, todayISO: string): boolean {
  const d = daysToDeadline(issue, todayISO);
  return d !== null && d >= 0 && d <= TECH_ALERT_DAYS_BEFORE && isOpen(issue);
}

/** Réparation validée après la deadline → retard du responsable technique. */
export function isTechLate(issue: TechIssue): boolean {
  if (!issue.deadline || !issue.tech_validated_at) return false;
  return issue.tech_validated_at.slice(0, 10) > issue.deadline;
}

/** Réparé mais en attente de la validation du manager. */
export function awaitingManager(issue: TechIssue): boolean {
  return issue.status === "repare" && !!issue.tech_validated_at && !issue.manager_validated_at;
}

const normEq = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Matériels signalés ≥ 3 fois sur 90 jours → problème récurrent. */
export function recurringEquipments(issues: TechIssue[], nowIso = new Date().toISOString()): Map<string, TechIssue[]> {
  const since = new Date(new Date(nowIso).getTime() - TECH_RECURRENT_WINDOW_DAYS * 86_400_000).toISOString();
  const groups = new Map<string, TechIssue[]>();
  for (const i of issues) {
    if (i.reported_at < since) continue;
    const k = normEq(i.equipment);
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  for (const [k, v] of groups) if (v.length < TECH_RECURRENT_THRESHOLD) groups.delete(k);
  return groups;
}

export function isRecurring(issue: TechIssue, groups: Map<string, TechIssue[]>): boolean {
  return groups.has(normEq(issue.equipment));
}

export const TECH_EVENT_LABELS: Record<TechEventType, string> = {
  signale: "Signalement",
  statut: "Changement de statut",
  deadline: "Deadline",
  responsable: "Responsable technique",
  priorite: "Priorité",
  validation_tech: "Validation technique",
  validation_manager: "Validation manager",
  refus_manager: "Refus manager (matériel non conforme)",
  note: "Note",
};

export function describeEvent(e: TechEvent): string {
  const d = e.details ?? {};
  const st = (k: string) => TECH_STATUSES.find((s) => s.key === k)?.label ?? k ?? "—";
  const pr = (k: string) => TECH_PRIORITIES.find((p) => p.key === k)?.label ?? k ?? "—";
  switch (e.event_type) {
    case "signale": return `${pr(d.priority)} — ${d.problem ?? ""}`;
    case "statut": return `${st(d.from)} → ${st(d.to)}`;
    case "deadline": return `${d.from ?? "—"} → ${d.to ?? "—"}`;
    case "responsable": return `${d.from ?? "—"} → ${d.to ?? "—"}`;
    case "priorite": return `${pr(d.from)} → ${pr(d.to)}`;
    case "validation_tech": return `${d.action ?? ""}${d.comment ? ` — ${d.comment}` : ""}${d.late ? " (après deadline)" : ""}`;
    case "validation_manager": return d.comment ? String(d.comment) : "Matériel vérifié : fonctionne correctement";
    case "refus_manager": return d.comment ? String(d.comment) : "Le matériel ne fonctionne pas correctement";
    case "note": return [d.tech_notes, d.tech_comment].filter(Boolean).join(" · ");
    default: return "";
  }
}
