import { supabase } from "@/lib/db";
import { requireCurrentPdvId } from "@/lib/pdvStore";
import {
  getProducts,
  getMovements,
  getInitialStocks,
  getProductUnits,
  getProductUnitConfigs,
  movementPiecesToDisplay,
  roundStockQuantity,
  getGlaceAggregateForRange,
} from "@/lib/stockData";
import { weekStartOf } from "@/lib/miseEnPlaceData";

/** Dimanche (YYYY-MM-DD) de la semaine commençant le lundi `weekStart`. */
export function weekEndOf(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, (d || 1) + 6);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/**
 * Jour de saisie de l'inventaire hebdomadaire pour la semaine donnée :
 * - normalement le lundi ;
 * - si la semaine contient la fin du mois, le lendemain de la fin du mois.
 */
export function inventoryDayOfWeek(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const monday = new Date(y, (m || 1) - 1, d || 1);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  // Fin du mois du lundi
  const monthEnd = new Date(monday.getFullYear(), monday.getMonth() + 1, 0);
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  if (monthEnd >= monday && monthEnd <= sunday) {
    const next = new Date(monthEnd);
    next.setDate(next.getDate() + 1);
    return fmt(next);
  }
  return fmt(monday);
}

/** Quantités de mise en place saisies pour une semaine (par produit). */
export async function getWeeklyMiseEnPlace(weekStart: string): Promise<Record<string, number>> {
  const pdvId = requireCurrentPdvId();
  const { data, error } = await (supabase as any)
    .from("mise_en_place_weekly")
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

export async function setWeeklyMiseEnPlace(productId: string, weekStart: string, quantity: number) {
  const pdvId = requireCurrentPdvId();
  const { error } = await (supabase as any)
    .from("mise_en_place_weekly")
    .upsert(
      { pdv_id: pdvId, product_id: productId, week_start: weekStart, quantity },
      { onConflict: "pdv_id,product_id,week_start" }
    );
  if (error) throw error;
}

export interface WeeklyMepRow {
  productId: string;
  productName: string;
  conditionnement: string;
  category: string;
  stockRestant: number;
}

/**
 * Stock restant de chaque produit à la FIN de la semaine choisie
 * (stock initial + entrées − sorties jusqu'au dimanche inclus).
 * N'écrit rien : lecture seule, le tableau « Stock restant » n'est pas touché.
 */
export async function getWeeklyStockRestant(weekStart: string): Promise<WeeklyMepRow[]> {
  const end = weekEndOf(weekStart);
  const [products, movements, initials, units, configs] = await Promise.all([
    Promise.resolve(getProducts()),
    getMovements(),
    getInitialStocks(),
    getProductUnits(),
    getProductUnitConfigs(),
  ]);

  const byProduct = new Map<string, { entrees: number; sorties: number }>();
  for (const m of movements) {
    const day = m.date.split("T")[0];
    if (day > end) continue;
    let bucket = byProduct.get(m.productId);
    if (!bucket) { bucket = { entrees: 0, sorties: 0 }; byProduct.set(m.productId, bucket); }
    const q = movementPiecesToDisplay(m.quantity, units[m.productId] || "PIECE", configs[m.productId], m.productId);
    if (m.type === "entree") bucket.entrees += q;
    else bucket.sorties += q;
  }

  const regularTotal = (productId: string) => {
    const bucket = byProduct.get(productId) || { entrees: 0, sorties: 0 };
    return (initials[productId] || 0) + bucket.entrees - bucket.sorties;
  };

  // GLACE : calcul agrégé spécifique (grammage), borné à la fin de la semaine.
  let glaceRestant: number | null = null;
  try {
    const agg = await getGlaceAggregateForRange(undefined, end);
    glaceRestant = agg.stockRestant;
  } catch {
    glaceRestant = null;
  }

  const rows: WeeklyMepRow[] = [];
  for (const p of products) {
    let restant: number;
    if (p.name === "GLACE" && glaceRestant != null) {
      restant = glaceRestant;
    } else if (p.name === "TOPPINGS") {
      // TOPPINGS = SMARTIES + OREO
      const sources = products.filter((x) => /^(SMARTIES|OREO)/i.test(x.name));
      restant = sources.length > 0
        ? sources.reduce((s, x) => s + regularTotal(x.id), 0)
        : regularTotal(p.id);
    } else {
      restant = regularTotal(p.id);
    }
    rows.push({
      productId: p.id,
      productName: p.name,
      conditionnement: p.conditionnement,
      category: p.category,
      stockRestant: roundStockQuantity(restant),
    });
  }
  return rows;
}

export { weekStartOf };
