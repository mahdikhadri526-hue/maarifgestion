import { supabase } from "@/lib/db";
import { supabase as rawSupabase } from "@/integrations/supabase/client";
import { requireCurrentPdvId } from "@/lib/pdvStore";
import { fetchAllRows } from "@/lib/supabasePaginate";
import { cached, invalidateTables } from "@/lib/requestCache";

export type Category = "alimentaire" | "emballage";
export type UnitType = "PIECE" | "KILO" | "LITRE" | "PAQUET" | "COLIS" | "ROULEAU";
export type MovementUnit = "CARTON" | "PAQUET" | "PIECE";

export interface ProductUnitConfig {
  cartonEnabled: boolean;
  paquetEnabled: boolean;
  piecesPerCarton: number;
  piecesPerPaquet: number;
}

export const DEFAULT_UNIT_CONFIG: ProductUnitConfig = {
  cartonEnabled: false,
  paquetEnabled: false,
  piecesPerCarton: 1,
  piecesPerPaquet: 1,
};

// Overrides du label "pièce" pour des produits vendus en vrac (kg, L, etc.)
// Clé = product id (ex: "ali-1" pour SMARTIES TOPPING)
export const PIECE_LABEL_OVERRIDES: Record<string, { singular: string; plural: string; short: string }> = {
  "ali-1": { singular: "Kg", plural: "Kg", short: "kg" }, // SMARTIES TOPPING
  "ali-7": { singular: "Kg", plural: "Kg", short: "kg" }, // CAFE BRESIL — saisie en Kg
};

// Override du label "paquet" pour des produits configurés en multi-conditionnement
export const PAQUET_LABEL_OVERRIDES: Record<string, string> = {
};

// Produits pour lesquels l'unité "Pièces" doit être masquée (saisie en paquets uniquement)
export const HIDE_PIECE_PRODUCTS: Set<string> = new Set([
  "emb-43", // MASQUE
  "emb-44", // GANT
]);

// Produits masqués de la liste (données conservées, filtrés à l'affichage)
export const HIDDEN_PRODUCT_IDS: Set<string> = new Set([
  "ali-10", // CIGARE
  "emb-21", // BANDE SOUS COUVERCLE 0,5L
]);

const HIDDEN_PRODUCT_NAME_PATTERNS = [
  /^CIGARE\b/,
  /^BANDE\s+SOUS\s+COUVERCLE\s+0[,.]5\s*L\b/,
];

function isHiddenProduct(product: Pick<Product, "id" | "name">): boolean {
  const normalizedName = product.name.trim().toUpperCase().replace(/\s+/g, " ");
  return HIDDEN_PRODUCT_IDS.has(product.id) || HIDDEN_PRODUCT_NAME_PATTERNS.some((pattern) => pattern.test(normalizedName));
}

export function getPieceLabel(productId: string): { singular: string; plural: string; short: string } {
  return PIECE_LABEL_OVERRIDES[productId] || { singular: "Pièce", plural: "Pièces", short: "pcs" };
}

// Retourne le label d'unité à afficher pour un produit donné.
// Pour les produits alimentaires sans override explicite, on détecte l'unité naturelle
// depuis le nom (Kg, L, etc.) afin de toujours afficher l'unité concrète.
export function getPieceLabelForProduct(productId: string, productName?: string, category?: Category): { singular: string; plural: string; short: string } {
  if (PIECE_LABEL_OVERRIDES[productId]) return PIECE_LABEL_OVERRIDES[productId];
  if (category === "alimentaire" && productName) {
    const u = detectProductUnit(productName);
    if (u && u !== "Pièce") {
      return { singular: u, plural: u, short: u.toLowerCase() };
    }
  }
  return { singular: "Pièce", plural: "Pièces", short: "pcs" };
}

export interface Product {
  id: string;
  name: string;
  conditionnement: string;
  category: Category;
  initialStock: number;
}

function parseProduct(raw: string): { name: string; conditionnement: string } {
  const match = raw.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (match) return { name: match[1].trim(), conditionnement: match[2].trim() };
  return { name: raw.trim(), conditionnement: "" };
}

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  category: Category;
  type: "entree" | "sortie";
  quantity: number;
  performedBy?: string;
  unitUsed?: MovementUnit;
  destination?: string;
  createdAt?: string;
  source?: string;
}

export interface StockLevel {
  productId: string;
  productName: string;
  conditionnement: string;
  unit: UnitType;
  category: Category;
  stockInitial: number;
  totalEntrees: number;
  totalSorties: number;
  stockRestant: number;
}

