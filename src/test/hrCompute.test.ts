import { describe, expect, it } from "vitest";
import {
  ANNUAL_OVERTIME_CAP_HOURS,
  computeBalance,
  computeDay,
  computeOvertimeCounters,
  missingWeeklyRest,
} from "@/lib/hrCompute";
import type { AttendancePunch } from "@/lib/attendanceData";

const punch = (type: string, at: string): AttendancePunch =>
  ({
    id: at,
    pdv_id: "p1",
    agent_id: "a1",
    agent_name: "Agent",
    punch_type: type,
    punched_at: at,
    punch_date: at.slice(0, 10),
    match_score: null,
    method: "face",
    device_label: null,
  }) as AttendancePunch;

describe("computeDay", () => {
  const base = {
    agentId: "a1",
    agentName: "Agent",
    pdvId: "p1",
    schedule: { day_type: "travail" } as any,
  };

  it("rattache un service de nuit à la veille (sortie après minuit)", () => {
    const r = computeDay({
      ...base,
      date: "2026-10-10",
      punches: [punch("entree", "2026-10-10T20:00:00"), punch("sortie", "2026-10-11T04:00:00")],
    });
    expect(r.workedHours).toBe(8);
  });

  it("marque l'absence uniquement pour une journée passée", () => {
    const past = computeDay({ ...base, date: "2026-10-01", punches: [], today: "2026-10-18" });
    expect(past.absence).toBe(true);
    const future = computeDay({ ...base, date: "2026-10-20", punches: [], today: "2026-10-18" });
    expect(future.absence).toBe(false);
    const sameDay = computeDay({ ...base, date: "2026-10-18", punches: [], today: "2026-10-18" });
    expect(sameDay.absence).toBe(false);
  });
});

describe("computeBalance — récupération férié sur pointage réel", () => {
  const sched = (d: string) => ({ day_type: "travail", work_date: d }) as any;
  it("crédite le férié seulement si l'agent a pointé", () => {
    const params = {
      hireDate: null,
      entries: [],
      schedules: [sched("2026-05-01")],
      holidays: ["2026-05-01"],
      at: new Date("2026-10-18T12:00:00"),
    };
    const noPunch = computeBalance({ ...params, punchedDates: [] });
    expect(noPunch.recupCredit).toBe(0);
    const withPunch = computeBalance({ ...params, punchedDates: ["2026-05-01"] });
    expect(withPunch.recupCredit).toBe(1);
  });
});

describe("computeOvertimeCounters", () => {
  it("exclut les managers et alerte au-delà du plafond légal", () => {
    expect(ANNUAL_OVERTIME_CAP_HOURS).toBe(80);
    const day = (agentId: string, ot: number, date = "2026-10-10") =>
      ({ agentId, overtimeHours: ot, date, dayType: "travail" }) as any;
    const counters = computeOvertimeCounters({
      days: [day("a1", 90), day("m1", 50)],
      agents: [
        { id: "a1", full_name: "Agent", staff_level: "agent" },
        { id: "m1", full_name: "Manager", staff_level: "manager" },
      ],
      year: 2026,
    });
    expect(counters).toHaveLength(1);
    expect(counters[0].agentId).toBe("a1");
    expect(counters[0].earned).toBe(90);
    expect(counters[0].overCap).toBe(true);
  });
});

describe("missingWeeklyRest", () => {
  it("signale une semaine de 7 jours sans repos complet", () => {
    const days = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
    const alerts = missingWeeklyRest({
      schedules: days.map((d) => ({ agent_id: "a1", work_date: d, day_type: "travail" }) as any),
      agents: [{ id: "a1", full_name: "Agent" }],
      from: "2026-10-12",
      to: "2026-10-18",
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].week).toBe("2026-10-12");
  });
});
