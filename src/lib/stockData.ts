export type Category = "alimentaire" | "emballage";

export interface Product {
  id: string;
  name: string;
  category: Category;
  initialStock: number;
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
  const ali = ALIMENTAIRE_PRODUCTS.map((name, i) => ({
    id: `ali-${i}`,
    name,
    category: "alimentaire" as Category,
    initialStock: 0,
  }));
  const emb = EMBALLAGE_PRODUCTS.map((name, i) => ({
    id: `emb-${i}`,
    name,
    category: "emballage" as Category,
    initialStock: 0,
  }));
  if (category === "alimentaire") return ali;
  if (category === "emballage") return emb;
  return [...ali, ...emb];
}

const STORAGE_KEY = "mahdi_stock_movements";

export function getMovements(): StockMovement[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveMovement(movement: Omit<StockMovement, "id">): StockMovement {
  const movements = getMovements();
  const newMovement: StockMovement = {
    ...movement,
    id: crypto.randomUUID(),
  };
  movements.push(newMovement);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(movements));
  return newMovement;
}

export function getStockLevels(category?: Category): StockLevel[] {
  const products = getProducts(category);
  const movements = getMovements();

  return products.map((product) => {
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
      totalEntrees: product.initialStock + totalEntrees,
      totalSorties,
      stockRestant: product.initialStock + totalEntrees - totalSorties,
    };
  });
}
