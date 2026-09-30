import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  getMiseEnPlaceStocks,
  setMiseEnPlaceStock,
  getMiseEnPlaceStocksForWeek,
  setMiseEnPlaceStockForWeek,
  weekStartOf,
} from "@/lib/miseEnPlaceData";

/**
 * Charge les valeurs de mise en place.
 * - Semaine courante (ou aucune) : valeur unique historique (comportement d'origine).
 * - Autre semaine : valeurs enregistrées pour cette semaine (week_start = lundi).
 */
export function useMiseEnPlace(weekStart?: string) {
  const [map, setMap] = useState<Record<string, number>>({});
  const currentWeek = weekStartOf();
  const isCurrent = !weekStart || weekStart === currentWeek;

  useEffect(() => {
    let cancelled = false;
    const loader = isCurrent ? getMiseEnPlaceStocks() : getMiseEnPlaceStocksForWeek(weekStart!);
    loader
      .then((r) => { if (!cancelled) setMap(r); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [weekStart, isCurrent]);

  const save = useCallback(async (productId: string, value: number) => {
    setMap((prev) => ({ ...prev, [productId]: value }));
    try {
      if (isCurrent) await setMiseEnPlaceStock(productId, value);
      else await setMiseEnPlaceStockForWeek(productId, value, weekStart!);
    } catch (e: any) {
      toast.error(e?.message || "Enregistrement impossible");
    }
  }, [isCurrent, weekStart]);

  return { map, save };
}

export function MiseEnPlaceInput({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value ?? 0));
  useEffect(() => { setDraft(String(value ?? 0)); }, [value]);
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft) || 0;
        if (n !== value) onSave(n);
      }}
      className="h-8 w-20 text-right font-mono text-sm ml-auto"
    />
  );
}
