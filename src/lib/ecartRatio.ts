import { supabase } from "@/lib/db";
import { requireCurrentPdvId } from "@/lib/pdvStore";

/**
 * Module « Calcul des écarts » — reproduction fidèle du fichier RATIO MAARIF.
 * Toutes les valeurs sont en grammes ; l'équipe ne saisit que des quantités.
 */

export type Section =
  | "VENTE_EMP"
  | "VENTE_SP"
  | "ENTREE_EMP"
  | "ENTREE_SP"
  | "SF_FRIGO_EMP"
  | "SF_TRANSIT_EMP"
  | "SF_CHAMBRE_EMP"
  | "SF_SP"
  | "SI_EMP"
  | "SI_SP";

export interface Item {
  name: string;
  gram: number;
}

/** Parfums + grammage d'un stuff (feuille ENTREE EMPORTER). */
export const PARFUMS: Item[] = [
  { name: "Nougat", gram: 3725 },
  { name: "Praliné", gram: 3672 },
  { name: "Vanille", gram: 3550 },
  { name: "Chocolat", gram: 3696 },
  { name: "Caramel", gram: 3650 },
  { name: "Pistache", gram: 3620 },
  { name: "Parfait", gram: 2020 },
  { name: "Moka", gram: 3670 },
  { name: "Fraise", gram: 4450 },
  { name: "Framboise", gram: 4510 },
  { name: "Orange", gram: 4350 },
  { name: "Pêche", gram: 4263 },
  { name: "Citron", gram: 4279 },
  { name: "Mangue", gram: 4268 },
  { name: "BANANE CARAMILISE", gram: 3745 },
  { name: "ORANGE CANELLE", gram: 4259 },
  { name: "CITRON MENTHE", gram: 4280 },
  { name: "REGLISSE", gram: 3616 },
];

/** Articles vendus — Emporter (feuille VENTES, lignes 17→45). */
export const VENTES_EMP: Item[] = [
  { name: "MILK SHAKE EMP", gram: 180 },
  { name: "SUPP 1B EMP", gram: 60 },
  { name: "CAFE LIEGEOIS EMP", gram: 180 },
  { name: "CHOCOLAT LIEGOIS EM", gram: 180 },
  { name: "ORANGE SHAKE EMP", gram: 180 },
  { name: "JUS PANACHE EMP", gram: 180 },
  { name: "CREPONE CITRON EMP", gram: 180 },
  { name: "MERINGUE GLACEE EMP", gram: 120 },
  { name: "CORNET 1B EMP", gram: 60 },
  { name: "CORNET 2B EMP", gram: 120 },
  { name: "TULIPE 2 b EMP", gram: 120 },
  { name: "TULIPE 3 b EMP", gram: 180 },
  { name: "PETIT POT", gram: 160 },
  { name: "FRESH TOPPING 2B", gram: 120 },
  { name: "FRESH TOPPING  3B", gram: 180 },
  { name: "POT 75", gram: 750 },
  { name: "0,5 L", gram: 500 },
  { name: "1 l", gram: 1000 },
  { name: "STUFF 5,5L", gram: 3846 },
  { name: "BAC 5L", gram: 3496 },
  { name: "BAC 2,5", gram: 1748 },
  { name: "CREPE GLACEE EMP", gram: 70 },
  { name: "GAUFFRE GLACEE EMP", gram: 70 },
  { name: "BROWNIE GLACEE EMP", gram: 70 },
  { name: "ANANAS MELBA EMP", gram: 175 },
  { name: "PECHE MELBA EMP", gram: 255 },
  { name: "FRAISE MELBA EMP", gram: 280 },
  { name: "MACEDOINE DE FRUITS EMP", gram: 120 },
  { name: "AFFOGATO EMP", gram: 170 },
];

