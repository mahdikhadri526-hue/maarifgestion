import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getMiseEnPlaceStocks, setMiseEnPlaceStock, weekStartOf } from "@/lib/miseEnPlaceData";

// Semaine choisie, partagée entre tous les écrans.
let currentWeek = weekStartOf();
const listeners = new Set<() => void>();
function setMepWeek(w: string) {
  currentWeek = weekStartOf(new Date(w + "T00:00:00"));
  listeners.forEach((l) => l());
}
function useMepWeek() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => currentWeek
  );
}

export function useMiseEnPlace() {
  const week = useMepWeek();
  const [map, setMap] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    getMiseEnPlaceStocks(week)
      .then((r) => { if (!cancelled) { setMap(r.values); setSaved(r.saved); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [week]);

  const save = useCallback(async (productId: string, value: number) => {
    setMap((prev) => ({ ...prev, [productId]: value }));
    setSaved((prev) => ({ ...prev, [productId]: true }));
    try {
      await setMiseEnPlaceStock(productId, value, week);
    } catch (e: any) {
      toast.error(e?.message || "Enregistrement impossible");
    }
  }, [week]);

  return { map, saved, save, week };
}

function fmt(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function MepWeekPicker() {
  const week = useMepWeek();
  const end = new Date(week + "T00:00:00");
  end.setDate(end.getDate() + 6);
  const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Semaine mise en place :</span>
      <Input
        type="date"
        value={week}
        onChange={(e) => e.target.value && setMepWeek(e.target.value)}
        className="h-8 w-40"
      />
      <span className="text-xs text-muted-foreground">du {fmt(week)} au {fmt(endIso)}</span>
    </div>
  );
}

export function MiseEnPlaceInput({
  value,
  onSave,
  carried,
}: {
  value: number;
  onSave: (v: number) => void;
  carried?: boolean;
}) {
  const [draft, setDraft] = useState(String(value ?? 0));
  useEffect(() => { setDraft(String(value ?? 0)); }, [value]);
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={draft}
      title={carried ? "Valeur reprise de la semaine précédente" : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft) || 0;
        if (n !== value || carried) onSave(n);
      }}
      className={`h-8 w-20 text-right font-mono text-sm ml-auto ${carried ? "italic text-muted-foreground" : ""}`}
    />
  );
}
