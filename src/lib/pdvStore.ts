import { DEFAULT_PDV_ID, ENABLE_MULTI_PDV } from "@/lib/featureFlags";

const STORAGE_KEY = "current_pdv_id";

let currentPdvId: string | null = !ENABLE_MULTI_PDV
  ? DEFAULT_PDV_ID
  : typeof localStorage !== "undefined"
    ? localStorage.getItem(STORAGE_KEY)
    : null;

export function getCurrentPdvId(): string | null {
  return currentPdvId;
}

export function requireCurrentPdvId(): string {
  if (!currentPdvId) throw new Error("Aucun point de vente sélectionné");
  return currentPdvId;
}

export function setCurrentPdvId(id: string | null) {
  currentPdvId = id;
  if (typeof localStorage === "undefined") return;
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
}
