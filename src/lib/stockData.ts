import { supabase } from "@/integrations/supabase/client";

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
  "ali-7": { singular: "0,5 Kg", plural: "0,5 Kg", short: "0,5 kg" }, // CAFE BRESIL
};

// Override du label "paquet" pour des produits configurés en multi-conditionnement
export const PAQUET_LABEL_OVERRIDES: Record<string, string> = {
  "ali-7": "1 Kg", // CAFE BRESIL
};

export function getPieceLabel(productId: string): { singular: string; plural: string; short: string } {
  return PIECE_LABEL_OVERRIDES[productId] || { singular: "Pièce", plural: "Pièces", short: "pcs" };
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

function roundStockQuantity(value: number): number {
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function getDisplayFactor(unit: UnitType, config?: ProductUnitConfig): number {
  if (unit === "KILO" && config?.paquetEnabled && config.piecesPerPaquet > 0) return config.piecesPerPaquet;
  if (unit === "PAQUET" && config?.paquetEnabled && config.piecesPerPaquet > 0) return config.piecesPerPaquet;
  if (unit === "COLIS" && config?.cartonEnabled && config.piecesPerCarton > 0) return config.piecesPerCarton;
  return 1;
}

function movementPiecesToDisplay(quantity: number, unit: UnitType, config?: ProductUnitConfig): number {
  return roundStockQuantity(quantity / getDisplayFactor(unit, config));
}

export function displayQuantityForProduct(productId: string, quantity: number, config?: ProductUnitConfig): number {
  if (productId === "ali-7") return roundStockQuantity(quantity / (config?.piecesPerPaquet || 2));
  return roundStockQuantity(quantity);
}

export function formatQuantityForProduct(productId: string, quantity: number, config?: ProductUnitConfig): string {
  const displayQuantity = displayQuantityForProduct(productId, quantity, config);
  if (productId === "ali-7") return `${displayQuantity.toLocaleString("fr-FR")} Kg`;
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
  "TCHABA (50 P)",
  "NESPRESSO (50 P)",
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
  "__HIDDEN__",
  "__HIDDEN__",
  "__HIDDEN__",
  "__HIDDEN__",
  "TCHABA GARDEN",
  "TCHABA VERT",
  "TCHABA GINGEMBRE",
  "TCHABA JASMIN",
  "TCHABA EARL",
  "TCHABA MENTHE",
  "TCHABA PEACEFUL",
  "TCHABA BREAKFAST",
  "TCHABA VERVEINE",
  "POUDRE VANILLE",
  "__HIDDEN__",
  "PROTOXYDE",
  "EAU 5L",
  "THE NOIR",
  "CONFITURE PECHE",
  "CONFITURE FRAISE",
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
  "SAC PANACHE (SACHET = 350 P)",
  "FICELLE (SACHET = 1000 P)",
  "SACHET MERINGUE (CARTON = 2000 P)",
  "ETIQUETTE GAUFRETTE (SACHET = 500 P)",
  "BG1 (PAQUET = 16 P)",
  "BG3 (PAQUET = 18 P)",
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

export function getProducts(category?: Category): Product[] {
  const ali = ALIMENTAIRE_PRODUCTS.map((raw, i) => {
    const { name, conditionnement } = parseProduct(raw);
    return { id: `ali-${i}`, name, conditionnement, category: "alimentaire" as Category, initialStock: 0 };
  }).filter((p) => p.name !== "__HIDDEN__");
  const emb = EMBALLAGE_PRODUCTS.map((raw, i) => {
    const { name, conditionnement } = parseProduct(raw);
    return { id: `emb-${i}`, name, conditionnement, category: "emballage" as Category, initialStock: 0 };
  }).filter((p) => p.name !== "__HIDDEN__");
  const sortByName = (a: Product, b: Product) =>
    a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  if (category === "alimentaire") return ali.sort(sortByName);
  if (category === "emballage") return emb.sort(sortByName);
  return [...ali.sort(sortByName), ...emb.sort(sortByName)];
}

// Détecte l'unité naturelle d'un produit selon son nom (huile→Litre, sucre→Kg, etc.)
export function detectProductUnit(name: string): string {
  const n = name.toUpperCase();
  // Overrides explicites demandés par l'utilisateur → Pièce
  if (/OREO|SIDI ALI|OULMESS|SULTAN|HUILE|HUILLE|\bSEL\b|THE NOIR/.test(n)) return "Pièce";
  // Chocolat classique → Kilo
  if (/CHOCOLT?A?\s*CLASSIC/.test(n)) return "Kg";
  if (/SIROP|LAIT|EAU|NUTELLA|MIEL|CONFITURE|PROTOXYDE/.test(n)) {
    if (/\bL\b|LITRE|CL|ML/.test(n) || /SIROP|LAIT|EAU/.test(n)) return "L";
  }
  if (/\bKG\b|KILO|FARINE|SUCRE|CAFE|THE\b|VANILLE|BEURRE|LEVURE|TOPPING/.test(n)) return "Kg";
  if (/PAPIER|FILM|ALUMINIUM|ROULEAU/.test(n)) return "Rouleau";
  if (/SACHET/.test(n)) return "Sachet";
  return "Pièce";
}

// ===== Async Supabase functions =====

export async function getMovements(): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    date: row.date,
    productId: row.product_id,
    productName: row.product_name,
    category: row.category as Category,
    type: row.type as "entree" | "sortie",
    quantity: row.quantity,
    performedBy: row.performed_by || undefined,
    unitUsed: (row.unit_used as MovementUnit) || "PIECE",
  }));
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
    } as any)
    .select()
    .single();
  if (error) throw error;
  const row: any = data;

  // Auto-consume FIFO from lots for any "sortie" on alimentaire
  if (movement.type === "sortie" && movement.category === "alimentaire" && movement.quantity > 0) {
    try {
      const { syncLotBalances } = await import("./lotBalance");
      await syncLotBalances(movement.productId);
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
  };
}

