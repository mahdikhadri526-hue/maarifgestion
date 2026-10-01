import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  getMiseEnPlaceStocks,
  getMiseEnPlaceStocksUpToWeek,
  setMiseEnPlaceStockForWeek,
  weekStartOf,
} from "@/lib/miseEnPlaceData";

/**
 * Charge les valeurs de mise en place d'UNE semaine (week_start = lundi).
 * Chaque semaine a ses propres saisies. Pour la semaine courante sans saisie,
 * on reprend l'ancienne valeur unique (avant le passage hebdomadaire).
 */
export function useMiseEnPlace(weekStart?: string) {
  const [map, setMap] = useState<Record<string, number>>({});
  const currentWeek = weekStartOf();
  const week = weekStart || currentWeek;
  const isCurrent = week === currentWeek;

  useEffect(() => {
    let cancelled = false;
    setMap({});
    (async () => {
      let r = await getMiseEnPlaceStocksUpToWeek(week);
      if (isCurrent && Object.keys(r).length === 0) {
        r = await getMiseEnPlaceStocks(true);
      }
      if (!cancelled) setMap(r);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [week, isCurrent]);

  const save = useCallback(async (productId: string, value: number) => {
    setMap((prev) => ({ ...prev, [productId]: value }));
    try {
      await setMiseEnPlaceStockForWeek(productId, value, week);
    } catch (e: any) {
      toast.error(e?.message || "Enregistrement impossible");
    }
  }, [week]);

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
