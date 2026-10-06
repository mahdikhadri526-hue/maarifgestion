import { supabase } from "@/lib/db";
import { supabase as rawSupabase } from "@/integrations/supabase/client";
import { requireCurrentPdvId } from "@/lib/pdvStore";
import { fetchAllRows } from "@/lib/supabasePaginate";

/**
 * Calcul des écarts Café Dubois / Sidi Ali — même principe que la glace,
 * séparé de son calcul. Stockage dans ecart_lines avec une section préfixée
 * (ex. « CAFE:SF_EMP »). Le café se saisit en kg et se calcule en grammes ;
 * Sidi Ali se compte en bouteilles.
 */
export type ProduitKey = "CAFE" | "SIDIALI";
export type Zone = "EMP" | "SP";
export type Part = "SI" | "ENTREE" | "SF";

export const PRODUITS: Record<ProduitKey, { label: string; inputUnit: string; calcUnit: string; factor: number; doseUnit: string }> = {
  CAFE: { label: "Café Dubois", inputUnit: "kg", calcUnit: "g", factor: 1000, doseUnit: "g / article" },
  SIDIALI: { label: "Sidi Ali", inputUnit: "bouteilles", calcUnit: "bouteilles", factor: 1, doseUnit: "bouteille(s) / article" },
};

export interface SaleArticle {
  id: string;
  product: ProduitKey;
  zone: Zone;
  name: string;
  dose: number;
  sort_order: number;
}

/** Une journée : stocks/entrées en unité de saisie (kg ou bouteilles), ventes en quantités. */
export interface ProduitDay {
  SI: Record<Zone, number | null>;
  ENTREE: Record<Zone, number | null>;
  SF: Record<Zone, number | null>;
  VENTES: Record<string, number>; // article id -> quantité vendue
}

export const emptyDay = (): ProduitDay => ({
  SI: { EMP: null, SP: null },
  ENTREE: { EMP: null, SP: null },
  SF: { EMP: null, SP: null },
  VENTES: {},
});

export const hasFinal = (d?: ProduitDay) => !!d && (d.SF.EMP !== null || d.SF.SP !== null);

export interface ProduitResult {
  si: number;
  entrees: number;
  sf: number;
  conso: number;
  ventes: number;
  ecart: number;
}

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Consommation = Stocks initiaux + Entrées − Stocks finaux (Emporter + Salle)
 * Ventes = Σ quantité × dose ; Écart = Ventes − Consommation.
 * Le stock initial est le stock final de la veille s'il existe, sinon la saisie manuelle.
 * Toutes les valeurs du résultat sont dans l'unité de calcul (g pour le café).
 */
export function computeProduitDay(
  product: ProduitKey,
  day: ProduitDay,
  prev: ProduitDay | undefined,
  articles: SaleArticle[],
): ProduitResult {
  const f = PRODUITS[product].factor;
  const siSrc = hasFinal(prev) ? prev!.SF : day.SI;
  const si = (n(siSrc.EMP) + n(siSrc.SP)) * f;
  const entrees = (n(day.ENTREE.EMP) + n(day.ENTREE.SP)) * f;
  const sf = (n(day.SF.EMP) + n(day.SF.SP)) * f;
  const conso = si + entrees - sf;
  const ventes = articles
    .filter((a) => a.product === product)
    .reduce((acc, a) => acc + n(day.VENTES[a.id]) * n(a.dose), 0);
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return { si: r(si), entrees: r(entrees), sf: r(sf), conso: r(conso), ventes: r(ventes), ecart: r(ventes - conso) };
}

export async function fetchArticles(): Promise<SaleArticle[]> {
  const { data, error } = await rawSupabase
    .from("ecart_sale_articles")
    .select("id, product, zone, name, dose, sort_order")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((a: any) => ({ ...a, dose: Number(a.dose) })) as SaleArticle[];
}

export async function addArticle(a: Omit<SaleArticle, "id">) {
  const { error } = await rawSupabase.from("ecart_sale_articles").insert(a);
  if (error) throw error;
}

export async function updateArticle(id: string, patch: Partial<Pick<SaleArticle, "name" | "dose">>) {
  const { error } = await rawSupabase.from("ecart_sale_articles").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteArticle(id: string) {
  const { error } = await rawSupabase.from("ecart_sale_articles").delete().eq("id", id);
  if (error) throw error;
}

const prefix = (p: ProduitKey) => `${p}:`;

export async function fetchProduitDays(product: ProduitKey, start: string, end: string): Promise<Map<string, ProduitDay>> {
  const pdvId = requireCurrentPdvId();
  const rows = await fetchAllRows<{ entry_date: string; section: string; item: string; qty: number }>(() =>
    supabase
      .from("ecart_lines")
      .select("entry_date, section, item, qty")
      .eq("pdv_id", pdvId)
      .like("section", `${prefix(product)}%`)
      .gte("entry_date", start)
      .lte("entry_date", end)
      .order("entry_date")
      .order("section")
      .order("item"),
  );
  const out = new Map<string, ProduitDay>();
  for (const r of rows) {
    const d = out.get(r.entry_date) ?? emptyDay();
    const sec = r.section.slice(prefix(product).length);
    const qty = Number(r.qty);
    if (sec === "VENTE") d.VENTES[r.item] = qty;
    else {
      const [part, zone] = sec.split("_") as [Part, Zone];
      if (d[part] && (zone === "EMP" || zone === "SP")) d[part][zone] = qty;
    }
    out.set(r.entry_date, d);
  }
  return out;
}

export async function saveProduitDay(product: ProduitKey, date: string, day: ProduitDay) {
  const pdv_id = requireCurrentPdvId();
  const rows: { pdv_id: string; entry_date: string; section: string; item: string; qty: number }[] = [];
  const dels: string[] = [];
  for (const part of ["SI", "ENTREE", "SF"] as Part[]) {
    for (const zone of ["EMP", "SP"] as Zone[]) {
      const section = `${prefix(product)}${part}_${zone}`;
      const v = day[part][zone];
      if (v === null) dels.push(section);
      else rows.push({ pdv_id, entry_date: date, section, item: "TOTAL", qty: v });
    }
  }
  for (const [id, q] of Object.entries(day.VENTES)) {
    rows.push({ pdv_id, entry_date: date, section: `${prefix(product)}VENTE`, item: id, qty: n(q) });
  }
  if (dels.length) {
    const { error } = await supabase.from("ecart_lines").delete().eq("entry_date", date).in("section", dels);
    if (error) throw error;
  }
  if (rows.length) {
    const { error } = await supabase.from("ecart_lines").upsert(rows, { onConflict: "pdv_id,entry_date,section,item" });
    if (error) throw error;
  }
}

/** Dernière journée avec stock final avant `date`. */
export function lastFinal(history: Map<string, ProduitDay>, date: string): ProduitDay | undefined {
  const dates = [...history.keys()].filter((d) => d < date).sort().reverse();
  for (const d of dates) if (hasFinal(history.get(d))) return history.get(d);
  return undefined;
}
