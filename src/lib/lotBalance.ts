import { supabase } from "@/lib/db";
import { fetchAllRows } from "@/lib/supabasePaginate";
import { cached, invalidateTables } from "@/lib/requestCache";

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

const isLotAvailableForMovement = (lot: LotRow, movement: MovementRow) => {
  const lotDay = toDayKey(lot.entry_date);
  const movementDay = toDayKey(movement.date);

  if (lotDay < movementDay) return true;
  if (lotDay > movementDay) return false;

  // Même journée : ne pas consommer un lot créé après une sortie déjà saisie.
  return lot.created_at <= movement.created_at;
};

/**
 * Recalcule les soldes FIFO des lots.
 * Le calcul est partagé pendant quelques secondes entre les composants qui
 * l'appellent simultanément (alertes, tables de lots...) ; `force` le relance
 * immédiatement après une écriture.
 */
export async function syncLotBalances(productId?: string, force = false): Promise<Map<string, number>> {
  if (force) invalidateTables(["lot_entries", "stock_movements"]);
  return cached(`lotBalances:${productId ?? "__all__"}`, ["lot_entries", "stock_movements"], () =>
    computeLotBalances(productId),
  );
}

async function computeLotBalances(productId?: string): Promise<Map<string, number>> {
  const buildLots = () =>
    productId
      ? supabase.from("lot_entries").select("*").eq("product_id", productId)
      : supabase.from("lot_entries").select("*");
  const buildMovements = () => {
    const q = supabase
      .from("stock_movements")
      .select("product_id, quantity, date, created_at")
      .eq("category", "alimentaire")
      .eq("type", "sortie");
    return productId ? q.eq("product_id", productId) : q;
  };

  const [lotRows, movementRows] = await Promise.all([
    fetchAllRows<LotRow>(buildLots),
    fetchAllRows<MovementRow>(buildMovements),
  ]);

  const lots = lotRows;
  const movements = movementRows.sort(compareMovements);
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
          isLotAvailableForMovement(lot, movement) && (remainingByLot.get(lot.id) || 0) > 0,
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

  // Réconciliation avec la table « Stock restant » :
  // le total des quantités restantes des lots d'un produit doit correspondre
  // exactement à la quantité affichée dans le stock restant
  // (stock initial + entrées - sorties, régularisations incluses).
  await reconcileWithStockLevels(lotsByProduct, remainingByLot);

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