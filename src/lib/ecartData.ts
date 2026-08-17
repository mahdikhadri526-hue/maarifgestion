import { supabase } from "@/lib/db";
import { requireCurrentPdvId } from "@/lib/pdvStore";

export type EcartZone = "EMPORTER" | "SURPLACE";

export interface EcartEntry {
  id: string;
  pdv_id: string;
  entry_date: string;
  produit: string;
  categorie: string;
  zone: EcartZone;
  stock_initial: number;
  entrees: number;
  stock_final: number;
  ventes: number;
  performed_by: string | null;
  notes: string | null;
}

/** Catalogue des produits suivis (référence fichier RATIO). */
export const ECART_PRODUCTS: { name: string; categorie: string }[] = [
  "Nougat",
  "Praliné",
  "Vanille",
  "Chocolat",
  "Caramel",
  "Pistache",
  "Parfait",
  "Moka",
  "Fraise",
  "Framboise",
  "Orange",
  "Pêche",
  "Citron",
  "Mangue",
  "Banane caramélisée",
  "Orange cannelle",
  "Citron menthe",
  "Réglisse",
].map((name) => ({ name, categorie: "GLACE" }));

export const ECART_CATEGORIES = Array.from(
  new Set(ECART_PRODUCTS.map((p) => p.categorie)),
);

export const ECART_ZONES: EcartZone[] = ["EMPORTER", "SURPLACE"];

/** Consommation = Stock initial + Entrées − Stock final (logique fichier RATIO). */
export function computeConsommation(e: {
  stock_initial: number;
  entrees: number;
  stock_final: number;
}): number {
  return num(e.stock_initial) + num(e.entrees) - num(e.stock_final);
}

/** Écart = Ventes − Consommation. */
export function computeEcart(e: {
  stock_initial: number;
  entrees: number;
  stock_final: number;
  ventes: number;
}): number {
  return num(e.ventes) - computeConsommation(e);
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export async function fetchEcartEntries(
  start: string,
  end: string,
): Promise<EcartEntry[]> {
  const pdvId = requireCurrentPdvId();
  const { data, error } = await supabase
    .from("ecart_entries")
    .select("*")
    .eq("pdv_id", pdvId)
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: true })
    .order("zone", { ascending: true })
    .order("produit", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EcartEntry[];
}

/** Stock final de la veille par (produit|zone) — sert de stock initial du jour. */
export async function fetchPreviousFinals(
  date: string,
): Promise<Map<string, number>> {
  const pdvId = requireCurrentPdvId();
  const prev = shiftDate(date, -1);
  const { data, error } = await supabase
    .from("ecart_entries")
    .select("produit, zone, stock_final")
    .eq("pdv_id", pdvId)
    .eq("entry_date", prev);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const r of data ?? []) {
    map.set(`${r.produit}|${r.zone}`, num(r.stock_final));
  }
  return map;
}

export async function saveEcartEntries(
  rows: {
    entry_date: string;
    produit: string;
    categorie: string;
    zone: EcartZone;
    stock_initial: number;
    entrees: number;
    stock_final: number;
    ventes: number;
    performed_by?: string | null;
  }[],
): Promise<void> {
  if (rows.length === 0) return;
  const pdv_id = requireCurrentPdvId();
  const { error } = await supabase
    .from("ecart_entries")
    .upsert(
      rows.map((r) => ({ ...r, pdv_id })),
      { onConflict: "pdv_id,entry_date,produit,zone" },
    );
  if (error) throw error;
}

export async function deleteEcartEntry(id: string): Promise<void> {
  const { error } = await supabase.from("ecart_entries").delete().eq("id", id);
  if (error) throw error;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const last = new Date(y, m, 0).getDate();
  return { start, end: `${month}-${String(last).padStart(2, "0")}` };
}
