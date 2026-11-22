import { supabase } from "@/lib/db";
import { requireCurrentPdvId } from "@/lib/pdvStore";
import { fetchAllRows } from "@/lib/supabasePaginate";

export type StockTotalOpening = {
  product_id: string;
  category: "alimentaire" | "emballage";
  opening_date: string;
  quantity: number;
  performed_by: string;
};

export function canInitializeStockTotal(options: {
  variant: string; mode: string; category: string; productId: string;
  canEditRemaining: boolean; hasOpening: boolean; derived?: boolean;
}) {
  return options.variant === "stock"
    && ["alimentaire", "emballage"].includes(options.category)
    && !options.productId.startsWith("__") && !options.derived
    && options.canEditRemaining;
}

export function validateStockTotalOpening(value: string, operator: string, date: string) {
  const quantity = Number(value.replace(",", "."));
  if (!value.trim() || !Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Saisissez un stock de départ supérieur ou égal à zéro.");
  }
  if (!operator.trim()) throw new Error("Choisissez la personne qui effectue la saisie.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error("Choisissez une date de départ valide.");
  }
  return quantity;
}

export async function loadStockTotalOpenings(): Promise<StockTotalOpening[]> {
  return fetchAllRows<StockTotalOpening>(() => supabase.from("stock_total_openings")
    .select("product_id,category,opening_date,quantity,performed_by")
    .eq("pdv_id", requireCurrentPdvId()));
}

export async function saveStockTotalOpening(opening: StockTotalOpening, existing = false) {
  validateStockTotalOpening(String(opening.quantity), opening.performed_by, opening.opening_date);
  if (!["alimentaire", "emballage"].includes(opening.category) || opening.product_id.startsWith("__")) {
    throw new Error("Initialisation réservée aux articles Alimentaire et Emballage.");
  }
  const pdvId = requireCurrentPdvId();
  const table = supabase.from("stock_total_openings");
  const query = existing
    ? table.update({ quantity: opening.quantity, opening_date: opening.opening_date, performed_by: opening.performed_by.trim() })
      .eq("pdv_id", pdvId).eq("product_id", opening.product_id)
    : table.insert({ ...opening, performed_by: opening.performed_by.trim(), pdv_id: pdvId });
  const { data, error } = await query
    .select("product_id,category,opening_date,quantity,performed_by").single();
  if (error?.code === "23505") throw new Error("Le stock de départ de cet article a déjà été défini.");
  if (error) throw error;
  return data;
}