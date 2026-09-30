import { supabase } from "@/lib/db";
import { requireCurrentPdvId } from "@/lib/pdvStore";

/**
 * Mise en place hebdomadaire — tableau séparé du « Stock restant ».
 * Une valeur par produit et par semaine ; si la semaine n'a pas encore
 * de saisie, on reprend la dernière valeur antérieure (reprise).
 */
export async function getWeeklyMep(
  week: string
): Promise<{ values: Record<string, number>; saved: Record<string, boolean> }> {
  const pdvId = requireCurrentPdvId();
  const { data, error } = await (supabase as any)
    .from("mise_en_place_weekly")
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

export async function setWeeklyMep(productId: string, quantity: number, week: string) {
  const pdvId = requireCurrentPdvId();
  const { error } = await (supabase as any)
    .from("mise_en_place_weekly")
    .upsert(
      { pdv_id: pdvId, product_id: productId, quantity, week_start: week },
      { onConflict: "pdv_id,product_id,week_start" }
    );
  if (error) throw error;
}
