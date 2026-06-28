import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePaginate";
import { getStockLevels, StockLevel } from "@/lib/stockData";
import { getLotEntries, LotEntry } from "@/lib/lotData";

export type InventoryStatus = "counting" | "reconciling" | "closed";
export type CounterSlot = "A" | "B";

export interface InventorySession {
  id: string;
  label: string;
  sessionDate: string;
  status: InventoryStatus;
  counterAUserId: string | null;
  counterBUserId: string | null;
  counterADone: boolean;
  counterBDone: boolean;
  createdBy: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface InventoryLine {
  id: string;
  sessionId: string;
  category: string;
  productId: string;
  productName: string;
  lotId: string | null;
  lotNumber: string | null;
  theoreticalQty: number;
  sortOrder: number;
}

export interface InventoryCount {
  id: string;
  sessionId: string;
  lineId: string;
  counterSlot: CounterSlot;
  countedByUserId: string;
  stockQty: number | null;
  miseEnPlaceQty: number | null;
  updatedAt: string;
}

export interface InventoryResolution {
  id: string;
  sessionId: string;
  lineId: string;
  finalStockQty: number | null;
  finalMiseEnPlaceQty: number | null;
  varianceVsTheoretical: number | null;
  resolvedBy: string | null;
  resolvedAt: string;
}

function categorizeLevel(level: StockLevel): string {
  const name = level.productName.toUpperCase();
  if (name === "GLACE") return "GLACE";
  if (name.startsWith("TARTE") || name === "TOPPINGS") return "TARTE";
  if (level.category === "emballage") return "EMBALLAGE";
  return "ALIMENTAIRE";
}

const CATEGORY_ORDER = ["ALIMENTAIRE", "EMBALLAGE", "TARTE", "GLACE"];

export interface SeedLine {
  category: string;
  productId: string;
  productName: string;
  lotId: string | null;
  lotNumber: string | null;
  theoreticalQty: number;
  sortOrder: number;
}

export async function buildInventorySeedLines(): Promise<SeedLine[]> {
  const [levels, lots] = await Promise.all([getStockLevels(), getLotEntries()]);
  const lotsByProduct = new Map<string, LotEntry[]>();
  for (const lot of lots) {
    if ((lot.remainingQuantity ?? 0) <= 0) continue;
    const arr = lotsByProduct.get(lot.productId) ?? [];
    arr.push(lot);
    lotsByProduct.set(lot.productId, arr);
  }

  const seeds: SeedLine[] = [];
  for (const level of levels) {
    const category = categorizeLevel(level);
    const productLots = lotsByProduct.get(level.productId);
    if (productLots && productLots.length > 0) {
      // Sort lots by expiry/entry (FIFO)
      productLots.sort((a, b) => (a.expiryDate || "").localeCompare(b.expiryDate || ""));
      // Split theoretical across lots proportionally to remaining quantity.
      const totalRem = productLots.reduce((s, l) => s + (l.remainingQuantity || 0), 0);
      for (const lot of productLots) {
        const share = totalRem > 0 ? lot.remainingQuantity / totalRem : 1 / productLots.length;
        seeds.push({
          category,
          productId: level.productId,
          productName: level.productName,
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          theoreticalQty: Number((level.stockRestant * share).toFixed(2)),
          sortOrder: 0,
        });
      }
    } else {
      seeds.push({
        category,
        productId: level.productId,
        productName: level.productName,
        lotId: null,
        lotNumber: null,
        theoreticalQty: level.stockRestant,
        sortOrder: 0,
      });
    }
  }

  seeds.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) return (ca === -1 ? 99 : ca) - (cb === -1 ? 99 : cb);
    const nm = a.productName.localeCompare(b.productName);
    if (nm !== 0) return nm;
    return (a.lotNumber ?? "").localeCompare(b.lotNumber ?? "");
  });
  seeds.forEach((s, i) => (s.sortOrder = i));
  return seeds;
}

function mapSession(r: any): InventorySession {
  return {
    id: r.id,
    label: r.label,
    sessionDate: r.session_date,
    status: r.status,
    counterAUserId: r.counter_a_user_id,
    counterBUserId: r.counter_b_user_id,
    counterADone: r.counter_a_done,
    counterBDone: r.counter_b_done,
    createdBy: r.created_by,
    createdAt: r.created_at,
    closedAt: r.closed_at,
  };
}
function mapLine(r: any): InventoryLine {
  return {
    id: r.id,
    sessionId: r.session_id,
    category: r.category,
    productId: r.product_id,
    productName: r.product_name,
    lotId: r.lot_id,
    lotNumber: r.lot_number,
    theoreticalQty: Number(r.theoretical_qty),
    sortOrder: r.sort_order,
  };
}
function mapCount(r: any): InventoryCount {
  return {
    id: r.id,
    sessionId: r.session_id,
    lineId: r.line_id,
    counterSlot: r.counter_slot,
    countedByUserId: r.counted_by_user_id,
    stockQty: r.stock_qty === null ? null : Number(r.stock_qty),
    miseEnPlaceQty: r.mise_en_place_qty === null ? null : Number(r.mise_en_place_qty),
    updatedAt: r.updated_at,
  };
}
function mapResolution(r: any): InventoryResolution {
  return {
    id: r.id,
    sessionId: r.session_id,
    lineId: r.line_id,
    finalStockQty: r.final_stock_qty === null ? null : Number(r.final_stock_qty),
    finalMiseEnPlaceQty: r.final_mise_en_place_qty === null ? null : Number(r.final_mise_en_place_qty),
    varianceVsTheoretical: r.variance_vs_theoretical === null ? null : Number(r.variance_vs_theoretical),
    resolvedBy: r.resolved_by,
    resolvedAt: r.resolved_at,
  };
}

