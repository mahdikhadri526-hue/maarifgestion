import { supabase } from "@/lib/db";
import { requireCurrentPdvId } from "@/lib/pdvStore";

/** Lundi (YYYY-MM-DD) de la semaine contenant la date donnée. */
export function weekStartOf(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${dd}`;
}

/**
 * Mise en place de la semaine : valeur saisie pour cette semaine, sinon
 * la dernière valeur d'une semaine précédente.
 */
export async function getMiseEnPlaceStocks(week: string): Promise<{ values: Record<string, number>; saved: Record<string, boolean> }> {
  const pdvId = requireCurrentPdvId();
  const { data, error } = await (supabase as any)
    .from("mise_en_place_stocks")
    .select("product_id, quantity, week_start")
    .eq("pdv_id", pdvId)
    .lte("week_start", week)
    .order("week_start", { ascending: false });
  if (error) throw error;
  const values: Record<string, number> = {};
  const saved: Record<string, boolean> = {};
  for (const row of (data || []) as any[]) {
    if (row.product_id in values) continue;
    values[row.product_id] = Number(row.quantity) || 0;
    saved[row.product_id] = row.week_start === week;
  }
  return { values, saved };
}

export async function setMiseEnPlaceStock(productId: string, quantity: number, week: string) {
  const pdvId = requireCurrentPdvId();
  const { error } = await (supabase as any)
    .from("mise_en_place_stocks")
    .upsert(
      { pdv_id: pdvId, product_id: productId, quantity, week_start: week },
      { onConflict: "pdv_id,product_id,week_start" }
    );
  if (error) throw error;
}
