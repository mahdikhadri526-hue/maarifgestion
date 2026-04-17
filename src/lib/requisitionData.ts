import { supabase } from "@/integrations/supabase/client";
import { saveMovement } from "./stockData";

export interface RequisitionEntry {
  id: string;
  date: string;
  type: "salle" | "emporter";
  productId: string;
  productName: string;
  quantity: number;
}

// Products in "Réquisition Salle" (alimentaire)
export const REQUISITION_SALLE_IDS = [
  "ali-0","ali-1","ali-2","ali-3","ali-4","ali-5","ali-6","ali-7","ali-8",
  "ali-9","ali-10","ali-11","ali-12","ali-13","ali-14","ali-15","ali-16",
  "ali-17","ali-18","ali-19","ali-20",
];

// Products in "Réquisition Emporter" (emballage)
export const REQUISITION_EMPORTER_IDS = [
  "emb-0","emb-1","emb-2","emb-3","emb-4","emb-5","emb-6","emb-7","emb-8",
  "emb-9","emb-10","emb-11","emb-12","emb-13","emb-14","emb-15","emb-16",
  "emb-17","emb-18","emb-19","emb-20","emb-21","emb-22","emb-23","emb-24",
  "emb-25","emb-26","emb-27","emb-28","emb-29","emb-30","emb-31","emb-32",
  "emb-33","emb-34","emb-35","emb-36","emb-37","emb-38","emb-39","emb-40","emb-41",
];

export const ALL_REQUISITION_IDS = new Set([...REQUISITION_SALLE_IDS, ...REQUISITION_EMPORTER_IDS]);

export async function getRequisitions(): Promise<RequisitionEntry[]> {
  const { data, error } = await supabase.from("requisitions").select("*");
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    date: row.date,
    type: row.type as "salle" | "emporter",
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
  }));
}

export async function saveRequisition(entry: Omit<RequisitionEntry, "id">): Promise<RequisitionEntry> {
  const { data, error } = await supabase
    .from("requisitions")
    .insert({
      date: entry.date,
      type: entry.type,
      product_id: entry.productId,
      product_name: entry.productName,
      quantity: entry.quantity,
    })
    .select()
    .single();
  if (error) throw error;

  // Auto-create a "sortie" movement for the same date
  const category = entry.type === "salle" ? "alimentaire" as const : "emballage" as const;
  await saveMovement({
    date: entry.date,
    productId: entry.productId,
    productName: entry.productName,
    category,
    type: "sortie",
    quantity: entry.quantity,
  });

  return {
    id: data.id,
    date: data.date,
    type: data.type as "salle" | "emporter",
    productId: data.product_id,
    productName: data.product_name,
    quantity: data.quantity,
  };
}

export async function getRequisitionsByDate(date: string, type: "salle" | "emporter"): Promise<RequisitionEntry[]> {
  const { data, error } = await supabase
    .from("requisitions")
    .select("*")
    .eq("date", date)
    .eq("type", type);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    date: row.date,
    type: row.type as "salle" | "emporter",
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
  }));
}

export function isRequisitionProduct(productId: string): boolean {
  return ALL_REQUISITION_IDS.has(productId);
}

/**
 * Remplace la quantité totale de réquisition pour un produit/date/type.
 * Ajuste les sorties via un mouvement compensatoire (delta).
 */
export async function setRequisitionTotal(
  date: string,
  type: "salle" | "emporter",
  productId: string,
  productName: string,
  newQuantity: number
): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from("requisitions")
    .select("*")
    .eq("date", date)
    .eq("type", type)
    .eq("product_id", productId);
  if (fetchErr) throw fetchErr;

  const oldTotal = (existing || []).reduce((s, r) => s + r.quantity, 0);
  const delta = newQuantity - oldTotal;

  if ((existing || []).length > 0) {
    const { error: delErr } = await supabase
      .from("requisitions")
      .delete()
      .eq("date", date)
      .eq("type", type)
      .eq("product_id", productId);
    if (delErr) throw delErr;
  }

  if (newQuantity > 0) {
    const { error: insErr } = await supabase
      .from("requisitions")
      .insert({
        date,
        type,
        product_id: productId,
        product_name: productName,
        quantity: newQuantity,
      });
    if (insErr) throw insErr;
  }

  if (delta !== 0) {
    const category = type === "salle" ? "alimentaire" as const : "emballage" as const;
    await saveMovement({
      date,
      productId,
      productName,
      category,
      type: delta > 0 ? "sortie" : "entree",
      quantity: Math.abs(delta),
    });
  }
}
