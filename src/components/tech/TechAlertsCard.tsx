import { useEffect, useState } from "react";
import { Wrench, ArrowRight, AlertTriangle, Clock, XCircle, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getTechIssues,
  getTechEvents,
  isOverdue,
  fmtDateTimeFR,
  TECH_PRIORITIES,
  type TechIssue,
  type TechEvent,
} from "@/lib/techData";

const todayISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Carte tableau de bord : notifications Suivi Technique
 *  (nouveaux signalements, retards de traitement, refus manager). */
export function TechAlertsCard({ onOpen }: { onOpen: () => void }) {
  const [issues, setIssues] = useState<TechIssue[] | null>(null);
  const [refusals, setRefusals] = useState<TechEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, events] = await Promise.all([getTechIssues(), getTechEvents()]);
        if (cancelled) return;
        setIssues(list);
        setRefusals(events.filter((e) => e.event_type === "refus_manager"));
      } catch {
        if (!cancelled) setIssues([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!issues) return null;

  const today = todayISO();
  const nouveaux = issues.filter((i) => i.status === "a_traiter");
  const retards = issues.filter((i) => isOverdue(i, today));
  const openIds = new Set(issues.filter((i) => i.status !== "cloture").map((i) => i.id));
  const refusSeen = new Set<string>();
  const refus = refusals.filter((e) => {
    if (!openIds.has(e.issue_id) || refusSeen.has(e.issue_id)) return false;
    refusSeen.add(e.issue_id);
    return true;
  });

  if (nouveaux.length === 0 && retards.length === 0 && refus.length === 0) return null;

  const byId = new Map(issues.map((i) => [i.id, i]));
  const prio = (k: string) => TECH_PRIORITIES.find((p) => p.key === k);

  return (
    <div className="bg-card rounded-xl border border-destructive/40 shadow-sm p-4 mt-4 ring-1 ring-destructive/20">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Wrench className="h-4 w-4" /> Suivi Technique – Notifications
          <BellRing className="h-4 w-4 text-destructive animate-pulse" />
        </h2>
        <Button size="sm" onClick={onOpen}>
          Ouvrir le suivi <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat color="text-orange-600" bg="bg-orange-50 border-orange-200" label="🟠 Signalements à traiter" value={nouveaux.length} />
        <Stat color="text-red-600" bg="bg-red-50 border-red-200" label="🔴 Retards de traitement" value={retards.length} />
        <Stat color="text-purple-700" bg="bg-purple-50 border-purple-200" label="⛔ Refus manager" value={refus.length} />
      </div>

      <ul className="space-y-1.5 text-sm">
        {nouveaux.slice(0, 5).map((i) => (
          <li key={"n" + i.id} className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
            <span className="flex-1">
              <span className="font-medium">{i.equipment}</span>
              {i.location ? ` (${i.location})` : ""} — {i.problem}
              <span className="text-muted-foreground"> · signalé par {i.reported_by} le {fmtDateTimeFR(i.reported_at)}</span>
            </span>
            <Badge className={prio(i.priority)?.className}>{prio(i.priority)?.label}</Badge>
          </li>
        ))}
        {retards.slice(0, 5).map((i) => (
          <li key={"r" + i.id} className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span className="flex-1">
              <span className="font-medium">{i.equipment}</span> — deadline dépassée ({i.deadline?.split("-").reverse().join(".")})
              {i.assigned_to ? <span className="text-muted-foreground"> · responsable : {i.assigned_to}</span> : null}
            </span>
          </li>
        ))}
        {refus.slice(0, 5).map((e) => {
          const i = byId.get(e.issue_id);
          return (
            <li key={"f" + e.id} className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-purple-700 shrink-0 mt-0.5" />
              <span className="flex-1">
                <span className="font-medium">{i?.equipment ?? "Matériel"}</span> — refusé par le manager {e.actor_name ?? ""} le {fmtDateTimeFR(e.created_at)}
                {e.details?.comment ? <span className="text-muted-foreground"> · {String(e.details.comment)}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
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
