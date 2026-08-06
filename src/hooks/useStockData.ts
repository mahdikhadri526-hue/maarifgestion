import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invalidateTables } from "@/lib/requestCache";
import {
  StockMovement, StockLevel, DailyStockRecord, Category, UnitType,
  getMovements, getStockLevels, getProductDailyHistory, getInitialStocks, getProductUnits,
  getProductUnitConfigs
} from "@/lib/stockData";
import { LotEntry, getExpiringLots, getProductLots, getLotEntries } from "@/lib/lotData";
import { RequisitionEntry, getRequisitionsByDate, getRequisitions } from "@/lib/requisitionData";

// Generic hook for async data with realtime refresh
function useRealtimeData<T>(
  fetchFn: () => Promise<T>,
  tables: string[],
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const load = useCallback(async (bypassCache: boolean) => {
    // Un rafraîchissement explicite (bouton, écriture) repart de données fraîches ;
    // le premier chargement peut réutiliser le cache court partagé entre modules.
    if (bypassCache) invalidateTables(tables);
    // Coalesce concurrent refreshes to a single in-flight request
    if (inFlightRef.current) return inFlightRef.current;
    const p = (async () => {
      try {
        const result = await fetchFn();
        setData(result);
      } catch (err) {
        console.error("Data fetch error:", err);
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = p;
    return p;
  }, deps);

  const refresh = useCallback(() => load(true), [load]);

  // Debounce burst realtime events (e.g. bulk inserts) to a single refresh
  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      load(false);
    }, 250);
  }, [load]);

  useEffect(() => {
    load(false);

    const channels = tables.map((table) =>
      supabase
        .channel(`realtime-${table}-${Math.random()}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          invalidateTables([table]);
          scheduleRefresh();
        })
        .subscribe()
    );

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [load, scheduleRefresh]);

  return { data, loading, refresh };
}

export function useMovements() {
  return useRealtimeData(getMovements, ["stock_movements"]);
}

export function useStockLevels(category?: Category) {
  return useRealtimeData(
    () => getStockLevels(category),
    ["stock_movements", "initial_stocks", "weekly_tracking", "glace_grammage"],
    [category]
  );
}

export function useStockDashboard() {
  return useRealtimeData(async () => {
    const [levels, movements] = await Promise.all([getStockLevels(), getMovements()]);
    return { levels, movements };
  }, ["stock_movements", "initial_stocks", "weekly_tracking", "glace_grammage"]);
}

export function useProductDailyHistory(productId: string) {
  return useRealtimeData(
    () => getProductDailyHistory(productId),
    ["stock_movements", "initial_stocks"],
    [productId]
  );
}

export function useInitialStocks() {
  return useRealtimeData(getInitialStocks, ["initial_stocks"]);
}

export function useProductUnits() {
  return useRealtimeData(getProductUnits, ["initial_stocks"]);
}

export function useProductUnitConfigs() {
  return useRealtimeData(getProductUnitConfigs, ["initial_stocks"]);
}

export function useExpiringLots(days: number = 30) {
  return useRealtimeData(() => getExpiringLots(days), ["lot_entries"], [days]);
}

export function useProductLots(productId: string | null) {
  return useRealtimeData(
    () => {
      if (productId === null) return Promise.resolve([]);
      if (productId === "__all__") return getLotEntries();
      return getProductLots(productId);
    },
    ["lot_entries"],
    [productId]
  );
}

export function useRequisitionsByDate(date: string, type: "salle" | "emporter") {
  return useRealtimeData(
    () => getRequisitionsByDate(date, type),
    ["requisitions"],
    [date, type]
  );
}

export function useAllRequisitions() {
  return useRealtimeData(getRequisitions, ["requisitions"]);
}
