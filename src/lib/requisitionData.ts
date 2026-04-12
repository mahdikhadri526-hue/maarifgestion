import { saveMovement, getMovements } from "./stockData";

export interface RequisitionEntry {
  id: string;
  date: string;
  type: "salle" | "emporter";
  productId: string;
  productName: string;
  quantity: number;
}

const REQUISITION_KEY = "mahdi_requisitions";

// Products in "Réquisition Salle" (emballage)
export const REQUISITION_SALLE_IDS = [
  "ali-0","ali-1","ali-2","ali-3","ali-4","ali-5","ali-6","ali-7","ali-8",
  "ali-9","ali-10","ali-11","ali-12","ali-13","ali-14","ali-15","ali-16",
  "ali-17","ali-18","ali-19","ali-20",
];

// Products in "Réquisition Emporter" (emballage)
export const REQUISITION_EMPORTER_IDS = [
  "emb-0","emb-1","emb-2","emb-3","emb-4","emb-5","emb-6","emb-7","emb-8",
  "emb-9","emb-10","emb-11","emb-12","emb-13","emb-14","emb-15","emb-16",
  "emb-17","emb-18","emb-19","emb-20","emb-21","emb-22","emb-23","emb-24",
  "emb-25","emb-26","emb-27","emb-28","emb-29","emb-30","emb-31","emb-32",
  "emb-33","emb-34","emb-35","emb-36","emb-37","emb-38","emb-39","emb-40","emb-41",
];

export const ALL_REQUISITION_IDS = new Set([...REQUISITION_SALLE_IDS, ...REQUISITION_EMPORTER_IDS]);

export function getRequisitions(): RequisitionEntry[] {
  const raw = localStorage.getItem(REQUISITION_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveRequisition(entry: Omit<RequisitionEntry, "id">): RequisitionEntry {
  const requisitions = getRequisitions();
  const newEntry: RequisitionEntry = { ...entry, id: crypto.randomUUID() };
  requisitions.push(newEntry);
  localStorage.setItem(REQUISITION_KEY, JSON.stringify(requisitions));

  // Auto-create a "sortie" movement for the next day
  const category = entry.type === "salle" ? "alimentaire" as const : "emballage" as const;
  const nextDay = new Date(entry.date + "T00:00:00");
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = nextDay.toISOString().split("T")[0];
  saveMovement({
    date: nextDayStr,
    productId: entry.productId,
    productName: entry.productName,
    category,
    type: "sortie",
    quantity: entry.quantity,
  });

  return newEntry;
}

export function getRequisitionsByDate(date: string, type: "salle" | "emporter"): RequisitionEntry[] {
  return getRequisitions().filter((r) => r.date === date && r.type === type);
}

export function isRequisitionProduct(productId: string): boolean {
  return ALL_REQUISITION_IDS.has(productId);
}
