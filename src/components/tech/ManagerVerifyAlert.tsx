import { useEffect, useState } from "react";
import { ArrowRight, BellRing, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTechIssues, awaitingManager, fmtDateTimeFR, type TechIssue } from "@/lib/techData";

/** Alerte tableau de bord (manager) : matériels réparés en attente de sa vérification. */
export function ManagerVerifyAlert({ onOpen }: { onOpen: () => void }) {
  const [awaiting, setAwaiting] = useState<TechIssue[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await getTechIssues();
        if (!cancelled) setAwaiting(list.filter(awaitingManager));
      } catch {
        if (!cancelled) setAwaiting([]);
      }
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (awaiting.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border-2 border-primary shadow-sm p-4 mt-4 ring-4 ring-primary/20">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
          <BellRing className="h-4 w-4 animate-pulse" />
          {awaiting.length} matériel{awaiting.length > 1 ? "s" : ""} réparé{awaiting.length > 1 ? "s" : ""} à vérifier
        </h2>
        <Button size="sm" onClick={onOpen}>
          Vérifier <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
      <ul className="space-y-1 text-sm">
        {awaiting.slice(0, 5).map((i) => (
          <li key={i.id} className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <span className="font-medium">{i.equipment}</span>
              {i.location ? ` (${i.location})` : ""} — réparé par {i.tech_validated_by ?? "—"} le {fmtDateTimeFR(i.tech_validated_at)}
              {i.action_done ? <span className="text-muted-foreground"> · {i.action_done}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
