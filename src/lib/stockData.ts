import { supabase } from "@/integrations/supabase/client";

export type Category = "alimentaire" | "emballage";

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
}

export interface StockLevel {
  productId: string;
  productName: string;
  conditionnement: string;
  category: Category;
  totalEntrees: number;
  totalSorties: number;
  stockRestant: number;
}

const ALIMENTAIRE_PRODUCTS = [
  "PEPITES TOPPING (20 KG)",
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
  "TCHABA VERVEINE",
  "POUDRE VANILLE",
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
  "BARQUETTE 1L (CARTON = 171 P)",
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
];

export function getProducts(category?: Category): Product[] {
  const ali = ALIMENTAIRE_PRODUCTS.map((raw, i) => {
    const { name, conditionnement } = parseProduct(raw);
    return { id: `ali-${i}`, name, conditionnement, category: "alimentaire" as Category, initialStock: 0 };
  });
  const emb = EMBALLAGE_PRODUCTS.map((raw, i) => {
    const { name, conditionnement } = parseProduct(raw);
    return { id: `emb-${i}`, name, conditionnement, category: "emballage" as Category, initialStock: 0 };
  });
  if (category === "alimentaire") return ali;
  if (category === "emballage") return emb;
  return [...ali, ...emb];
}

// ===== Async Supabase functions =====

export async function getMovements(): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    date: row.date,
    productId: row.product_id,
    productName: row.product_name,
    category: row.category as Category,
    type: row.type as "entree" | "sortie",
    quantity: row.quantity,
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
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    date: data.date,
    productId: data.product_id,
    productName: data.product_name,
    category: data.category as Category,
    type: data.type as "entree" | "sortie",
    quantity: data.quantity,
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

export async function setInitialStock(productId: string, quantity: number) {
  const { error } = await supabase
    .from("initial_stocks")
    .upsert({ product_id: productId, quantity }, { onConflict: "product_id" });
  if (error) throw error;
}

export async function getStockLevels(category?: Category): Promise<StockLevel[]> {
  const products = getProducts(category);
  const [movements, initialStocks] = await Promise.all([getMovements(), getInitialStocks()]);

  return products.map((product) => {
    const initial = initialStocks[product.id] || 0;
    const productMovements = movements.filter((m) => m.productId === product.id);
    const totalEntrees = productMovements
      .filter((m) => m.type === "entree")
      .reduce((sum, m) => sum + m.quantity, 0);
    const totalSorties = productMovements
      .filter((m) => m.type === "sortie")
      .reduce((sum, m) => sum + m.quantity, 0);

    return {
      productId: product.id,
      productName: product.name,
      category: product.category,
      totalEntrees: initial + totalEntrees,
      totalSorties,
      stockRestant: initial + totalEntrees - totalSorties,
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
  const [allMovements, initialStocks] = await Promise.all([getMovements(), getInitialStocks()]);
  const movements = allMovements.filter((m) => m.productId === productId);
  const initial = initialStocks[productId] || 0;

  const byDate: Record<string, { entrees: number; sorties: number }> = {};
  movements.forEach((m) => {
    const d = m.date.split("T")[0];
    if (!byDate[d]) byDate[d] = { entrees: 0, sorties: 0 };
    if (m.type === "entree") byDate[d].entrees += m.quantity;
    else byDate[d].sorties += m.quantity;
  });

  const dates = Object.keys(byDate).sort();
  let cumul = initial;
  return dates.map((date) => {
    const stockInitial = cumul;
    const { entrees, sorties } = byDate[date];
    cumul = stockInitial + entrees - sorties;
    return { date, stockInitial, entrees, sorties, stockRestant: cumul };
  });
}