export async function listSessions(): Promise<InventorySession[]> {
  const data = await fetchAllRows<any>(() =>
    supabase.from("inventory_sessions").select("*").order("session_date", { ascending: false }),
  );
  return data.map(mapSession);
}

export async function getSession(id: string): Promise<InventorySession | null> {
  const { data, error } = await supabase.from("inventory_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapSession(data) : null;
}

export async function createSession(params: {
  label: string;
  sessionDate: string;
  counterAUserId: string;
  counterBUserId: string;
}): Promise<InventorySession> {
  const { data: userResp } = await supabase.auth.getUser();
  const uid = userResp.user?.id ?? null;
  const { data, error } = await supabase
    .from("inventory_sessions")
    .insert({
      label: params.label,
      session_date: params.sessionDate,
      counter_a_user_id: params.counterAUserId,
      counter_b_user_id: params.counterBUserId,
      created_by: uid,
    })
    .select()
    .single();
  if (error) throw error;
  const session = mapSession(data);

  const seeds = await buildInventorySeedLines();
  if (seeds.length > 0) {
    const rows = seeds.map((s) => ({
      session_id: session.id,
      category: s.category,
      product_id: s.productId,
      product_name: s.productName,
      lot_id: s.lotId,
      lot_number: s.lotNumber,
      theoretical_qty: s.theoreticalQty,
      sort_order: s.sortOrder,
    }));
    // Insert in chunks
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error: insErr } = await supabase.from("inventory_lines").insert(chunk);
      if (insErr) throw insErr;
    }
  }
  return session;
}

export async function listLines(sessionId: string): Promise<InventoryLine[]> {
  const data = await fetchAllRows<any>(() =>
    supabase.from("inventory_lines").select("*").eq("session_id", sessionId).order("sort_order", { ascending: true }),
  );
  return data.map(mapLine);
}

export async function listMyCounts(sessionId: string): Promise<InventoryCount[]> {
  const { data, error } = await supabase
    .from("inventory_counts")
    .select("*")
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []).map(mapCount);
}

export async function upsertCount(params: {
  sessionId: string;
  lineId: string;
  counterSlot: CounterSlot;
  stockQty: number | null;
  miseEnPlaceQty: number | null;
}): Promise<void> {
  const { data: userResp } = await supabase.auth.getUser();
  const uid = userResp.user?.id;
  if (!uid) throw new Error("Non authentifié");
  const { error } = await supabase
    .from("inventory_counts")
    .upsert(
      {
        session_id: params.sessionId,
        line_id: params.lineId,
        counter_slot: params.counterSlot,
        counted_by_user_id: uid,
        stock_qty: params.stockQty,
        mise_en_place_qty: params.miseEnPlaceQty,
      },
      { onConflict: "session_id,line_id,counter_slot" },
    );
  if (error) throw error;
}

export async function markCounterDone(sessionId: string, slot: CounterSlot): Promise<void> {
  const patch = slot === "A" ? { counter_a_done: true } : { counter_b_done: true };
  const { error } = await supabase.from("inventory_sessions").update(patch).eq("id", sessionId);
  if (error) throw error;
}

export async function setSessionStatus(sessionId: string, status: InventoryStatus): Promise<void> {
  const patch: any = { status };
  if (status === "closed") patch.closed_at = new Date().toISOString();
  const { error } = await supabase.from("inventory_sessions").update(patch).eq("id", sessionId);
  if (error) throw error;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from("inventory_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

export async function listAllCounts(sessionId: string): Promise<InventoryCount[]> {
  const data = await fetchAllRows<any>(() =>
    supabase.from("inventory_counts").select("*").eq("session_id", sessionId),
  );
  return data.map(mapCount);
}

export async function listResolutions(sessionId: string): Promise<InventoryResolution[]> {
  const data = await fetchAllRows<any>(() =>
    supabase.from("inventory_resolutions").select("*").eq("session_id", sessionId),
  );
  return data.map(mapResolution);
}

export async function upsertResolution(params: {
  sessionId: string;
  lineId: string;
  finalStockQty: number;
  finalMiseEnPlaceQty: number | null;
  theoreticalQty: number;
}): Promise<void> {
  const { data: userResp } = await supabase.auth.getUser();
  const uid = userResp.user?.id ?? null;
  const variance = params.finalStockQty - params.theoreticalQty;
  const { error } = await supabase
    .from("inventory_resolutions")
    .upsert(
      {
        session_id: params.sessionId,
        line_id: params.lineId,
        final_stock_qty: params.finalStockQty,
        final_mise_en_place_qty: params.finalMiseEnPlaceQty,
        variance_vs_theoretical: variance,
        resolved_by: uid,
        resolved_at: new Date().toISOString(),
      },
      { onConflict: "session_id,line_id" },
    );
  if (error) throw error;
}

export async function listProfiles(): Promise<{ userId: string; label: string }[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, email, display_name")
    .order("display_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    userId: r.user_id,
    label: r.display_name || r.email,
  }));
}