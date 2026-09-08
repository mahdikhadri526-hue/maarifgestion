import { supabase } from "@/lib/db";
import { requireCurrentPdvId } from "@/lib/pdvStore";

export type ClaimKind = "reclamation" | "retour";

export interface ClaimEntry {
  id: string;
  kind: ClaimKind;
  entryDate: string;
  entryTime: string | null;
  manager: string | null;
  origine: string | null;
  claimType: string | null;
  produit: string | null;
  description: string | null;
  actionCorrective: string | null;
  createdAt: string;
}

export const CLAIM_ORIGINES = ["Client", "Collaborateur"];

export const CLAIM_TYPES = [
  "Qualité du produit",
  "Qualité du service",
  "Infrastructure",
  "Climat Social",
  "Manque du Matériel",
  "Autres",
];

export const CLAIM_PRODUITS = [
  "Ananas Melba", "Pêche Melba", "Fraise Melba", "Macédoine de fruits", "Coupe Maison",
  "Coupe Jardinet", "Coupe Crème Régina", "Coupe Moka Fourrée", "Coupe Montjoie", "Coupe Alaska",
  "Coupe Gilda", "Grand verre panaché", "Coupe Chantilly", "Coupe de Glace", "Maria Louisa",
  "Maria Bianca Mangue", "Maria Bianca Framboise", "Meringue Glacée", "Tulipe 3 boules",
  "Tulipe 2 boules", "Tranche Sorbet Mangue", "Tranche Macarons", "Tranche Napolitaine",
  "Mafalda", "Mafalda Spéciale", "Cassate Sicilienne", "Brownie Nature", "Brownie Glacé",
  "Gaufre Nature", "Gaufre Glacée", "Crêpe Nature", "Crêpe Glacée", "Tranche de Cake marbré",
  "Tranche de cake au citron", "Pain de savoie", "Macaron", "1 Viennoiserie",
  "Assortiment Viennoiserie", "Cornet 1B", "Cornet 2B", "Maria Loulou", "Mini coupe",
  "Jus d'orange", "Jus de citron", "Milk Shake", "Orange Shake", "Jus panaché",
  "Chocolat liégeois", "Café liégeois", "Crêponné de citron", "Eau minérale 50 cl",
  "Eau minérale 33 cl", "Eau Gazeuse", "Chocolat Chaud", "Chocolat Viennois",
  "Cappuccino Sicilien", "Lait Chaud", "Lait Parfumé", "Cappuccino", "Thé noir au lait",
  "Thé noir", "Verveine", "Verveine au lait", "Thé à la menthe", "Thé Tchaba", "Café Crème",
  "Café Noir", "Nespresso", "Café Allongé", "Sup topping", "Sup Chantilly",
  "Sup Amandes caramilisées", "Sup Sachet Normal", "Sup Sachet Tchaba", "Sup boule de glace",
  "Sup Cornet vide", "Sup Tulipe vide", "Petit Déj Viennoiserie", "Petit Déj au Cake",
  "Petit Déj Crêpe", "PETIT POT", "POT 75 CL", "POT PANACHE", "POT CHANTILLY 4",
  "POT CHANTILLY 8", "POT CHANTILLY 20", "POT SICILIENNE FRAIS", "POT SICILIENNE MANGU",
  "POT SICILIENNE CHOCO", "POT SICILIENNE VANIL", "FRESH TOPPINGS 3 B", "FRESH TOPPINGS 2 B",
  "BARQUETTE 1/2 L", "BARQUETTE 1 L", "GLACE 5L", "1 MACARON", "BOITE 6 MACARONS",
  "BOITE 12 MACARONS", "PLATEAU MACARONS", "SACHET MERINGUES", "SACHET GAUFRETES",
  "TARTE DE 6 EMP.", "CASSATE SICILIEN.EMP", "TARTE 10 EMP.", "TARTE SPECIALE EMP.",
  "TRTE.SRBT.MACARON EM", "TARTE 12 EMP", "TARTE 8 SPEC.EMP", "TARTE MACARON EMP",
  "TRCH.NAPOLITAINE EMP", "TRCH. MACARON EMP", "BUCHE SPECIALE EMP", "BUCHE EMP.",
];

function mapRow(r: any): ClaimEntry {
  return {
    id: r.id,
    kind: r.kind,
    entryDate: r.entry_date,
    entryTime: r.entry_time,
    manager: r.manager,
    origine: r.origine,
    claimType: r.claim_type,
    produit: r.produit,
    description: r.description,
    actionCorrective: r.action_corrective,
    createdAt: r.created_at,
  };
}

export async function getClaims(kind: ClaimKind): Promise<ClaimEntry[]> {
  const pdvId = requireCurrentPdvId();
  const { data, error } = await supabase
    .from("claims_returns" as any)
    .select("*")
    .eq("pdv_id", pdvId)
    .eq("kind", kind)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function addClaim(entry: Omit<ClaimEntry, "id" | "createdAt">) {
  const pdvId = requireCurrentPdvId();
  const { error } = await supabase.from("claims_returns" as any).insert({
    pdv_id: pdvId,
    kind: entry.kind,
    entry_date: entry.entryDate,
    entry_time: entry.entryTime,
    manager: entry.manager,
    origine: entry.origine,
    claim_type: entry.claimType,
    produit: entry.produit,
    description: entry.description,
    action_corrective: entry.actionCorrective,
  });
  if (error) throw error;
}

export async function deleteClaim(id: string) {
  const { error } = await supabase.from("claims_returns" as any).delete().eq("id", id);
  if (error) throw error;
}
