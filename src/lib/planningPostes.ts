import { POSTES, type HrAgent } from "./hrData";

const normalize = (poste: string) =>
  poste.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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
  const order = POSTES.map(normalize);
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi)
        || a.localeCompare(b, "fr");
    })
    .map(([, group]) => group);
}