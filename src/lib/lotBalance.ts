import { supabase } from "@/integrations/supabase/client";

type LotRow = {
  id: string;
  product_id: string;
  lot_number: string;
  expiry_date: string;
  quantity: number;
  remaining_quantity: number;
  entry_date: string;
  created_at: string;
};

type MovementRow = {
  product_id: string;
  quantity: number;
  date: string;
  created_at: string;
};

const toDayKey = (value: string) => value.split("T")[0] || value;

const compareLots = (a: LotRow, b: LotRow) =>
  a.expiry_date.localeCompare(b.expiry_date) ||
  a.entry_date.localeCompare(b.entry_date) ||
  a.created_at.localeCompare(b.created_at);

const compareMovements = (a: MovementRow, b: MovementRow) =>
  toDayKey(a.date).localeCompare(toDayKey(b.date)) || a.created_at.localeCompare(b.created_at);

export async function syncLotBalances(productId?: string): Promise<Map<string, number>> {
  const lotQuery = productId
    ? supabase.from("lot_entries").select("*").eq("product_id", productId)
    : supabase.from("lot_entries").select("*");
  const movementQuery = productId
    ? supabase
        .from("stock_movements")
        .select("product_id, quantity, date, created_at")
        .eq("category", "alimentaire")
        .eq("type", "sortie")
        .eq("product_id", productId)
    : supabase
        .from("stock_movements")
        .select("product_id, quantity, date, created_at")
        .eq("category", "alimentaire")
        .eq("type", "sortie");

  const [{ data: lotRows, error: lotError }, { data: movementRows, error: movementError }] = await Promise.all([
    lotQuery,
    movementQuery,
  ]);

  if (lotError) throw lotError;
  if (movementError) throw movementError;

  const lots = (lotRows || []) as LotRow[];
  const movements = ((movementRows || []) as MovementRow[]).sort(compareMovements);
  const remainingByLot = new Map<string, number>(lots.map((lot) => [lot.id, lot.quantity]));
  const lotsByProduct = new Map<string, LotRow[]>();

  lots.forEach((lot) => {
    const productLots = lotsByProduct.get(lot.product_id) || [];
    productLots.push(lot);
    lotsByProduct.set(lot.product_id, productLots);
  });

  movements.forEach((movement) => {
    let quantityToConsume = Math.max(0, movement.quantity || 0);
    if (quantityToConsume <= 0) return;

    const availableLots = (lotsByProduct.get(movement.product_id) || [])
      .filter(
        (lot) =>
          toDayKey(lot.entry_date) <= toDayKey(movement.date) && (remainingByLot.get(lot.id) || 0) > 0,
      )
      .sort(compareLots);

    for (const lot of availableLots) {
      if (quantityToConsume <= 0) break;

      const currentRemaining = remainingByLot.get(lot.id) || 0;
      if (currentRemaining <= 0) continue;

      const consumed = Math.min(currentRemaining, quantityToConsume);
      remainingByLot.set(lot.id, currentRemaining - consumed);
      quantityToConsume -= consumed;
    }
  });

  const changedLots = lots.filter((lot) => (remainingByLot.get(lot.id) ?? 0) !== lot.remaining_quantity);

  if (changedLots.length > 0) {
    await Promise.all(
      changedLots.map(async (lot) => {
        const { error } = await supabase
          .from("lot_entries")
          .update({ remaining_quantity: remainingByLot.get(lot.id) ?? 0 })
          .eq("id", lot.id);
        if (error) throw error;
      }),
    );
  }

  return remainingByLot;
}