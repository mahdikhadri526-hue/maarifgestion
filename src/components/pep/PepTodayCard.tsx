import { useEffect, useState } from "react";
import { CalendarClock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensurePlanning, getTodaySummary, type TodaySummary } from "@/lib/pepData";

/** Carte tableau de bord : uniquement les tâches PEP du jour. */
export function PepTodayCard({ onOpen }: { onOpen: () => void }) {
  const [sum, setSum] = useState<TodaySummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensurePlanning();
        const s = await getTodaySummary();
        if (!cancelled) setSum(s);
      } catch {
        if (!cancelled) setSum(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sum) return null;
  if (sum.todo === 0 && sum.late === 0 && sum.done === 0) return null;

  const allDone = sum.todo === 0 && sum.late === 0;

  return (
    <div className="bg-card rounded-xl border shadow-sm p-4 mt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CalendarClock className="h-4 w-4" /> Agenda PEP – Aujourd'hui
        </h2>
        <Button size="sm" onClick={onOpen}>
          Voir les tâches <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      {allDone ? (
        <p className="text-sm font-medium text-green-700">🟢 PEP du jour terminé ({sum.done} tâche(s) réalisée(s)).</p>
      ) : (
        <p className="text-sm font-medium mb-3">
          🔔 Vous avez {sum.todo + sum.late} tâche(s) PEP à effectuer aujourd'hui.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat color="text-orange-600" bg="bg-orange-50 border-orange-200" label="🟠 À faire" value={sum.todo} />
        <Stat color="text-red-600" bg="bg-red-50 border-red-200" label="🔴 En retard" value={sum.late} />
        <Stat color="text-green-700" bg="bg-green-50 border-green-200" label="🟢 Réalisées" value={sum.done} />
      </div>
    </div>
  );
}

function Stat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${bg}`}>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