export function roundStockQuantity(value: number): number {
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

export function movementPiecesToDisplay(
  quantity: number,
  unit: UnitType,
  config?: ProductUnitConfig,
  productId?: string,
): number {
  // Le changement d'unité est uniquement un changement de libellé :
  // aucune conversion, aucune exception produit, le stock restant reste identique.
  return roundStockQuantity(quantity);
}

export function displayQuantityForProduct(productId: string, quantity: number, config?: ProductUnitConfig): number {
  return roundStockQuantity(quantity);
}

export function formatQuantityForProduct(productId: string, quantity: number, config?: ProductUnitConfig): string {
  const displayQuantity = displayQuantityForProduct(productId, quantity, config);
  if (HIDE_PIECE_PRODUCTS.has(productId) && config?.paquetEnabled && config.piecesPerPaquet > 0) {
    if (quantity % config.piecesPerPaquet === 0) {
      return `${quantity / config.piecesPerPaquet} paq.`;
    }
    return `${quantity} pcs`;
  }
  return String(displayQuantity);
}

const ALIMENTAIRE_PRODUCTS = [
  "__HIDDEN__",
  "SMARTIES TOPPING (20 KG)",
  "OREO TOPPING (BOITE 24 P)",
  "SIDI ALI 0,33 (PAQUET = 12P)",
  "SIDI ALI 0,5 (PAQUET = 12P)",
  "LAIT UHT (100CL)",
  "OULMESS P (PAQUET = 12P)",
  "CAFE BRESIL (1KG)",
  "PECHE CONSERVE (BOITE = 420 G)",
  "SIROP CHOCOLAT (1KG)",
  "CIGARE (BOITE = 156 P)",
  "THE SULTAN (1 KG)",
  "VERVINE NORMALE (50 P)",
  "TCHABA VERVEINE DOUCE",
  "__HIDDEN__",
  "NESTLE CARAMEL (397 G)",
  "BEURRE LEDDA 250 G",
  "LEVURE 125 G",
  "HUILLE 500 CL",
  "FARINE 10 KGS",
  "SEL 1 KG",
  "NUTELLA 750 G",
  "SUCRE GRANULE 2 KG",
  "SUCRE PERLE 10KG",
  "SUCRE PERSONNALISE",
  "CHOCOLTA CLASSIC",
  "SIROP GRENADINE",
  "SIROP MENTHE",
  "MIEL",
  "NESPRESSO NOIR",
  "NESPRESSO MARRON",
  "NESPRESSO ROUGE",
  "NESPRESSO VERT",
  "TCHABA GARDEN",
  "TCHABA VERT",
  "TCHABA GINGEMBRE",
  "TCHABA JASMIN",
  "TCHABA EARL",
  "TCHABA MENTHE",
  "TCHABA PEACEFUL",
  "TCHABA BREAKFAST",
  "__HIDDEN__",
  "POUDRE VANILLE",
  "__HIDDEN__",
  "PROTOXYDE",
  "EAU 5L",
  "THE NOIR",
  "CONFITURE PECHE",
  "CONFITURE FRAISE",
  "OEUFS",
  "__HIDDEN__",
  "__HIDDEN__",
  "__HIDDEN__",
  "__HIDDEN__",
  "__HIDDEN__",
  "__HIDDEN__",
  "__HIDDEN__",
  "GLACE",
  "TOPPINGS",
];

const EMBALLAGE_PRODUCTS = [
  "PETIT POT (CARTON = 1764 P)",
  "SOUS VERRE (PAQUET = 1500 P)",
  "CUILLERE BLANCHE (CARTON = 9600 P)",
  "SERVIETTE PP (PAQUET = 50P)",
  "BANDE PP (PAQUET = 4000 P)",
  "SUPPORT 4 (PAQUET = 300 P)",
  "SUPPORT 6 (PAQUET = 300 P)",
  "POT 75 CL (CARTON = 576P)",
  "CVC POT 75 CL (CARTON = 1152 P)",
  "POT TOPPING 2B (CARTON = 1900 P)",
  "POT TOPPING 3B (CARTON = 1260 P)",
  "BARQUETTE A EMPORTER (PAQUET = 500 P)",
  "PORTE 2 CERCLE PETIT",
  "PORTE 2 CERCLE GRAND",
  "PORTE 4 CERCLE PETIT",
  "PORTE 4 CERCLE GRANG",
  "CUILLERE TRANSPARENTE (CARTON = 1000 P)",
  "BARQUETTE 1L (PAQUET = 10 P)",
  "BARQUETTE 0,5L (CARTON = 360 P)",
  "BANDE BARQUETTE 1L (PAQUET = 500 P)",
  "BANDE BARQUETTE 0,5L (PAQUET = 500 P)",
  "BANDE SOUS COUVERCLE 0,5L (PAQUET = 300 P)",
  "STICKERS ROND (ROULEAU = 4008 P)",
  "PAPIERS ALUMINIUM",
  "FILM ALIMENTAIRE",
  "PAILLE (SACHET = 1000 P)",
  "BOUGIE",
  "GOBLET 8 OZ",
  "CVC GOBLET 8 OZ",
  "GOBLET 4 OZ",
  "CVC GOBLET 4 OZ",
  "GOBLET 14 OZ",
  "CVC GOBLET 14 OZ",
  "SAC BARQUETTE (SACHET = 100 P)",
  "SAC A TARTES (SACHET = 100 P)",
  "SAC PANACHE (SACHET = 50 P)",
  "FICELLE (SACHET = 1000 P)",
  "SACHET MERINGUE (CARTON = 2000 P)",
  "ETIQUETTE GAUFRETTE (SACHET = 500 P)",
  "BOITES A TARTES",
  "BOITES A BUCHES",
  "ROULEAUX DE CAISSE",
  "ROULEAUX TPE",
  "MASQUE (PAQUET = 50 P)",
  "GANT",
  "PAPIER ESSUIE-TOUT",
  "PAPIER HYGIENIQUE",
  "BAC 2.5",
  "CVC BAC 2.5",
  "ETIQUETTES MERINGUE",
];

export interface ProductCatalogRow {
  id: string;
  productId: string;
  category: Category;
  name: string;
  conditionnement: string;
  hidden: boolean;
  sortOrder: number;
}

let PRODUCT_CATALOG: ProductCatalogRow[] = [];

/** Remplace le catalogue personnalisé en mémoire (chargé depuis la base). */
export function setProductCatalog(rows: ProductCatalogRow[]): void {
  PRODUCT_CATALOG = rows;
}

export function getProductCatalog(): ProductCatalogRow[] {
  return PRODUCT_CATALOG;
}

/** Applique les modifications, masquages et ajouts du catalogue aux produits d'origine. */
function applyCatalog(base: Product[]): Product[] {
  if (PRODUCT_CATALOG.length === 0) return base;
  const byId = new Map(PRODUCT_CATALOG.map((r) => [r.productId, r]));
  const result: Product[] = [];
  base.forEach((p) => {
    const o = byId.get(p.id);
    if (!o) {
      result.push(p);
      return;
    }
    byId.delete(p.id);
    if (o.hidden) return;
    result.push({
      ...p,
      name: o.name || p.name,
      conditionnement: o.conditionnement ?? p.conditionnement,
      category: o.category || p.category,
    });
  });
  byId.forEach((o) => {
    if (o.hidden) return;
    result.push({
      id: o.productId,
      name: o.name,
      conditionnement: o.conditionnement ?? "",
      category: o.category,
      initialStock: 0,
    });
  });
  return result;
}

export function getProducts(category?: Category): Product[] {
  const ali = ALIMENTAIRE_PRODUCTS.map((raw, i) => {
    const { name, conditionnement } = parseProduct(raw);
    return { id: `ali-${i}`, name, conditionnement, category: "alimentaire" as Category, initialStock: 0 };
  }).filter((p) => p.name !== "__HIDDEN__" && !isHiddenProduct(p));
  const emb = EMBALLAGE_PRODUCTS.map((raw, i) => {
    const { name, conditionnement } = parseProduct(raw);
    return { id: `emb-${i}`, name, conditionnement, category: "emballage" as Category, initialStock: 0 };
  }).filter((p) => p.name !== "__HIDDEN__" && !isHiddenProduct(p));
  const sortByName = (a: Product, b: Product) =>
    a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  const applied = applyCatalog([...ali, ...emb]);
  const aliF = applied.filter((p) => p.category === "alimentaire").sort(sortByName);
  const embF = applied.filter((p) => p.category === "emballage").sort(sortByName);
  if (category === "alimentaire") return aliF;
  if (category === "emballage") return embF;
  return [...aliF, ...embF];
}

// Détecte l'unité naturelle d'un produit selon son nom (huile→Litre, sucre→Kg, etc.)
export function detectProductUnit(name: string): string {
  const n = name.toUpperCase();
  // Produit calculé : Glace agrégée depuis le Suivi Hebdo (kg)
  if (n === "GLACE") return "Kg";
  // Overrides explicites demandés par l'utilisateur → Pièce
  if (/OREO|SIDI ALI|OULMESS|SULTAN|\bSEL\b|THE NOIR|EAU\s*5\s*L|LEVURE/.test(n)) return "Pièce";
  // Huile → Litre
  if (/HUILE|HUILLE/.test(n)) return "L";
  // Chocolat classique → Kilo
  if (/CHOCOLT?A?\s*CLASSIC/.test(n)) return "Kg";
  if (/SIROP|LAIT|EAU|NUTELLA|MIEL|CONFITURE|PROTOXYDE/.test(n)) {
    if (/\bL\b|LITRE|CL|ML/.test(n) || /SIROP|LAIT|EAU/.test(n)) return "L";
  }
  if (/\bKG\b|KILO|FARINE|SUCRE|CAFE|THE\b|VANILLE|TOPPING/.test(n)) return "Kg";
  // Fruits vendus au kilo
  if (/\bKIWI\b|\bORANGE\b|\bCITRON\b|\bFRAISE\b|\bPOIRE\b|\bPOMME\b/.test(n)) return "Kg";
  if (/PAPIER|FILM|ALUMINIUM|ROULEAU/.test(n)) return "Rouleau";
  if (/SACHET/.test(n)) return "Sachet";
  return "Pièce";
}

// ===== Async Supabase functions =====

// Lignes « Mouvement glaces & tartes » du suivi hebdo : table volumineuse,
// partagée entre plusieurs calculs → mise en cache courte.
export function getGlaceWeeklyRows(): Promise<any[]> {
  const pdvId = requireCurrentPdvId();
  return cached(`weeklyGlaceRows:${pdvId}`, ["weekly_tracking"], () =>
    fetchAllRows<any>(() =>
      supabase
        .from("weekly_tracking")
        .select("article, entrees, sorties, stock_initial, day_of_week, week_start, row_index")
        .eq("fiche_type", "Mouvement glaces & tartes"),
    ),
  );
}

function getGlaceGrammageRes(): Promise<any> {
  return cached("glaceGrammage", ["glace_grammage"], async () =>
    supabase.from("glace_grammage").select("article, grammage_grams"),
  );
}

export function invalidateStockCaches(tables: string[]) {
  invalidateTables(tables);
}

export interface MovementAggregate {
  productName?: string;
  category?: Category;
  entrees: number;
  sorties: number;
  regularisationsNet: number;
  entreesAll: number;
  sortiesAll: number;
}

/**
 * Agrégats des mouvements calculés côté base (RPC) : évite de télécharger
 * l'intégralité de `stock_movements` pour afficher le stock restant.
 */
export function getMovementAggregates(): Promise<Map<string, MovementAggregate>> {
  const pdvId = requireCurrentPdvId();
  return cached(`movementAggregates:${pdvId}`, ["stock_movements"], async () => {
    const { data, error } = await rawSupabase.rpc("stock_movement_aggregates", {
      _pdv_id: pdvId,
    });
    if (error) throw error;
    const map = new Map<string, MovementAggregate>();
    for (const r of (data as any[]) || []) {
      map.set(r.product_id, {
        productName: r.product_name || undefined,
        category: r.category === "emballage" ? "emballage" : "alimentaire",
        entrees: Number(r.entrees) || 0,
        sorties: Number(r.sorties) || 0,
        regularisationsNet: Number(r.regularisations_net) || 0,
        entreesAll: Number(r.entrees_all) || 0,
        sortiesAll: Number(r.sorties_all) || 0,
      });
    }
    return map;
  });
}

type InitialStockRecord = {
  product_id: string;
  quantity: number;
  unit: string | null;
  carton_enabled: boolean | null;
  paquet_enabled: boolean | null;
  pieces_per_carton: number | null;
  pieces_per_paquet: number | null;
};

function getInitialStockRecords(): Promise<InitialStockRecord[]> {
  const pdvId = requireCurrentPdvId();
  return cached(`initialStockRecords:${pdvId}`, ["initial_stocks"], async () => {
    const { data, error } = await supabase
      .from("initial_stocks")
      .select("product_id, quantity, unit, carton_enabled, paquet_enabled, pieces_per_carton, pieces_per_paquet");
    if (error) throw error;
    return (data || []) as InitialStockRecord[];
  });
}




export async function getMovements(): Promise<StockMovement[]> {
  const pdvId = requireCurrentPdvId();
  return cached(`movements:${pdvId}`, ["stock_movements"], async () => {
  const data = await fetchAllRows<any>(() =>
    supabase
      .from("stock_movements")
      .select(
        "id, date, product_id, product_name, category, type, quantity, performed_by, unit_used, destination, created_at, source",
      )
      .order("created_at", { ascending: false }),
  );
  return data.map((row: any) => ({
    id: row.id,
    date: row.date,
    productId: row.product_id,
    productName: row.product_name,
    category: row.category as Category,
    type: row.type as "entree" | "sortie",
    quantity: row.quantity,
    performedBy: row.performed_by || undefined,
    unitUsed: (row.unit_used as MovementUnit) || "PIECE",
    destination: row.destination || undefined,
    createdAt: row.created_at || undefined,
    source: row.source || undefined,
  }));
  });
}

export async function saveMovement(movement: Omit<StockMovement, "id">): Promise<StockMovement> {
  const { data, error } = await supabase
    .from("stock_movements")
    .insert({
      date: movement.date,
      product_id: movement.productId,
      product_name: movement.productName,
      category: movement.category,
      type: movement.type,
      quantity: movement.quantity,
      performed_by: movement.performedBy || null,
      unit_used: movement.unitUsed || "PIECE",
      destination: movement.destination || null,
      source: movement.source || null,
    } as any)
    .select()
    .single();
  if (error) throw error;
  const row: any = data;

  // Auto-consume FIFO from lots for any "sortie" on alimentaire
  if (movement.type === "sortie" && movement.category === "alimentaire" && movement.quantity > 0) {
    try {
      const { syncLotBalances } = await import("./lotBalance");
      await syncLotBalances(movement.productId, true);
    } catch (e) {
      console.error("FIFO consumption failed", e);
    }
  }

  return {
    id: row.id,
    date: row.date,
    productId: row.product_id,
    productName: row.product_name,
    category: row.category as Category,
    type: row.type as "entree" | "sortie",
    quantity: row.quantity,
    performedBy: row.performed_by || undefined,
    unitUsed: (row.unit_used as MovementUnit) || "PIECE",
    destination: row.destination || undefined,
  };
}

export async function deleteMovement(id: string) {
  const { error } = await supabase.from("stock_movements").delete().eq("id", id);
  if (error) throw error;
}

export async function getInitialStocks(): Promise<Record<string, number>> {
  const pdvId = requireCurrentPdvId();
  return cached(`initialStocks:${pdvId}`, ["initial_stocks"], async () => {
  const data = await getInitialStockRecords();
  const result: Record<string, number> = {};
  data.forEach((row) => {
    result[row.product_id] = row.quantity;
  });
  return result;
  });
}

export async function getProductUnits(): Promise<Record<string, UnitType>> {
  const pdvId = requireCurrentPdvId();
  return cached(`productUnits:${pdvId}`, ["initial_stocks"], async () => {
  const data = await getInitialStockRecords();
  const result: Record<string, UnitType> = {};
  data.forEach((row) => {
    result[row.product_id] = (row.unit as UnitType) || "PIECE";
  });
  return result;
  });
}

export async function getProductUnitConfigs(): Promise<Record<string, ProductUnitConfig>> {
  const pdvId = requireCurrentPdvId();
  return cached(`productUnitConfigs:${pdvId}`, ["initial_stocks"], async () => {
  const data = await getInitialStockRecords();
  const result: Record<string, ProductUnitConfig> = {};
  data.forEach((row) => {
    result[row.product_id] = {
      cartonEnabled: !!row.carton_enabled,
      paquetEnabled: !!row.paquet_enabled,
      piecesPerCarton: row.pieces_per_carton || 1,
      piecesPerPaquet: row.pieces_per_paquet || 1,
    };
  });
  return result;
  });
}

export async function setProductUnitConfig(productId: string, config: Partial<ProductUnitConfig>) {
  const payload: any = { product_id: productId };
  if (config.cartonEnabled !== undefined) payload.carton_enabled = config.cartonEnabled;
  if (config.paquetEnabled !== undefined) payload.paquet_enabled = config.paquetEnabled;
  if (config.piecesPerCarton !== undefined) payload.pieces_per_carton = Math.max(1, config.piecesPerCarton);
  if (config.piecesPerPaquet !== undefined) payload.pieces_per_paquet = Math.max(1, config.piecesPerPaquet);
  const { error } = await supabase
    .from("initial_stocks")
    .upsert(payload, { onConflict: "product_id" });
  if (error) throw error;
}

export async function setProductUnit(productId: string, unit: UnitType) {
  const { error } = await supabase
    .from("initial_stocks")
    .upsert({ product_id: productId, unit }, { onConflict: "product_id" });
  if (error) throw error;
}

export async function setInitialStock(productId: string, quantity: number) {
  const { error } = await supabase
    .from("initial_stocks")
    .upsert({ product_id: productId, quantity }, { onConflict: "product_id" });
  if (error) throw error;
}

export async function getMinStocks(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("initial_stocks").select("product_id, min_quantity");
  if (error) throw error;
  const result: Record<string, number> = {};
  (data || []).forEach((row: any) => {
    result[row.product_id] = Number(row.min_quantity) || 0;
  });
  return result;
}

export async function setMinStock(productId: string, minQuantity: number) {
  const { error } = await supabase
    .from("initial_stocks")
    .upsert({ product_id: productId, min_quantity: minQuantity } as any, { onConflict: "product_id" });
  if (error) throw error;
}

// Agrégat « TOPPINGS » : SMARTIES TOPPING + OREO TOPPING (table alimentaire)
// + ingrédients tartes saisis dans le Suivi Hebdo « Mouvement glaces & tartes ».
export const TOPPINGS_ALI_PRODUCT_IDS = ["ali-1", "ali-2"]; // SMARTIES TOPPING, OREO TOPPING
export const TOPPINGS_WEEKLY_ARTICLES = [
  "Biscuit",
  "Brownies.Top",
  "Noix.Top",
  "Amandes.Top",
  "Ananas fruits",
  "Kiwi fruits",
];


function getToppingsWeeklyRes(): Promise<any> {
  const pdvId = requireCurrentPdvId();
  return cached(`weeklyToppingsRows:${pdvId}`, ["weekly_tracking"], async () =>
    supabase
      .from("weekly_tracking")
      .select("article, entrees, sorties, stock_initial, day_of_week, week_start, row_index")
      .eq("fiche_type", "Mouvement glaces & tartes")
      .in("article", TOPPINGS_WEEKLY_ARTICLES),
  );
}

export async function getToppingsAggregate(): Promise<{ entrees: number; sorties: number; stockInitial: number; stockRestant: number }> {
  const pdvId = requireCurrentPdvId();
  return cached(
    `toppingsAggregate:${pdvId}`,
    ["stock_movements", "initial_stocks", "weekly_tracking"],
    computeToppingsAggregate,
  );
}

async function computeToppingsAggregate(): Promise<{ entrees: number; sorties: number; stockInitial: number; stockRestant: number }> {
  const [aggregates, initialStocks, weeklyRes] = await Promise.all([
    getMovementAggregates(),
    getInitialStocks(),
    getToppingsWeeklyRes(),
  ]);

  let stockInitial = 0;
  let entrees = 0;
  let sorties = 0;
  let stockRestant = 0;

  // 1) Source : table alimentaire (SMARTIES + OREO)
  for (const pid of TOPPINGS_ALI_PRODUCT_IDS) {
    const init = initialStocks[pid] || 0;
    const agg = aggregates.get(pid);
    const e = roundStockQuantity(agg?.entreesAll ?? 0);
    const s = roundStockQuantity(agg?.sortiesAll ?? 0);

    stockInitial += init;
    entrees += e;
    sorties += s;
    stockRestant += init + e - s;
  }

  // 2) Source : Suivi Hebdo — somme directe des colonnes saisies pour chaque article ciblé.
  // stockInitial = dernier SI saisi par article ; entrées/sorties = somme de toute l'historique.
  type DayAgg = { date: string; si: number | null; entries: number; sortieCol: number };
  const byArticle = new Map<string, DayAgg[]>();
  ((weeklyRes as any).data || []).forEach((r: any) => {
    if (!r.article) return;
    const key = `${r.week_start}__${r.day_of_week}__${r.article}`;
    let list = byArticle.get(r.article);
    if (!list) { list = []; byArticle.set(r.article, list); }
    list.push({
      date: `${r.week_start}__${r.day_of_week}__${r.row_index ?? 0}`,
      si: (r.row_index ?? 0) === 0 && r.stock_initial != null ? Number(r.stock_initial) : null,
      entries: r.entrees != null ? Number(r.entrees) : 0,
      sortieCol: r.sorties != null ? Number(r.sorties) : 0,
    });
    void key;
  });
  for (const [, rows] of byArticle) {
    let lastSi: number | null = null;
    let lastSiKey = "";
    let articleEntries = 0;
    let articleSorties = 0;
    let firstSi: number | null = null;
    let firstSiKey = "";
    for (const r of rows) {
      articleEntries += r.entries;
      articleSorties += r.sortieCol;
      if (r.si != null) {
        if (firstSi == null || r.date < firstSiKey) { firstSi = r.si; firstSiKey = r.date; }
        if (lastSi == null || r.date > lastSiKey) { lastSi = r.si; lastSiKey = r.date; }
      }
    }
    if (firstSi != null) stockInitial += firstSi;
    entrees += articleEntries;
    sorties += articleSorties;
    if (lastSi != null) stockRestant += lastSi;
  }

  return { stockInitial, entrees, sorties, stockRestant };
}

const WEEKLY_DAY_INDEX: Record<string, number> = {
  Lundi: 0, Mardi: 1, Mercredi: 2, Jeudi: 3, Vendredi: 4, Samedi: 5, Dimanche: 6,
};

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Historique quotidien agrégé pour le produit calculé TOPPINGS.
export async function getToppingsDailyHistory(): Promise<DailyStockRecord[]> {
  const [allMovements, initialStocks, units, configs, weeklyRes] = await Promise.all([
    getMovements(),
    getInitialStocks(),
    getProductUnits(),
    getProductUnitConfigs(),
    getToppingsWeeklyRes(),
  ]);

  // Stock initial global = somme des stocks initiaux SMARTIES + OREO
  // + 1er stock_initial saisi (par article) dans le Suivi Hebdo.
  let totalInitial = 0;
  for (const pid of TOPPINGS_ALI_PRODUCT_IDS) {
    totalInitial += initialStocks[pid] || 0;
  }

  const byDate: Record<string, { entrees: number; sorties: number }> = {};

  // 1) Mouvements alimentaires SMARTIES + OREO
  for (const pid of TOPPINGS_ALI_PRODUCT_IDS) {
    const unit = units[pid] || "PIECE";
    const config = configs[pid];
    allMovements
      .filter((m) => m.productId === pid)
      .forEach((m) => {
        const d = m.date.split("T")[0];
        if (!byDate[d]) byDate[d] = { entrees: 0, sorties: 0 };
        const q = movementPiecesToDisplay(m.quantity, unit, config, pid);
        if (m.type === "entree") byDate[d].entrees += q;
        else byDate[d].sorties += q;
      });
  }

  // 2) Suivi Hebdo : entrées/sorties par jour ; 1er SI saisi (par article) ajouté à l'initial global.
  type WRow = { article: string; date: string; rowIndex: number; si: number | null; e: number; s: number };
  const rows: WRow[] = ((weeklyRes as any).data || [])
    .map((r: any) => {
      const dayIdx = WEEKLY_DAY_INDEX[r.day_of_week];
      if (r.week_start == null || dayIdx == null) return null;
      return {
        article: r.article,
        date: addDaysISO(r.week_start, dayIdx),
        rowIndex: r.row_index ?? 0,
        si: r.stock_initial != null ? Number(r.stock_initial) : null,
        e: r.entrees != null ? Number(r.entrees) : 0,
        s: r.sorties != null ? Number(r.sorties) : 0,
      } as WRow;
    })
    .filter(Boolean) as WRow[];

  // 1er SI par article (ajouté au stockInitial global)
  const firstSiByArticle = new Map<string, { date: string; rowIndex: number; si: number }>();
  for (const r of rows) {
    if (r.si == null) continue;
    const cur = firstSiByArticle.get(r.article);
    const key = `${r.date}__${r.rowIndex}`;
    const curKey = cur ? `${cur.date}__${cur.rowIndex}` : "";
    if (!cur || key < curKey) firstSiByArticle.set(r.article, { date: r.date, rowIndex: r.rowIndex, si: r.si });
  }
  for (const v of firstSiByArticle.values()) totalInitial += v.si;

  // E/S quotidiennes
  for (const r of rows) {
    if (!byDate[r.date]) byDate[r.date] = { entrees: 0, sorties: 0 };
    byDate[r.date].entrees += r.e;
    byDate[r.date].sorties += r.s;
  }

  const dates = Object.keys(byDate).sort();
  let cumul = totalInitial;
  return dates.map((date) => {
    const stockInitial = cumul;
    const { entrees, sorties } = byDate[date];
    cumul = stockInitial + entrees - sorties;
    return {
      date,
      stockInitial: roundStockQuantity(stockInitial),
      entrees: roundStockQuantity(entrees),
      sorties: roundStockQuantity(sorties),
      stockRestant: roundStockQuantity(cumul),
    };
  });
}

export async function getStockLevels(category?: Category): Promise<StockLevel[]> {
  const baseProducts = getProducts(category);
  const needsGlace = baseProducts.some((product) => product.name === "GLACE" && product.category === "alimentaire");
  const needsToppings = baseProducts.some((product) => product.name === "TOPPINGS" && product.category === "alimentaire");
  const [aggregates, initialStocks, units, configs, glaceAgg, toppingsAgg] = await Promise.all([
    getMovementAggregates(),
    getInitialStocks(),
    getProductUnits(),
    getProductUnitConfigs(),
    needsGlace
      ? getGlaceAggregate()
      : Promise.resolve({ entrees: 0, sorties: 0, stockInitial: 0, stockFinal: 0 }),
    needsToppings
      ? getToppingsAggregate()
      : Promise.resolve({ entrees: 0, sorties: 0, stockInitial: 0, stockRestant: 0 }),
  ]);

  // Les anciennes listes statiques ne contiennent pas tous les produits réellement
  // utilisés par un PDV. Ajoute ceux présents dans ses mouvements afin qu'ils ne
  // disparaissent ni du stock restant, ni des alertes de rupture.
  const productsById = new Map(baseProducts.map((product) => [product.id, product]));
  for (const [productId, aggregate] of aggregates) {
    if (productsById.has(productId) || !aggregate.productName || !aggregate.category) continue;
    if (category && aggregate.category !== category) continue;
    const product = {
      id: productId,
      name: aggregate.productName,
      conditionnement: "",
      category: aggregate.category,
      initialStock: 0,
    } satisfies Product;
    if (!isHiddenProduct(product)) productsById.set(productId, product);
  }
  const products = Array.from(productsById.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
  );

  return products.map((product) => {
    const initial = initialStocks[product.id] || 0;
    const unit = units[product.id] || "PIECE";
    const config = configs[product.id];

    // Produit calculé « Glace » : entrées/sorties agrégées depuis le Suivi Hebdo
    // Stock initial = Σ(stock_initial du lundi × grammage). Entrées/Sorties =
    // Σ sur toute la semaine en cours (× grammage). Tout en kilos.
    if (product.name === "GLACE" && product.category === "alimentaire") {
      const e = glaceAgg.entrees;
      const s = glaceAgg.sorties;
      const si = glaceAgg.stockInitial;
      return {
        productId: product.id,
        productName: product.name,
        conditionnement: product.conditionnement,
        unit: "Kg" as UnitType,
        category: product.category,
        stockInitial: roundStockQuantity(si),
        totalEntrees: roundStockQuantity(e),
        totalSorties: roundStockQuantity(s),
        stockRestant: roundStockQuantity(glaceAgg.stockFinal),
      };
    }

    // Produit calculé « TOPPINGS » : agrégation de SMARTIES + OREO (table alimentaire)
    // + ingrédients tartes du Suivi Hebdo (Biscuit, Brownies.Top, Noix.Top,
    // Amandes.Top, Ananas fruits, Kiwi fruits).
    if (product.name === "TOPPINGS" && product.category === "alimentaire") {
      return {
        productId: product.id,
        productName: product.name,
        conditionnement: product.conditionnement,
        unit: "PIECE" as UnitType,
        category: product.category,
        stockInitial: roundStockQuantity(toppingsAgg.stockInitial),
        totalEntrees: roundStockQuantity(toppingsAgg.entrees),
        totalSorties: roundStockQuantity(toppingsAgg.sorties),
        stockRestant: roundStockQuantity(toppingsAgg.stockRestant),
      };
    }

    const agg = aggregates.get(product.id);
    // Régularisations de stock : n'apparaissent pas dans les Entrées,
    // elles sont décomptées des Sorties (positif = stock augmenté → sorties diminuées).
    const totalEntrees = roundStockQuantity(agg?.entrees ?? 0);
    const totalSorties = roundStockQuantity((agg?.sorties ?? 0) - (agg?.regularisationsNet ?? 0));


    return {
      productId: product.id,
      productName: product.name,
      conditionnement: product.conditionnement,
      unit,
      category: product.category,
      stockInitial: initial,
      totalEntrees: roundStockQuantity(totalEntrees),
      totalSorties: roundStockQuantity(totalSorties),
      stockRestant: roundStockQuantity(initial + totalEntrees - totalSorties),
    };
  });
}

// Agrège les Σ Bacs × Grammage de tous les parfums de glace
// depuis weekly_tracking (fiche Mouvement glaces & tartes) + glace_grammage.
// Exclut "Crème fraîche (mousse fouettée)" qui n'est pas un parfum.
const GLACE_PARFUMS_BLACKLIST = new Set(["Crème fraîche (mousse fouettée)"]);

function currentMondayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function getGlaceAggregate(): Promise<{ entrees: number; sorties: number; stockInitial: number; stockFinal: number }> {
  const pdvId = requireCurrentPdvId();
  return cached(
    `glaceAggregate:${pdvId}`,
    ["weekly_tracking", "glace_grammage"],
    computeGlaceAggregate,
  );
}

async function computeGlaceAggregate(): Promise<{ entrees: number; sorties: number; stockInitial: number; stockFinal: number }> {
  const weekStart = currentMondayISO();
  const nextWeekStart = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  })();
  const [rows, gramRes] = await Promise.all([
    fetchAllRows<any>(() =>
      supabase
        .from("weekly_tracking")
        .select("article, entrees, sorties, stock_initial, day_of_week, week_start, row_index")
        .eq("fiche_type", "Mouvement glaces & tartes")
        .in("week_start", [weekStart, nextWeekStart]),
    ),
    getGlaceGrammageRes(),
  ]);
  const grams: Record<string, number> = {};
  ((gramRes as any).data || []).forEach((r: any) => {
    grams[r.article] = Number(r.grammage_grams) || 0;
  });
  const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  // Index : article -> wkStart -> day -> { si (rowIndex 0), entriesSum, explicitSortie }
  type DayAgg = { si: number | null; entries: number; explicitSortie: number | null };
  const byArticle = new Map<string, Map<string, Map<string, DayAgg>>>();
  (rows || []).forEach((r: any) => {
    if (!r.article || GLACE_PARFUMS_BLACKLIST.has(r.article)) return;
    if (!grams[r.article]) return;
    let wk = byArticle.get(r.article);
    if (!wk) { wk = new Map(); byArticle.set(r.article, wk); }
    let days = wk.get(r.week_start);
    if (!days) { days = new Map(); wk.set(r.week_start, days); }
    let cell = days.get(r.day_of_week);
    if (!cell) { cell = { si: null, entries: 0, explicitSortie: null }; days.set(r.day_of_week, cell); }
    const rowIdx = r.row_index ?? 0;
    if (rowIdx === 0) {
      if (r.stock_initial != null) cell.si = Number(r.stock_initial) || 0;
      if (r.sorties != null) cell.explicitSortie = Number(r.sorties) || 0;
    }
    if (r.entrees != null) cell.entries += Number(r.entrees) || 0;
  });
  let entrees = 0;
  let sorties = 0;
  let stockInitial = 0;
  let stockFinalTotal = 0;
  let latestStockDayIndex = -1;
  for (const wkMap of byArticle.values()) {
    const cur = wkMap.get(weekStart);
    if (!cur) continue;
    for (let d = 6; d >= 0; d--) {
      if (cur.get(DAYS[d])?.si != null) {
        latestStockDayIndex = Math.max(latestStockDayIndex, d);
        break;
      }
    }
  }
  for (const [article, wkMap] of byArticle) {
    const g = grams[article] || 0;
    if (!g) continue;
    const cur = wkMap.get(weekStart);
    if (!cur) continue;
    const getCell = (wk: string, day: string): DayAgg =>
      wkMap.get(wk)?.get(day) ?? { si: null, entries: 0, explicitSortie: null };
    // Stock initial = SI Lundi
    const siMon = getCell(weekStart, "Lundi").si ?? 0;
    stockInitial += siMon * g;
    // Entrées + Sorties par jour (logique identique à WeeklyTracking.getSortie)
    for (let d = 0; d < 7; d++) {
      const day = DAYS[d];
      const c = getCell(weekStart, day);
      entrees += c.entries * g;
      let sortie: number | null = null;
      if (d < 6) {
        const next = getCell(weekStart, DAYS[d + 1]);
        if (c.si != null && next.si != null) {
          sortie = c.si + c.entries - next.si;
        }
      } else {
        const siNextMon = getCell(nextWeekStart, "Lundi").si;
        if (c.si != null && siNextMon != null) {
          sortie = c.si + c.entries - siNextMon;
        }
      }
      if (sortie == null) sortie = c.explicitSortie ?? 0;
      sorties += sortie * g;
    }
    // Stock final = total saisi dans le SI du dernier jour renseigné globalement.
    // Ne pas reprendre les jours précédents parfum par parfum : si le dernier total saisi est 20 kg,
    // la table Stock restant doit afficher exactement ce total converti par grammage.
    if (latestStockDayIndex >= 0) {
      const latestSi = getCell(weekStart, DAYS[latestStockDayIndex]).si;
      if (latestSi != null) stockFinalTotal += latestSi * g;
    }
  }
  // Conversion grammes → kilos
  return {
    entrees: entrees / 1000,
    sorties: sorties / 1000,
    stockInitial: stockInitial / 1000,
    stockFinal: stockFinalTotal / 1000,
  };
}

