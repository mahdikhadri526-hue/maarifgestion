export interface LotEntry {
  id: string;
  productId: string;
  lotNumber: string;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  remainingQuantity: number;
  entryDate: string;
}

const LOT_STORAGE_KEY = "mahdi_lot_entries";

export function getLotEntries(): LotEntry[] {
  const raw = localStorage.getItem(LOT_STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveLotEntries(entries: LotEntry[]) {
  localStorage.setItem(LOT_STORAGE_KEY, JSON.stringify(entries));
}

export function addLotEntry(entry: Omit<LotEntry, "id" | "remainingQuantity">): LotEntry {
  const entries = getLotEntries();
  const newEntry: LotEntry = {
    ...entry,
    id: crypto.randomUUID(),
    remainingQuantity: entry.quantity,
  };
  entries.push(newEntry);
  saveLotEntries(entries);
  return newEntry;
}

export function updateLotEntry(id: string, updates: Partial<Pick<LotEntry, "lotNumber" | "expiryDate">>) {
  const entries = getLotEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx !== -1) {
    if (updates.lotNumber !== undefined) entries[idx].lotNumber = updates.lotNumber;
    if (updates.expiryDate !== undefined) entries[idx].expiryDate = updates.expiryDate;
    saveLotEntries(entries);
  }
}

/** FIFO exit: consume from oldest lots first. Returns consumed lot details. */
export function consumeFromLots(productId: string, quantity: number): { lotId: string; lotNumber: string; consumed: number }[] {
  const entries = getLotEntries();
  // Sort by expiry date (FIFO by oldest expiry first)
  const productLots = entries
    .filter((e) => e.productId === productId && e.remainingQuantity > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  let remaining = quantity;
  const consumed: { lotId: string; lotNumber: string; consumed: number }[] = [];

  for (const lot of productLots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.remainingQuantity, remaining);
    lot.remainingQuantity -= take;
    remaining -= take;
    consumed.push({ lotId: lot.id, lotNumber: lot.lotNumber, consumed: take });
    // Update in the main array
    const idx = entries.findIndex((e) => e.id === lot.id);
    if (idx !== -1) entries[idx] = lot;
  }

  saveLotEntries(entries);
  return consumed;
}

/** Get lots with remaining stock for a product */
export function getProductLots(productId: string): LotEntry[] {
  return getLotEntries()
    .filter((e) => e.productId === productId)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

/** Get all lots expiring within N days */
export function getExpiringLots(days: number = 15): (LotEntry & { daysUntilExpiry: number })[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entries = getLotEntries().filter((e) => e.remainingQuantity > 0);

  return entries
    .map((e) => {
      const expiry = new Date(e.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...e, daysUntilExpiry: diff };
    })
    .filter((e) => e.daysUntilExpiry <= days)
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

export function deleteLotEntry(id: string) {
  const entries = getLotEntries().filter((e) => e.id !== id);
  saveLotEntries(entries);
}
