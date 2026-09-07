import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getMiseEnPlaceStocks, setMiseEnPlaceStock } from "@/lib/miseEnPlaceData";

export function useMiseEnPlace() {
  const [map, setMap] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    getMiseEnPlaceStocks()
      .then((m) => { if (!cancelled) setMap(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async (productId: string, value: number) => {
    setMap((prev) => ({ ...prev, [productId]: value }));
    try {
      await setMiseEnPlaceStock(productId, value);
    } catch (e: any) {
      toast.error(e?.message || "Enregistrement impossible");
    }
  }, []);

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
