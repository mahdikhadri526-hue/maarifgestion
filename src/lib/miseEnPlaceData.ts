import { supabase } from "@/lib/db";
import { requireCurrentPdvId } from "@/lib/pdvStore";

export async function getMiseEnPlaceStocks(): Promise<Record<string, number>> {
  const pdvId = requireCurrentPdvId();
  const { data, error } = await supabase
    .from("mise_en_place_stocks")
    .select("product_id, quantity")
    .eq("pdv_id", pdvId);
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const row of data || []) map[row.product_id] = Number(row.quantity) || 0;
  return map;
}

export async function setMiseEnPlaceStock(productId: string, quantity: number) {
  const pdvId = requireCurrentPdvId();
  const { error } = await supabase
    .from("mise_en_place_stocks")
    .upsert(
      { pdv_id: pdvId, product_id: productId, quantity },
      { onConflict: "pdv_id,product_id" }
    );
  if (error) throw error;
}
