import type { AttendancePunch, PunchType } from "@/lib/attendanceData";
import type { DayType, HrBalanceEntry, HrSchedule } from "@/lib/hrData";

/* ------------------------------------------------------------ Heures */

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
  present: boolean;
  absence: boolean;
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
}): DayResult {
  const { date, agentId, agentName, pdvId, punches, schedule } = params;
  const dayType = (schedule?.day_type as DayType | undefined) ?? null;

  const e = punchAt(punches, "entree");
  const ps = punchAt(punches, "pause");
  const pe = punchAt(punches, "retour");
  const s = punchAt(punches, "sortie");

  const pauseMs = ps && pe && pe > ps ? pe - ps : 0;
  let workedMs = 0;
  if (e && s && s > e) workedMs = s - e - pauseMs;
  else if (e && ps && ps > e) workedMs = ps - e;
  const worked = Math.max(0, workedMs) / 3_600_000;

  let lateMinutes = 0;
  const plannedStart = schedule?.start_time ?? null;
  const pm = toMinutes(plannedStart);
  if (dayType === "travail" && pm !== null && e) {
    const d = new Date(e);
    const real = d.getHours() * 60 + d.getMinutes();
    lateMinutes = Math.max(0, real - pm);
  }

  const present = Boolean(e);
  const isHoliday = Boolean(params.holidayLabel);
  const absence = dayType === "travail" && !present && !isHoliday;

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
    present,
    absence,
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
  at?: Date;
}): AgentBalance {
  const at = params.at ?? new Date();
  const accruedBase = accruedLeaveDays(params.hireDate, at);
  let creditLeave = 0;
  let debitLeave = 0;
  let creditRecup = 0;
  let debitRecup = 0;
  params.entries.forEach((e) => {
    const d = Number(e.days) || 0;
    if (e.kind === "conge_credit") creditLeave += d;
    else if (e.kind === "conge_debit") debitLeave += d;
    else if (e.kind === "recup_credit") creditRecup += d;
    else if (e.kind === "recup_debit") debitRecup += d;
  });

  const plannedLeave = params.schedules.filter((s) => s.day_type === "conge").length;
  const plannedRecup = params.schedules.filter((s) => s.day_type === "recuperation").length;

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
