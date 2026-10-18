import type { AttendancePunch, PunchType } from "@/lib/attendanceData";
import { isoDayOfWeek, weekStart } from "@/lib/hrData";
import type { DayType, HrBalanceEntry, HrSchedule } from "@/lib/hrData";

/* ------------------------------------------------------------ Heures */

/** Date locale au format YYYY-MM-DD. */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2})[:hH.](\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function punchAt(punches: AttendancePunch[], type: PunchType): number | null {
  const p = punches.find((x) => x.punch_type === type);
  return p ? new Date(p.punched_at).getTime() : null;
}

export const OVERTIME_THRESHOLD_HOURS = 8;
export const PAUSE_ALLOWED_MINUTES = 30;

export interface DayResult {
  date: string;
  agentId: string;
  agentName: string;
  pdvId: string;
  dayType: DayType | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  isHoliday: boolean;
  holidayLabel: string | null;
  entree: string | null;
  pauseStart: string | null;
  pauseEnd: string | null;
  sortie: string | null;
  pauseMinutes: number;
  workedHours: number;
  overtimeHours: number;
  lateMinutes: number;
  /** Retard au retour de pause au-delà de 30 minutes. */
  pauseLateMinutes: number;
  present: boolean;
  absence: boolean;
  /** Types de pointage saisis/modifiés manuellement par un manager. */
  manualTypes: PunchType[];
}

function hhmm(ts: number | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Calcule la journée d'un agent : heures travaillées (sortie − entrée − pause),
 * heures supplémentaires au-delà de 8 h, retard vs planning et absence.
 */
export function computeDay(params: {
  date: string;
  agentId: string;
  agentName: string;
  pdvId: string;
  punches: AttendancePunch[];
  schedule: HrSchedule | null;
  holidayLabel?: string | null;
  /** Heures de début de shift : clé `${pdv_id}|${role}|${shift}|${jour ISO}` → "HH:MM". */
  shiftStarts?: Record<string, string>;
  /** Rôle utilisé pour les horaires de shift : "manager" (défaut) ou "caissier". */
  shiftRole?: "manager" | "caissier";
  /** Date du jour (YYYY-MM-DD) pour ne marquer l'absence que sur les journées passées. */
  today?: string;
}): DayResult {
  const { date, agentId, agentName, pdvId, punches, schedule } = params;
  const dayType = (schedule?.day_type as DayType | undefined) ?? null;

  const e = punchAt(punches, "entree");
  const ps = punchAt(punches, "pause");
  const pe = punchAt(punches, "retour");
  const s = punchAt(punches, "sortie");

  // Service de nuit : une sortie (ou un retour de pause) postérieure à minuit est
  // rattachée à la journée de début — on ajoute 24 h quand l'heure est antérieure à l'entrée.
  const DAY_MS = 24 * 3600 * 1000;
  const adj = (t: number | null, ref: number | null) =>
    t !== null && ref !== null && t < ref ? t + DAY_MS : t;
  const psA = adj(ps, e);
  const peA = adj(adj(pe, e), psA);
  const sA = adj(adj(s, e), peA ?? psA);

  const pauseMs = psA && peA && peA > psA ? peA - psA : 0;
  const pauseLateMinutes =
    psA && peA ? Math.max(0, Math.round((peA - psA) / 60000) - PAUSE_ALLOWED_MINUTES) : 0;
  let workedMs = 0;
  if (e && sA && sA > e) workedMs = sA - e - pauseMs;
  else if (e && psA && psA > e) workedMs = psA - e;
  const worked = Math.max(0, workedMs) / 3_600_000;

  let lateMinutes = 0;
  const shiftRole = params.shiftRole ?? "manager";
  const shiftStart =
    schedule?.work_shift && params.shiftStarts
      ? params.shiftStarts[
          `${schedule.pdv_id ?? pdvId}|${shiftRole}|${schedule.work_shift}|${isoDayOfWeek(date)}`
        ] ??
        params.shiftStarts[
          `${schedule.pdv_id ?? pdvId}|manager|${schedule.work_shift}|${isoDayOfWeek(date)}`
        ] ??
        null
      : null;
  const plannedStart = schedule?.start_time ?? shiftStart;
  const pm = toMinutes(plannedStart);
  if (dayType === "travail" && pm !== null && e) {
    const d = new Date(e);
    const real = d.getHours() * 60 + d.getMinutes();
    lateMinutes = Math.max(0, real - pm);
  }

  const present = Boolean(e);
  const isHoliday = Boolean(params.holidayLabel);
  // Absence automatique uniquement pour une journée passée : on attend la fin du jour en cours.
  const todayIso = params.today ?? isoLocal(new Date());
  const isPast = date < todayIso;
  const absence = dayType === "travail" && !present && !isHoliday && isPast;

  return {
    date,
    agentId,
    agentName,
    pdvId,
    dayType,
    plannedStart,
    plannedEnd: schedule?.end_time ?? null,
    isHoliday,
    holidayLabel: params.holidayLabel ?? null,
    entree: hhmm(e),
    pauseStart: hhmm(ps),
    pauseEnd: hhmm(pe),
    sortie: hhmm(s),
    pauseMinutes: Math.round(pauseMs / 60000),
    workedHours: Number(worked.toFixed(2)),
    overtimeHours: Number(Math.max(0, worked - OVERTIME_THRESHOLD_HOURS).toFixed(2)),
    lateMinutes,
    pauseLateMinutes,
    present,
    absence,
    manualTypes: punches.filter((x) => x.method === "manual").map((x) => x.punch_type as PunchType),
  };
}

/* ------------------------------------------------------------ Congés (loi marocaine) */

/**
 * Droit annuel marocain : 1,5 jour ouvrable par mois travaillé (18 j/an),
 * majoré de 1,5 jour par tranche de 5 ans d'ancienneté, plafonné à 30 jours.
 */
export function annualLeaveRight(seniorityYears: number): number {
  return Math.min(30, 18 + 1.5 * Math.floor(seniorityYears / 5));
}

/** Congés acquis depuis la date d'embauche jusqu'à la date de référence. */
export function accruedLeaveDays(hireDate: string | null, at: Date = new Date()): number {
  if (!hireDate) return 0;
  const hire = new Date(`${hireDate}T12:00:00`);
  if (Number.isNaN(hire.getTime()) || hire > at) return 0;
  let total = 0;
  const cursor = new Date(hire);
  while (true) {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    if (next > at) break;
    const seniorityYears = Math.floor(
      (cursor.getTime() - hire.getTime()) / (365.25 * 24 * 3600 * 1000),
    );
    total += annualLeaveRight(seniorityYears) / 12;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return Number(total.toFixed(2));
}

export interface AgentBalance {
  accrued: number;
  leaveTaken: number;
  leaveRemaining: number;
  recupCredit: number;
  recupTaken: number;
  recupRemaining: number;
}

/**
 * Solde de congés et de récupération.
 * Les journées « Congé » et « Récupération » du planning sont déduites automatiquement.
 */
export function computeBalance(params: {
  hireDate: string | null;
  schedules: HrSchedule[];
  entries: HrBalanceEntry[];
  /** Dates de jours fériés (YYYY-MM-DD) : un jour férié planifié « Travail » crédite 1 jour de récupération. */
  holidays?: string[];
  /** Dates (YYYY-MM-DD) où l'agent a réellement pointé : le crédit férié n'est accordé que sur pointage réel. */
  punchedDates?: string[];
  at?: Date;
}): AgentBalance {
  const at = params.at ?? new Date();

  // Solde de départ (« ce qui reste » à la date de démarrage de l'application).
  const lastOpening = (kind: "conge_ouverture" | "recup_ouverture") =>
    params.entries
      .filter((e) => e.kind === kind)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
      .at(-1);
  const leaveOpening = lastOpening("conge_ouverture");
  const recupOpening = lastOpening("recup_ouverture");

  // Tout ce qui précède la date de reprise est déjà inclus dans le solde de départ.
  const afterLeave = (iso: string) => !leaveOpening || iso > leaveOpening.entry_date;
  const afterRecup = (iso: string) => !recupOpening || iso > recupOpening.entry_date;

  const accruedBase = leaveOpening
    ? Number(leaveOpening.days) +
      Math.max(
        0,
        accruedLeaveDays(params.hireDate, at) -
          accruedLeaveDays(params.hireDate, new Date(`${leaveOpening.entry_date}T12:00:00`)),
      )
    : accruedLeaveDays(params.hireDate, at);

  let creditLeave = 0;
  let debitLeave = 0;
  let creditRecup = recupOpening ? Number(recupOpening.days) || 0 : 0;
  let debitRecup = 0;

  const holidaySet = new Set(params.holidays ?? []);
  const punchedSet = new Set(params.punchedDates ?? []);
  const workedHolidays = params.schedules.filter(
    (s) =>
      s.day_type === "travail" &&
      holidaySet.has(s.work_date) &&
      afterRecup(s.work_date) &&
      // Récupération du férié uniquement si l'agent a réellement pointé ce jour-là.
      punchedSet.has(s.work_date),
  ).length;
  creditRecup += workedHolidays;

  params.entries.forEach((e) => {
    const d = Number(e.days) || 0;
    if (e.kind === "conge_credit" && afterLeave(e.entry_date)) creditLeave += d;
    else if (e.kind === "conge_debit" && afterLeave(e.entry_date)) debitLeave += d;
    else if (e.kind === "recup_credit" && afterRecup(e.entry_date)) creditRecup += d;
    else if (e.kind === "recup_debit" && afterRecup(e.entry_date)) debitRecup += d;
  });

  const plannedLeave = params.schedules.filter(
    (s) => s.day_type === "conge" && afterLeave(s.work_date),
  ).length;
  const plannedRecup = params.schedules.filter(
    (s) => s.day_type === "recuperation" && afterRecup(s.work_date),
  ).length;

  const accrued = Number((accruedBase + creditLeave).toFixed(2));
  const leaveTaken = plannedLeave + debitLeave;
  const recupTaken = plannedRecup + debitRecup;

  return {
    accrued,
    leaveTaken,
    leaveRemaining: Number((accrued - leaveTaken).toFixed(2)),
    recupCredit: creditRecup,
    recupTaken,
    recupRemaining: Number((creditRecup - recupTaken).toFixed(2)),
  };
}

/* ------------------------------------------------------------ Heures supplémentaires & repos */

/** Plafond légal annuel d'heures supplémentaires par salarié (décret n° 2-04-570, art. 2). */
export const ANNUAL_OVERTIME_CAP_HOURS = 80;

export interface OvertimeCounter {
  agentId: string;
  agentName: string;
  /** Heures sup. acquises sur la période (au-delà de 8 h/jour, managers exclus). */
  earned: number;
  /** Heures récupérées (jours de récupération × 8 h). */
  recovered: number;
  /** Heures payées (juin–août, au taux normal). */
  paid: number;
  /** Alerte si les heures acquises sur l'année dépassent le plafond légal. */
  overCap: boolean;
}

/**
 * Compteur d'heures supplémentaires par salarié (managers et direction exclus).
 * Récupérées = journées « Récupération » du planning × 8 h ; payées = HS de juin à août.
 */
export function computeOvertimeCounters(params: {
  days: DayResult[];
  agents: { id: string; full_name: string; staff_level: string }[];
  year: number;
}): OvertimeCounter[] {
  const eligible = params.agents.filter((a) => a.staff_level === "agent");
  return eligible.map((a) => {
    const days = params.days.filter((d) => d.agentId === a.id);
    const earned = days.reduce((t, d) => t + d.overtimeHours, 0);
    const paid = days
      .filter((d) => {
        const m = Number(d.date.slice(5, 7));
        return m >= 6 && m <= 8;
      })
      .reduce((t, d) => t + d.overtimeHours, 0);
    const recupDays = days.filter((d) => d.dayType === "recuperation").length;
    const recovered = recupDays * OVERTIME_THRESHOLD_HOURS;
    return {
      agentId: a.id,
      agentName: a.full_name,
      earned: Number(earned.toFixed(2)),
      recovered: Number(recovered.toFixed(2)),
      paid: Number(paid.toFixed(2)),
      overCap: earned > ANNUAL_OVERTIME_CAP_HOURS,
    };
  });
}

/** Semaines (lundi) sans journée de repos complète, par agent — repos hebdomadaire obligatoire. */
export function missingWeeklyRest(params: {
  schedules: HrSchedule[];
  agents: { id: string; full_name: string }[];
  from: string;
  to: string;
}): { agentId: string; agentName: string; week: string }[] {
  const out: { agentId: string; agentName: string; week: string }[] = [];
  const byAgent = new Map<string, Set<string>>();
  params.schedules.forEach((s) => {
    if (s.day_type === "travail") {
      if (!byAgent.has(s.agent_id)) byAgent.set(s.agent_id, new Set());
      byAgent.get(s.agent_id)!.add(s.work_date);
    }
  });
  params.agents.forEach((a) => {
    const worked = byAgent.get(a.id);
    if (!worked) return;
    let wk = weekStart(params.from);
    while (wk <= params.to) {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(`${wk}T12:00:00`);
        d.setDate(d.getDate() + i);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }).filter((d) => d >= params.from && d <= params.to);
      // Alerte seulement si les 7 jours de la semaine sont travaillés (aucun repos complet).
      if (days.length === 7 && days.every((d) => worked.has(d))) {
        out.push({ agentId: a.id, agentName: a.full_name, week: wk });
      }
      const nd = new Date(`${wk}T12:00:00`);
      nd.setDate(nd.getDate() + 7);
      wk = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-${String(nd.getDate()).padStart(2, "0")}`;
    }
  });
  return out;
}

/** Formate des minutes en « 00h00m ». */
export function formatMinutes(min: number): string {
  const t = Math.round(min);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}h${String(t % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------ Export CSV */

export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    headers.map(esc).join(";"),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(";")),
  ].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
