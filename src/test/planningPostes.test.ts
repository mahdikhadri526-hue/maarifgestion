import { describe, expect, it } from "vitest";
import { groupPlanningByPoste, isPlannedHere } from "@/lib/planningPostes";
import type { HrAgent } from "@/lib/hrData";

const agent = (id: string, poste: string | null, pdv_id = "maarif", active = true): HrAgent => ({
  id, poste, pdv_id, active, full_name: id, hire_date: null, staff_level: "agent",
});

describe("planning grouped by employees' RH posts", () => {
  it("places Passe before Caissier in the planning without changing the roster", () => {
    const employees = [agent("c", "Caissier"), agent("p", "Passe"), agent("s", "Service"), agent("m", "Ménage")];
    const before = JSON.stringify(employees);
    expect(groupPlanningByPoste(employees).map((g) => g.poste)).toEqual(["Service", "Passe", "Caissier", "Ménage"]);
    expect(JSON.stringify(employees)).toBe(before);
  });

  it("separates Service, Comptoir and Passe even when employees are interleaved", () => {
    const groups = groupPlanningByPoste([
      agent("service-1", "Service"), agent("passe", "Passe"),
      agent("comptoir", "Comptoir"), agent("service-2", "Service"),
    ]);
    expect(groups.map((g) => [g.poste, g.agents.map((a) => a.id)])).toEqual([
      ["Service", ["service-1", "service-2"]], ["Comptoir", ["comptoir"]], ["Passe", ["passe"]],
    ]);
  });

  it("shows only occupied active posts for the scoped PDV roster", () => {
    const employees = [agent("a", "Service"), agent("b", "Comptoir", "autre"), agent("c", "Passe", "maarif", false)];
    const groups = groupPlanningByPoste(employees.filter((a) => a.pdv_id === "maarif"));
    expect(groups.map((g) => g.poste)).toEqual(["Service"]);
    expect(groupPlanningByPoste([])).toEqual([]);
  });

  it("keeps unassigned and historical posts without altering employee records", () => {
    const employees = [agent("a", null), agent("b", "Ancien poste"), agent("c", " ménage ")];
    const before = JSON.stringify(employees);
    const groups = groupPlanningByPoste(employees);
    expect(groups.map((g) => g.poste)).toEqual(["Ménage", "Ancien poste", "Sans poste"]);
    expect(groups.flatMap((g) => g.agents).length).toBe(3);
    expect(JSON.stringify(employees)).toBe(before);
  });
});

describe("sections hidden unless a collaborator is planned this week", () => {
  const row = (agent_id: string, pdv_id: string | null) => ({ agent_id, pdv_id });

  it("shows caissier / menage / securite only when a schedule exists in the displayed week", () => {
    const rows = [row("c", "maarif"), row("m", null)];
    expect(isPlannedHere("c", rows, "maarif")).toBe(true);
    expect(isPlannedHere("m", rows, null)).toBe(true);
    expect(isPlannedHere("s", rows, "maarif")).toBe(false);
    expect(isPlannedHere("c", [], "maarif")).toBe(false);
  });

  it("keeps the PDV scope: a schedule in another PDV does not plan the agent here", () => {
    const rows = [row("c", "autre")];
    expect(isPlannedHere("c", rows, "maarif")).toBe(false);
    expect(isPlannedHere("c", rows, null)).toBe(true);
  });
});
import { isPlannedHere as _iph } from "@/lib/planningPostes";
import { it as _it, expect as _ex } from "vitest";
_it("une case vide (sans type ni horaire) ne compte pas comme planifiée", () => {
  const empty = [{ agent_id: "a", pdv_id: "p", day_type: "", start_time: null, end_time: null, work_shift: null }];
  _ex(_iph("a", empty, "p")).toBe(false);
  _ex(_iph("a", [{ ...empty[0], start_time: "08:00" }], "p")).toBe(true);
});

describe("table Planning : caissiers / ménage / sécurité planifiés seulement", () => {
  const filled = (agent_id: string, pdv_id: string | null) => ({ agent_id, pdv_id, day_type: "travail" });

  it("keeps a shared collaborator only when planned in the displayed week", () => {
    const shared = [agent("c1", "Caissier"), agent("c2", "Caissier"), agent("m1", "Ménage"), agent("s1", "Agent de sécurité")];
    const rows = [filled("c1", "maarif"), filled("m1", null)];
    const kept = keepPlannedShared(shared, rows, null).map((a) => a.id);
    expect(kept).toEqual(["c1", "m1"]);
  });

  it("respects the PDV scope when one PDV is selected", () => {
    const shared = [agent("c1", "Caissier")];
    expect(keepPlannedShared(shared, [filled("c1", "autre")], "maarif")).toEqual([]);
    expect(keepPlannedShared(shared, [filled("c1", "maarif")], "maarif").map((a) => a.id)).toEqual(["c1"]);
  });

  it("keeps a filled schedule and drops an empty cell", () => {
    const shared = [agent("c1", "Caissier")];
    expect(keepPlannedShared(shared, [{ agent_id: "c1", pdv_id: "maarif", day_type: "", start_time: null, end_time: null, work_shift: null }], "maarif")).toEqual([]);
  });
});