/** Articles vendus — Surplace / Salle (feuille VENTES, lignes 51→84). */
export const VENTES_SP: Item[] = [
  { name: "0,5 L", gram: 500 },
  { name: "1 L", gram: 1000 },
  { name: "ANANAS MELBA", gram: 175 },
  { name: "PECHE MELBA", gram: 255 },
  { name: "FRAISE MELBA", gram: 240 },
  { name: "MACEDOINE DE FRUITS", gram: 120 },
  { name: "COUPE MAISON", gram: 250 },
  { name: "COUPE JARDINET", gram: 250 },
  { name: "COUPE REGINA", gram: 250 },
  { name: "COUPE MOKA FOURE", gram: 205 },
  { name: "COUPE MONTJOIE", gram: 250 },
  { name: "COUPE ALASKA", gram: 250 },
  { name: "COUPE GILDA", gram: 250 },
  { name: "GRAND VERRE PANACHE", gram: 320 },
  { name: "COUPE DE GLACE", gram: 205 },
  { name: "MERINGUE GLACEE", gram: 120 },
  { name: "Tulipe 3B SP", gram: 165 },
  { name: "Tulipe 2B SP", gram: 110 },
  { name: "BROWNIE GLACEE SP", gram: 70 },
  { name: "CREPE GLACEE", gram: 70 },
  { name: "GAUFFRE GLACEE", gram: 70 },
  { name: "CORNET 1 B SP", gram: 60 },
  { name: "CORNET 2B SP", gram: 120 },
  { name: "MINI COUPE", gram: 130 },
  { name: "JUS D'ORANGE", gram: 0 },
  { name: "JUS DE CITRON", gram: 0 },
  { name: "MILK SHAKE ", gram: 180 },
  { name: "ORANGE SHAKE", gram: 180 },
  { name: "JUS PANACHE", gram: 180 },
  { name: "CHOC LIEGOIS", gram: 180 },
  { name: "CAFE LIEGEOIS", gram: 180 },
  { name: "CREPONE CITRON", gram: 180 },
  { name: "SUPP 1B SP", gram: 60 },
  { name: "AFFOGATO", gram: 170 },
];

/** Sections saisies en grammes directement (pesée), pas en quantité. */
export const GRAM_SECTIONS: Section[] = ["ENTREE_SP", "SF_FRIGO_EMP", "SF_SP", "SI_EMP", "SI_SP"];

export const SECTION_ITEMS: Record<Section, Item[]> = {
  VENTE_EMP: VENTES_EMP,
  VENTE_SP: VENTES_SP,
  ENTREE_EMP: PARFUMS,
  ENTREE_SP: PARFUMS,
  SF_FRIGO_EMP: PARFUMS,
  SF_TRANSIT_EMP: PARFUMS,
  SF_CHAMBRE_EMP: PARFUMS,
  SF_SP: PARFUMS,
  SI_EMP: [{ name: "TOTAL", gram: 1 }],
  SI_SP: PARFUMS,
};

export type DayData = Record<string, Record<string, number>>;

export interface DayTotals {
  entreeEmpG: number;
  entreeSpG: number;
  sfFrigoG: number;
  sfTransitG: number;
  sfChambreG: number;
  sfEmpG: number;
  sfSpG: number;
  ventesEmpG: number;
  ventesSpG: number;
}

