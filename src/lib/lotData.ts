import { supabase } from "@/lib/db";
import { syncLotBalances } from "./lotBalance";
import { fetchAllRows } from "@/lib/supabasePaginate";

export interface LotEntry {
  id: string;
  productId: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  remainingQuantity: number;
  entryDate: string;
}

function mapRow(row: any): LotEntry {
  return {
    id: row.id,
    productId: row.product_id,
    lotNumber: row.lot_number,
    expiryDate: row.expiry_date,
    quantity: row.quantity,
    remainingQuantity: row.remaining_quantity,
    entryDate: row.entry_date,
  };
}

export async function getLotEntries(): Promise<LotEntry[]> {
  await syncLotBalances();
  const data = await fetchAllRows<any>(() => supabase.from("lot_entries").select("*"));
  return data.map(mapRow);
}

export async function addLotEntry(entry: Omit<LotEntry, "id" | "remainingQuantity">): Promise<LotEntry> {
  const { data, error } = await supabase
    .from("lot_entries")
    .insert({
      product_id: entry.productId,
      lot_number: entry.lotNumber,
      expiry_date: entry.expiryDate,
      quantity: entry.quantity,
      remaining_quantity: entry.quantity,
      entry_date: entry.entryDate,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateLotEntry(id: string, updates: Partial<Pick<LotEntry, "lotNumber" | "expiryDate">>) {
  const updateData: any = {};
  if (updates.lotNumber !== undefined) updateData.lot_number = updates.lotNumber;
  if (updates.expiryDate !== undefined) updateData.expiry_date = updates.expiryDate;
  const { error } = await supabase.from("lot_entries").update(updateData).eq("id", id);
  if (error) throw error;
}

export async function consumeFromLots(productId: string, quantity: number): Promise<{ lotId: string; lotNumber: string; consumed: number }[]> {
  const { data: beforeSync, error: beforeSyncError } = await supabase
    .from("lot_entries")
    .select("id, lot_number, remaining_quantity")
    .eq("product_id", productId);
  if (beforeSyncError) throw beforeSyncError;

  const remainingByLot = await syncLotBalances(productId);
  const consumedLots = (beforeSync || [])
    .map((lot: any) => {
      const afterRemaining = remainingByLot.get(lot.id) ?? lot.remaining_quantity;
      const consumed = Math.max(0, lot.remaining_quantity - afterRemaining);
      return consumed > 0 ? { lotId: lot.id, lotNumber: lot.lot_number, consumed } : null;
    })
    .filter(Boolean) as { lotId: string; lotNumber: string; consumed: number }[];

  if (quantity > 0 && consumedLots.length > 0) {
    return consumedLots;
  }

  return [];
}

export async function getProductLots(productId: string): Promise<LotEntry[]> {
  await syncLotBalances(productId);
  const { data, error } = await supabase
    .from("lot_entries")
    .select("*")
    .eq("product_id", productId)
    .order("expiry_date", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function getExpiringLots(days: number = 30): Promise<(LotEntry & { daysUntilExpiry: number })[]> {
  await syncLotBalances();
  const { data, error } = await supabase
    .from("lot_entries")
    .select("*")
    .gt("remaining_quantity", 0);
  if (error) throw error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (data || [])
    .map((row) => {
      const entry = mapRow(row);
      const expiry = new Date(entry.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...entry, daysUntilExpiry: diff };
    })
    .filter((e) => e.daysUntilExpiry <= days)
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

export async function deleteLotEntry(id: string) {
  const { error } = await supabase.from("lot_entries").delete().eq("id", id);
  if (error) throw error;
}
