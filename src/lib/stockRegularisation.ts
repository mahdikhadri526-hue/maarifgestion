import { movementFlow } from "@/lib/stockData";

/**
 * Répartit une diminution de sorties (régularisation à la hausse) :
 * d'abord sur les sorties du jour, puis sur celles des jours précédents.
 * Le reliquat éventuel reste sur le jour de la régularisation.
 */
export function splitRegularisation(
  amount: number,
  date: string,
  movements: { date: string; type: string; quantity: number; source?: string | null }[],
): { date: string; quantity: number }[] {
  const day = date.slice(0, 10);
  const net = new Map<string, number>();
  for (const m of movements) {
    const d = String(m.date).slice(0, 10);
    if (d > day) continue;
    net.set(d, (net.get(d) ?? 0) + movementFlow(m, Number(m.quantity) || 0).s);
  }
  const dates = [...net.keys()].sort().reverse();
  if (!dates.includes(day)) dates.unshift(day);
  const out: { date: string; quantity: number }[] = [];
  let left = amount;
  for (const d of dates) {
    if (left <= 0) break;
    const take = Math.min(left, Math.max(0, net.get(d) ?? 0));
    if (take > 0) { out.push({ date: d, quantity: take }); left -= take; }
  }
  if (left > 0) {
    const same = out.find((r) => r.date === day);
    if (same) same.quantity += left; else out.push({ date: day, quantity: left });
  }
  return out;
}