export async function deleteMovement(id: string) {
  const { error } = await supabase.from("stock_movements").delete().eq("id", id);
  if (error) throw error;
}

export async function getInitialStocks(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("initial_stocks").select("*");
  if (error) throw error;
  const result: Record<string, number> = {};
  (data || []).forEach((row) => {
    result[row.product_id] = row.quantity;
  });
  return result;
}

export async function getProductUnits(): Promise<Record<string, UnitType>> {
  const { data, error } = await supabase.from("initial_stocks").select("product_id, unit");
  if (error) throw error;
  const result: Record<string, UnitType> = {};
  (data || []).forEach((row) => {
    result[row.product_id] = (row.unit as UnitType) || "PIECE";
  });
  return result;
}

export async function getProductUnitConfigs(): Promise<Record<string, ProductUnitConfig>> {
  const { data, error } = await supabase
    .from("initial_stocks")
    .select("product_id, carton_enabled, paquet_enabled, pieces_per_carton, pieces_per_paquet");
  if (error) throw error;
  const result: Record<string, ProductUnitConfig> = {};
  (data || []).forEach((row: any) => {
    result[row.product_id] = {
      cartonEnabled: !!row.carton_enabled,
      paquetEnabled: !!row.paquet_enabled,
      piecesPerCarton: row.pieces_per_carton || 1,
      piecesPerPaquet: row.pieces_per_paquet || 1,
    };
  });
  return result;
}

export async function setProductUnitConfig(productId: string, config: Partial<ProductUnitConfig>) {
  const payload: any = { product_id: productId, quantity: 0 };
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
    .upsert({ product_id: productId, unit, quantity: 0 }, { onConflict: "product_id" });
  if (error) throw error;
}

export async function setInitialStock(productId: string, quantity: number) {
  const { error } = await supabase
    .from("initial_stocks")
    .upsert({ product_id: productId, quantity }, { onConflict: "product_id" });
  if (error) throw error;
}

export async function getStockLevels(category?: Category): Promise<StockLevel[]> {
  const products = getProducts(category);
  const [movements, initialStocks, units, configs] = await Promise.all([
    getMovements(),
    getInitialStocks(),
    getProductUnits(),
    getProductUnitConfigs(),
  ]);

  return products.map((product) => {
    const initial = initialStocks[product.id] || 0;
    const unit = units[product.id] || "PIECE";
    const config = configs[product.id];
    const productMovements = movements.filter((m) => m.productId === product.id);
    const totalEntrees = productMovements
      .filter((m) => m.type === "entree")
      .reduce((sum, m) => sum + movementPiecesToDisplay(m.quantity, unit, config), 0);
    const totalSorties = productMovements
      .filter((m) => m.type === "sortie")
      .reduce((sum, m) => sum + movementPiecesToDisplay(m.quantity, unit, config), 0);

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

export interface DailyStockRecord {
  date: string;
  stockInitial: number;
  entrees: number;
  sorties: number;
  stockRestant: number;
}

export async function getProductDailyHistory(productId: string): Promise<DailyStockRecord[]> {
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
    const displayQuantity = movementPiecesToDisplay(m.quantity, unit, config);
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
