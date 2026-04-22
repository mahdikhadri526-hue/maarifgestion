import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  const refresh = useCallback(async () => {
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      console.error("Data fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    refresh();

    const channels = tables.map((table) =>
      supabase
        .channel(`realtime-${table}-${Math.random()}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          refresh();
        })
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [refresh]);

  return { data, loading, refresh };
}

export function useMovements() {
  return useRealtimeData(getMovements, ["stock_movements"]);
}

export function useStockLevels(category?: Category) {
  return useRealtimeData(
    () => getStockLevels(category),
    ["stock_movements", "initial_stocks"],
    [category]
  );
}

export function useStockDashboard() {
  return useRealtimeData(async () => {
    const [levels, movements] = await Promise.all([getStockLevels(), getMovements()]);
    return { levels, movements };
  }, ["stock_movements", "initial_stocks"]);
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
