import { supabase } from "@/integrations/supabase/client";
import { saveMovement, MovementUnit, getProducts } from "./stockData";
import { fetchAllRows } from "@/lib/supabasePaginate";

// Produits à exclure de la réquisition (mais conservés dans le stock global)
const REQUISITION_EXCLUDED_NAMES = [
  "BEURRE LEDDA 250 G",
  "FARINE 10 KGS",
  "HUILLE 500 CL",
  "LEVURE 125 G",
  "POUDRE VANILLE",
  "PROTOXYDE",
  "SEL 1 KG",
  "SUCRE GRANULE 2 KG",
  "SUCRE PERLE 10KG",
];

export interface RequisitionEntry {
  id: string;
  date: string;
  type: "salle" | "emporter";
  productId: string;
  productName: string;
  quantity: number;
  performedBy?: string;
  unitUsed?: MovementUnit;
}

// Tous les produits alimentaires → Réquisition Alimentaire (sauf exclus)
export const REQUISITION_SALLE_IDS: string[] = getProducts("alimentaire")
  .filter((p) => !REQUISITION_EXCLUDED_NAMES.includes(p.name))
  .map((p) => p.id);

// Tous les produits emballage → Réquisition Emballage
export const REQUISITION_EMPORTER_IDS: string[] = getProducts("emballage").map((p) => p.id);

export const ALL_REQUISITION_IDS = new Set<string>([
  ...REQUISITION_SALLE_IDS,
  ...REQUISITION_EMPORTER_IDS,
]);

export async function getRequisitions(): Promise<RequisitionEntry[]> {
  const data = await fetchAllRows<any>(() => supabase.from("requisitions").select("*"));
  return data.map((row: any) => ({
    id: row.id,
    date: row.date,
    type: row.type as "salle" | "emporter",
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    performedBy: row.performed_by || undefined,
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
      performed_by: entry.performedBy || null,
      unit_used: entry.unitUsed || "PIECE",
    } as any)
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
    performedBy: entry.performedBy,
    unitUsed: entry.unitUsed,
  });

  const row: any = data;
  return {
    id: row.id,
    date: row.date,
    type: row.type as "salle" | "emporter",
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    performedBy: row.performed_by || undefined,
  };
}

export async function getRequisitionsByDate(date: string, type: "salle" | "emporter"): Promise<RequisitionEntry[]> {
  const { data, error } = await supabase
    .from("requisitions")
    .select("*")
    .eq("date", date)
    .eq("type", type);
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    date: row.date,
    type: row.type as "salle" | "emporter",
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    performedBy: row.performed_by || undefined,
  }));
}

export function isRequisitionProduct(productId: string): boolean {
  return ALL_REQUISITION_IDS.has(productId);
}

/**
 * Remplace la quantité totale de réquisition pour un produit/date/type.
 * Supprime les sorties existantes liées (même date/produit/catégorie) et
 * recrée une sortie unique si la nouvelle quantité > 0.
 * Évite ainsi de polluer l'historique avec un mouvement "entrée" compensatoire.
 */
export async function setRequisitionTotal(
  date: string,
  type: "salle" | "emporter",
  productId: string,
  productName: string,
  newQuantity: number,
  performedBy?: string
): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from("requisitions")
    .select("*")
    .eq("date", date)
    .eq("type", type)
    .eq("product_id", productId);
  if (fetchErr) throw fetchErr;

  if ((existing || []).length > 0) {
    const { error: delErr } = await supabase
      .from("requisitions")
      .delete()
      .eq("date", date)
      .eq("type", type)
      .eq("product_id", productId);
    if (delErr) throw delErr;
  }

  // Supprimer toutes les sorties de stock existantes pour ce produit/date/catégorie
  // (générées précédemment par les réquisitions). Ainsi le stock se rééquilibre
  // sans créer d'écriture compensatoire "entrée".
  const category = type === "salle" ? ("alimentaire" as const) : ("emballage" as const);
  const { error: delMovErr } = await supabase
    .from("stock_movements")
    .delete()
    .eq("date", date)
    .eq("product_id", productId)
    .eq("category", category)
    .eq("type", "sortie");
  if (delMovErr) throw delMovErr;

  if (newQuantity > 0) {
    const { error: insErr } = await supabase
      .from("requisitions")
      .insert({
        date,
        type,
        product_id: productId,
        product_name: productName,
        quantity: newQuantity,
        performed_by: performedBy || null,
        unit_used: "PIECE",
      } as any);
    if (insErr) throw insErr;

    // Recrée une sortie unique correspondant à la nouvelle quantité totale
    await saveMovement({
      date,
      productId,
      productName,
      category,
      type: "sortie",
      quantity: newQuantity,
      performedBy,
    });
  }
}