export interface DayResult extends DayTotals {
  date: string;
  siEmpG: number;
  siSpG: number;
  consoEmpG: number;
  consoSpG: number;
  consoTotalG: number;
  ventesTotalG: number;
  ecartEmpG: number;
  ecartSpG: number;
  ecartTotalG: number;
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function sumSection(day: DayData, section: Section): number {
  const map = day?.[section] ?? {};
  const gramInput = GRAM_SECTIONS.includes(section);
  return SECTION_ITEMS[section].reduce((acc, it) => {
    const q = num(map[it.name]);
    return acc + (gramInput ? q : q * it.gram);
  }, 0);
}

export function computeTotals(day: DayData): DayTotals {
  const sfFrigoG = sumSection(day, "SF_FRIGO_EMP");
  const sfTransitG = sumSection(day, "SF_TRANSIT_EMP");
  const sfChambreG = sumSection(day, "SF_CHAMBRE_EMP");
  return {
    entreeEmpG: sumSection(day, "ENTREE_EMP"),
    entreeSpG: sumSection(day, "ENTREE_SP"),
    sfFrigoG,
    sfTransitG,
    sfChambreG,
    sfEmpG: sfFrigoG + sfTransitG + sfChambreG,
    sfSpG: sumSection(day, "SF_SP"),
    ventesEmpG: sumSection(day, "VENTE_EMP"),
    ventesSpG: sumSection(day, "VENTE_SP"),
  };
}

/** A-t-on une saisie de stock final sur cette journée ? */
export function hasFinalStock(day: DayData | undefined): boolean {
  if (!day) return false;
  const t = computeTotals(day);
  return t.sfEmpG !== 0 || t.sfSpG !== 0;
}

/**
 * Calcul d'une journée, formule globale demandée :
 *  Consommation = Total stocks initiaux (Emporter + Salle) + Entrées (Emporter + Salle) − Total stocks finaux (Emporter + Salle)
 *  Ventes = Total des ventes (Surplace + Emporter)
 *  Écart = Consommation − Ventes
 * Le stock initial d'un jour est le stock final de la veille (sinon la saisie manuelle de départ).
 */
export function computeDay(date: string, day: DayData, prev: DayData | undefined): DayResult {
  const t = computeTotals(day);
  const prevTotals = prev ? computeTotals(prev) : null;
  const siEmpG = prevTotals && hasFinalStock(prev) ? prevTotals.sfEmpG : sumSection(day, "SI_EMP");
  const siSpG = prevTotals && hasFinalStock(prev) ? prevTotals.sfSpG : sumSection(day, "SI_SP");

  const siTotalG = siEmpG + siSpG;
  const entreeTotalG = t.entreeEmpG + t.entreeSpG;
  const sfTotalG = t.sfEmpG + t.sfSpG;

  const consoTotalG = siTotalG + entreeTotalG - sfTotalG;
  const ventesTotalG = t.ventesEmpG + t.ventesSpG;
  const ecartTotalG = consoTotalG - ventesTotalG;

  return {
    date,
    ...t,
    siEmpG,
    siSpG,
    consoEmpG: 0,
    consoSpG: 0,
    consoTotalG,
    ventesTotalG,
    ecartEmpG: 0,
    ecartSpG: 0,
    ecartTotalG,
  };
}

export interface EcartLine {
  entry_date: string;
  section: string;
  item: string;
  qty: number;
}

export async function fetchEcartLines(start: string, end: string): Promise<Map<string, DayData>> {
  const pdvId = requireCurrentPdvId();
  const { data, error } = await supabase
    .from("ecart_lines")
    .select("entry_date, section, item, qty")
    .eq("pdv_id", pdvId)
    .gte("entry_date", start)
    .lte("entry_date", end);
  if (error) throw error;
  const days = new Map<string, DayData>();
  for (const r of (data ?? []) as EcartLine[]) {
    const d = days.get(r.entry_date) ?? {};
    d[r.section] = { ...(d[r.section] ?? {}), [r.item]: num(r.qty) };
    days.set(r.entry_date, d);
  }
  return days;
}

export async function saveEcartDay(date: string, day: DayData, sections: Section[]): Promise<void> {
  const pdv_id = requireCurrentPdvId();
  const rows: { pdv_id: string; entry_date: string; section: string; item: string; qty: number }[] = [];
  for (const section of sections) {
    const map = day[section] ?? {};
    for (const it of SECTION_ITEMS[section]) {
      const qty = num(map[it.name]);
      rows.push({ pdv_id, entry_date: date, section, item: it.name, qty });
    }
  }
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("ecart_lines")
    .upsert(rows, { onConflict: "pdv_id,entry_date,section,item" });
  if (error) throw error;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard++ < 400) {
    out.push(cur);
    cur = shiftDate(cur, 1);
  }
  return out;
}

export const fmtG = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(v));
