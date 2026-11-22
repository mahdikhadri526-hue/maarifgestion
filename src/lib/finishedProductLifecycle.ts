import { supabase } from "@/integrations/supabase/client";

// Retain recipe identities and production history; removal is a catalog archive.
export async function archiveFinishedProduct(id: string, canEdit: boolean) {
  if (!canEdit) throw new Error("Modification non autorisée");
  const { data, error } = await supabase.from("finished_products")
    .update({ active: false }).eq("id", id).select("id").single();
  if (error) throw error;
  if (!data) throw new Error("Produit non supprimé");
}