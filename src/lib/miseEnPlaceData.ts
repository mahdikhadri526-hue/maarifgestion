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

// Semaine fixe utilisée pour la valeur unique du stock restant (comportement d'origine).
const SINGLE_WEEK = "2000-01-03"; // un lundi

/**
 * Mise en place : une seule valeur par produit (comportement d'origine).
 * La table garde une colonne week_start ; on lit la dernière valeur connue
 * et on écrit toujours sur la semaine fixe.
 */
export async function getMiseEnPlaceStocks(): Promise<Record<string, number>> {
  const pdvId = requireCurrentPdvId();
  const { data, error } = await (supabase as any)
    .from("mise_en_place_stocks")
    .select("product_id, quantity, week_start")
    .eq("pdv_id", pdvId)
    .order("week_start", { ascending: false });
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const row of (data || []) as any[]) {
    if (row.product_id in map) continue;
    map[row.product_id] = Number(row.quantity) || 0;
  }
  return map;
}

export async function setMiseEnPlaceStock(productId: string, quantity: number) {
  const pdvId = requireCurrentPdvId();
  const { error } = await (supabase as any)
    .from("mise_en_place_stocks")
    .upsert(
      { pdv_id: pdvId, product_id: productId, quantity, week_start: SINGLE_WEEK },
      { onConflict: "pdv_id,product_id,week_start" }
    );
  if (error) throw error;
}

/** Valeurs enregistrées pour une semaine précise (lundi ISO). */
export async function getMiseEnPlaceStocksForWeek(weekStart: string): Promise<Record<string, number>> {
  const pdvId = requireCurrentPdvId();
  const { data, error } = await (supabase as any)
    .from("mise_en_place_stocks")
    .select("product_id, quantity")
    .eq("pdv_id", pdvId)
    .eq("week_start", weekStart);
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const row of (data || []) as any[]) {
    map[row.product_id] = Number(row.quantity) || 0;
  }
  return map;
}

export async function setMiseEnPlaceStockForWeek(productId: string, quantity: number, weekStart: string) {
  const pdvId = requireCurrentPdvId();
  const { error } = await (supabase as any)
    .from("mise_en_place_stocks")
    .upsert(
      { pdv_id: pdvId, product_id: productId, quantity, week_start: weekStart },
      { onConflict: "pdv_id,product_id,week_start" }
    );
  if (error) throw error;
}

/**
 * Jour d'inventaire d'une semaine : le lundi, sauf si la semaine chevauche
 * la fin du mois — alors le lendemain du dernier jour du mois.
 */
export function inventoryDayOfWeek(weekStart: string): Date {
  const monday = new Date(weekStart + "T00:00:00");
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const monthEnd = new Date(monday.getFullYear(), monday.getMonth() + 1, 0);
  if (monthEnd >= monday && monthEnd <= sunday) {
    const d = new Date(monthEnd);
    d.setDate(d.getDate() + 1);
    return d;
  }
  return monday;
}