function trackingDateISO(weekStart: string, dayOfWeek: string): string | null {
  const dayIdx = DAYS_FOR_GLACE.indexOf(dayOfWeek);
  if (dayIdx < 0 || !weekStart) return null;
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIdx + (d.getDay() === 0 ? 1 : 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function nextDateISO(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const DAYS_FOR_GLACE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export async function getGlaceAggregateForRange(startDate?: string, endDate?: string): Promise<{ stockInitial: number; entrees: number; sorties: number; stockRestant: number }> {
  const [rows, gramRes] = await Promise.all([
    getGlaceWeeklyRows(),
    getGlaceGrammageRes(),
  ]);

  const grams: Record<string, number> = {};
  ((gramRes as any).data || []).forEach((r: any) => {
    grams[r.article] = Number(r.grammage_grams) || 0;
  });

  type DayAgg = { si: number | null; entries: number; explicitSortie: number | null };
  const byArticle = new Map<string, Map<string, DayAgg>>();
  (rows || []).forEach((r: any) => {
    if (!r.article || GLACE_PARFUMS_BLACKLIST.has(r.article)) return;
    if (!grams[r.article]) return;
    const date = trackingDateISO(r.week_start, r.day_of_week);
    if (!date) return;
    let days = byArticle.get(r.article);
    if (!days) { days = new Map(); byArticle.set(r.article, days); }
    let cell = days.get(date);
    if (!cell) { cell = { si: null, entries: 0, explicitSortie: null }; days.set(date, cell); }
    const rowIdx = r.row_index ?? 0;
    if (rowIdx === 0) {
      if (r.stock_initial != null) cell.si = Number(r.stock_initial) || 0;
      if (r.sorties != null) cell.explicitSortie = Number(r.sorties) || 0;
    }
    if (r.entrees != null) cell.entries += Number(r.entrees) || 0;
  });

  const inRange = (date: string) => (!startDate || date >= startDate) && (!endDate || date <= endDate);
  let firstStockDate: string | null = null;
  for (const days of byArticle.values()) {
    for (const [date, cell] of days) {
      if (!inRange(date) || cell.si == null) continue;
      if (!firstStockDate || date < firstStockDate) firstStockDate = date;
    }
  }

  let stockInitial = 0;
  let entrees = 0;
  let sorties = 0;
  let stockRestant = 0;
  for (const [article, days] of byArticle) {
    const g = grams[article] || 0;
    if (!g) continue;
    if (firstStockDate) {
      const si = days.get(firstStockDate)?.si;
      if (si != null) stockInitial += si * g;
    }
    // Stock restant : dernier SI saisi à la date <= endDate (ou n'importe quand si pas d'endDate)
    // pour ce parfum, multiplié par son grammage. Même logique que le stock final hebdo.
    let latestSiDate: string | null = null;
    for (const [date, cell] of days) {
      if (cell.si == null) continue;
      if (endDate && date > endDate) continue;
      if (!latestSiDate || date > latestSiDate) latestSiDate = date;
    }
    if (latestSiDate) {
      const si = days.get(latestSiDate)?.si;
      if (si != null) stockRestant += si * g;
    }
    for (const [date, cell] of days) {
      if (!inRange(date)) continue;
      entrees += cell.entries * g;
      let sortie: number | null = null;
      const nextSi = days.get(nextDateISO(date))?.si;
      if (cell.si != null && nextSi != null) sortie = cell.si + cell.entries - nextSi;
      if (sortie == null) sortie = cell.explicitSortie ?? 0;
      sorties += sortie * g;
    }
  }

  return {
    stockInitial: stockInitial / 1000,
    entrees: entrees / 1000,
    sorties: sorties / 1000,
    stockRestant: stockRestant / 1000,
  };
}

export interface DailyStockRecord {
  date: string;
  stockInitial: number;
  entrees: number;
  sorties: number;
  stockRestant: number;
}

export async function getProductDailyHistory(productId: string): Promise<DailyStockRecord[]> {
  // Cas spécial : produit calculé « TOPPINGS » (agrégat SMARTIES + OREO + Suivi Hebdo)
  const productName = getProducts().find((p) => p.id === productId)?.name;
  if (productName === "TOPPINGS") {
    return getToppingsDailyHistory();
  }

  const [allMovements, initialStocks, units, configs] = await Promise.all([
    getMovements(),
    getInitialStocks(),
    getProductUnits(),
    getProductUnitConfigs(),
  ]);
  const movements = allMovements.filter((m) => m.productId === productId);
  const initial = initialStocks[productId] || 0;
  const unit = units[productId] || "PIECE";
  const config = configs[productId];

  const byDate: Record<string, { entrees: number; sorties: number }> = {};
  movements.forEach((m) => {
    const d = m.date.split("T")[0];
    if (!byDate[d]) byDate[d] = { entrees: 0, sorties: 0 };
    const displayQuantity = movementPiecesToDisplay(m.quantity, unit, config, productId);
    if (m.type === "entree") byDate[d].entrees += displayQuantity;
    else byDate[d].sorties += displayQuantity;
  });

  const dates = Object.keys(byDate).sort();
  let cumul = initial;
  return dates.map((date) => {
    const stockInitial = cumul;
    const { entrees, sorties } = byDate[date];
    cumul = stockInitial + entrees - sorties;
    return {
      date,
      stockInitial: roundStockQuantity(stockInitial),
      entrees: roundStockQuantity(entrees),
      sorties: roundStockQuantity(sorties),
      stockRestant: roundStockQuantity(cumul),
    };
  });
}

// Retourne le stock restant courant d'un produit, exprimé dans la MÊME unité
// de base que `totalPieces` (= pièces "brutes" multipliées par la config).
// Permet de comparer directement avec une saisie MultiUnitInput pour bloquer
// une sortie/réquisition qui dépasserait le stock disponible.
export async function getProductAvailableStockInBasePieces(productId: string): Promise<number> {
  const [allMovements, initialStocks] = await Promise.all([
    getMovements(),
    getInitialStocks(),
  ]);
  const initial = initialStocks[productId] || 0;
  const initialBase = initial;
  const productMovements = allMovements.filter((m) => m.productId === productId);
  const totalEntreesBase = productMovements
    .filter((m) => m.type === "entree")
    .reduce((sum, m) => sum + m.quantity, 0);
  const totalSortiesBase = productMovements
    .filter((m) => m.type === "sortie")
    .reduce((sum, m) => sum + m.quantity, 0);
  return roundStockQuantity(initialBase + totalEntreesBase - totalSortiesBase);
}

// Détail par parfum du calcul agrégé « GLACE » (en kg).
export interface AggregateBreakdownRow {
  name: string;
  stockInitial: number;
  entrees: number;
  sorties: number;
  stockRestant: number;
}

export async function getGlaceBreakdownForRange(
  startDate?: string,
  endDate?: string,
): Promise<AggregateBreakdownRow[]> {
  const [rows, gramRes] = await Promise.all([
    getGlaceWeeklyRows(),
    getGlaceGrammageRes(),
  ]);
  const grams: Record<string, number> = {};
  ((gramRes as any).data || []).forEach((r: any) => {
    grams[r.article] = Number(r.grammage_grams) || 0;
  });
  type DayAgg = { si: number | null; entries: number; explicitSortie: number | null };
  const byArticle = new Map<string, Map<string, DayAgg>>();
  (rows || []).forEach((r: any) => {
    if (!r.article || GLACE_PARFUMS_BLACKLIST.has(r.article)) return;
    if (!grams[r.article]) return;
    const date = trackingDateISO(r.week_start, r.day_of_week);
    if (!date) return;
    let days = byArticle.get(r.article);
    if (!days) { days = new Map(); byArticle.set(r.article, days); }
    let cell = days.get(date);
    if (!cell) { cell = { si: null, entries: 0, explicitSortie: null }; days.set(date, cell); }
    const rowIdx = r.row_index ?? 0;
    if (rowIdx === 0) {
      if (r.stock_initial != null) cell.si = Number(r.stock_initial) || 0;
      if (r.sorties != null) cell.explicitSortie = Number(r.sorties) || 0;
    }
    if (r.entrees != null) cell.entries += Number(r.entrees) || 0;
  });
  const inRange = (date: string) => (!startDate || date >= startDate) && (!endDate || date <= endDate);
  const out: AggregateBreakdownRow[] = [];
  const allArticles = Object.keys(grams).filter((a) => !GLACE_PARFUMS_BLACKLIST.has(a));
  for (const article of allArticles) {
    const g = grams[article] || 0;
    const days = byArticle.get(article) ?? new Map<string, DayAgg>();
    let stockInitial = 0;
    let entrees = 0;
    let sorties = 0;
    // Stock initial du parfum sur la période : si un SI existe au début exact
    // de la période (cas filtre jour), il est prioritaire. Sinon on reprend
    // le dernier SI connu avant la période, puis à défaut le premier SI dedans.
    let initialBacs: number | null = null;
    if (startDate) {
      const exactStartSi = days.get(startDate)?.si;
      if (exactStartSi != null) initialBacs = exactStartSi;

      let bestBefore: string | null = null;
      for (const [date, cell] of days) {
        if (cell.si == null || date >= startDate) continue;
        if (!bestBefore || date > bestBefore) bestBefore = date;
      }
      if (initialBacs == null && bestBefore) initialBacs = days.get(bestBefore)?.si ?? null;
    }
    if (initialBacs == null) {
      let firstIn: string | null = null;
      for (const [date, cell] of days) {
        if (cell.si == null || !inRange(date)) continue;
        if (!firstIn || date < firstIn) firstIn = date;
      }
      if (firstIn) initialBacs = days.get(firstIn)?.si ?? null;
    }
    if (initialBacs != null) stockInitial = initialBacs * g;
    for (const [date, cell] of days) {
      if (!inRange(date)) continue;
      entrees += cell.entries * g;
      let sortie: number | null = null;
      const nextSi = days.get(nextDateISO(date))?.si;
      if (cell.si != null && nextSi != null) sortie = cell.si + cell.entries - nextSi;
      if (sortie == null) sortie = cell.explicitSortie ?? 0;
      sorties += sortie * g;
    }
    // Stock restant = dernier SI saisi <= endDate pour ce parfum (même logique
    // que l'agrégat GLACE affiché dans la table). Si rien n'a été saisi dans
    // la période, on retombe sur SI + entrées − sorties.
    let stockRestant = stockInitial + entrees - sorties;
    let latestSiDate: string | null = null;
    for (const [date, cell] of days) {
      if (cell.si == null) continue;
      if (endDate && date > endDate) continue;
      if (startDate && date < startDate) continue;
      if (!latestSiDate || date > latestSiDate) latestSiDate = date;
    }
    if (latestSiDate) {
      const si = days.get(latestSiDate)?.si;
      if (si != null) stockRestant = si * g;
    }
    out.push({
      name: article,
      stockInitial: roundStockQuantity(stockInitial / 1000),
      entrees: roundStockQuantity(entrees / 1000),
      sorties: roundStockQuantity(sorties / 1000),
      stockRestant: roundStockQuantity(stockRestant / 1000),
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return out;
}
