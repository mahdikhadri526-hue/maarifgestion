import { POSTES, type HrAgent } from "./hrData";

const normalize = (poste: string) =>
  poste.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** True when the agent has at least one schedule row in the displayed week (optionally scoped to one PDV). */
export function isPlannedHere(
  agentId: string,
  rows: { agent_id: string; pdv_id: string | null }[],
  planningPdvId: string | null,
): boolean {
  return rows.some((r) => r.agent_id === agentId && (!planningPdvId || r.pdv_id === planningPdvId));
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