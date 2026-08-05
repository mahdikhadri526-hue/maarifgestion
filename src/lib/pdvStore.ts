const STORAGE_KEY = "current_pdv_id";

let currentPdvId: string | null =
  typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

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
