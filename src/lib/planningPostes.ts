import { POSTES, type HrAgent } from "./hrData";

const normalize = (poste: string) =>
  poste.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** True when the agent has at least one schedule row in the displayed week (optionally scoped to one PDV). */
export function isPlannedHere(
  agentId: string,
  rows: PlanRow[],
  planningPdvId: string | null,
): boolean {
  return rows.some(
    (r) => r.agent_id === agentId && (!planningPdvId || r.pdv_id === planningPdvId) && isFilledRow(r),
  );
}

/** In the Planning table, caissiers / ménage / sécurité appear only when planned in the displayed week. */
export function keepPlannedShared<T extends { id: string; poste?: string | null }>(
  agents: T[],
  rows: PlanRow[],
  planningPdvId: string | null,
): T[] {
  const isShared = (poste?: string | null) => {
    const p = normalize(poste ?? "");
    return p === "caissier" || p === "menage" || p.includes("securite");
  };
  return agents.filter((a) => !isShared(a.poste) || isPlannedHere(a.id, rows, planningPdvId));
}

type PlanRow = {
  agent_id: string;
  pdv_id: string | null;
  day_type?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  work_shift?: string | null;
};

/** A schedule row counts as planned only when it carries a day type, hours or a shift (empty cells don't). */
export function isFilledRow(r: PlanRow): boolean {
  if (!("day_type" in r) && !("start_time" in r)) return true;
  return !!((r.day_type ?? "").trim() || r.start_time || r.end_time || r.work_shift);
}

/** Group only the roster already scoped by the planning, without creating empty posts. */
export function groupPlanningByPoste(agents: HrAgent[]) {
  const groups = new Map<string, { poste: string; agents: HrAgent[] }>();
  for (const agent of agents) {
    if (!agent.active) continue;
    const raw = agent.poste?.trim() || "Sans poste";
    const key = normalize(raw);
    const poste = POSTES.find((p) => normalize(p) === key) ?? raw;
    const group = groups.get(key);
    if (group) group.agents.push(agent);
    else groups.set(key, { poste, agents: [agent] });
  }
  const order = [
    ...POSTES.filter((poste) => poste !== "Caissier" && poste !== "Passe" && poste !== "Ménage" && poste !== "Agent de sécurité"),
    "Passe", "Caissier", "Ménage", "Agent de sécurité",
  ].map(normalize);
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi)
        || a.localeCompare(b, "fr");
    })
    .map(([, group]) => group);
}