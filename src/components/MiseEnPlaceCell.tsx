import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  getMiseEnPlaceStocks,
  getMiseEnPlaceStocksForWeek,
  setMiseEnPlaceStockForWeek,
  weekStartOf,
  getPackagingMepInputsForWeek,
  type PackagingMepInputs,
} from "@/lib/miseEnPlaceData";

/**
 * Charge les valeurs de mise en place d'UNE semaine (week_start = lundi).
 * Chaque semaine a ses propres saisies. Pour la semaine courante sans saisie,
 * on reprend l'ancienne valeur unique (avant le passage hebdomadaire).
 */
export function useMiseEnPlace(weekStart?: string) {
  const [map, setMap] = useState<Record<string, number>>({});
  const [packagingInputs, setPackagingInputs] = useState<Record<string, PackagingMepInputs>>({});
  const currentWeek = weekStartOf();
  const week = weekStart || currentWeek;
  const isCurrent = week === currentWeek;

  useEffect(() => {
    let cancelled = false;
    setMap({});
    setPackagingInputs({});
    (async () => {
      let r = await getMiseEnPlaceStocksForWeek(week);
      if (isCurrent && Object.keys(r).length === 0) {
        r = await getMiseEnPlaceStocks(true);
      }
      if (!cancelled) setMap(r);
      const inputs = await getPackagingMepInputsForWeek(week);
      if (!cancelled) setPackagingInputs(inputs);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [week, isCurrent]);

  const save = useCallback(async (productId: string, value: number, inputs?: PackagingMepInputs) => {
    setMap((prev) => ({ ...prev, [productId]: value }));
    try {
      await setMiseEnPlaceStockForWeek(productId, value, week, inputs);
      if (inputs) setPackagingInputs(prev => ({ ...prev, [productId]: inputs }));
    } catch (e: any) {
      toast.error(e?.message || "Enregistrement impossible");
    }
  }, [week]);

  return { map, save, packagingInputs };
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
