import { supabase } from "@/lib/db";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const FICHE = "Mouvement glaces & tartes";

/** Parfums disponibles = articles du suivi hebdo « Mouvement glaces » (hors crème fraîche). */
export const GLACE_PARFUMS = [
  "Nougat", "Praliné", "Vanille", "Chocolat", "Pistache", "Caramel", "Moka",
  "Parfait", "Fraise", "Framboise", "Orange", "Mangue", "Citron", "Pêche",
  "Banane", "Citron menthe", "Orange cannelle", "Réglisse",
];

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Calcule, par parfum, le lot le plus ancien encore disponible (FIFO)
 * d'après le suivi hebdomadaire « Mouvement glaces ».
 */
export async function fetchGlaceFifoLots(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("weekly_tracking")
    .select("article, week_start, day_of_week, row_index, stock_initial, entrees, sorties, lot_number")
    .eq("fiche_type", FICHE)
    .in("article", GLACE_PARFUMS);
  if (error || !data) return {};

  const byArticle = new Map<string, any[]>();
  for (const r of data as any[]) {
    if (!r.article) continue;
    const list = byArticle.get(r.article) ?? [];
    list.push(r);
    byArticle.set(r.article, list);
  }

  const result: Record<string, string> = {};

  for (const [article, rows] of byArticle) {
    const keys = Array.from(
      new Set(rows.map((r) => `${r.week_start}|${r.day_of_week}`)),
    ).sort((a, b) => {
      const [wa, da] = a.split("|");
      const [wb, db] = b.split("|");
      return wa.localeCompare(wb) || DAYS.indexOf(da) - DAYS.indexOf(db);
    });

    let batches: { lot: string; remaining: number }[] = [];

    for (const key of keys) {
      const dayRows = rows
        .filter((r) => `${r.week_start}|${r.day_of_week}` === key)
        .sort((a, b) => (a.row_index ?? 0) - (b.row_index ?? 0));

      const siRow = dayRows.find((r) => r.stock_initial != null && r.stock_initial !== "");
      if (siRow) {
        const target = num(siRow.stock_initial);
        const total = batches.reduce((s, b) => s + b.remaining, 0);
        if (total > target) {
          let excess = total - target;
          for (const b of [...batches.filter((b) => !b.lot), ...batches.filter((b) => !!b.lot)]) {
            if (excess <= 0) break;
            const take = Math.min(b.remaining, excess);
            b.remaining -= take;
            excess -= take;
          }
        } else if (total < target) {
          batches.push({ lot: "", remaining: target - total });
        }
      }

      for (const r of dayRows) {
        const q = num(r.entrees);
        if (q > 0) batches.push({ lot: (r.lot_number ?? "").toString().trim(), remaining: q });
      }

      let need = dayRows.reduce((s, r) => s + num(r.sorties), 0);
      for (const b of [...batches.filter((b) => !!b.lot), ...batches.filter((b) => !b.lot)]) {
        if (need <= 0) break;
        if (b.remaining <= 0) continue;
        const take = Math.min(b.remaining, need);
        b.remaining -= take;
        need -= take;
      }

      batches = batches.filter((b) => b.remaining > 0);
    }

    const oldest = batches.find((b) => b.lot);
    if (oldest) result[article] = oldest.lot;
  }

  return result;
}
