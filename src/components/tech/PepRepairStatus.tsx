import { useCallback, useEffect, useMemo, useState } from "react";
import { Wrench, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  TECH_PRIORITIES,
  displayStatusMeta,
  TECH_STATUS_ORDER,
  TechIssue,
  awaitingManager,
  fmtDateTimeFR,
  getTechIssues,
  isOverdue,
} from "@/lib/techData";
import { formatDateFR } from "@/lib/utils";
import { ManagerValidateDialog } from "./TechModule";

const PRIO_RANK: Record<string, number> = { critique: 0, urgente: 1, normale: 2 };

/**
 * État d'avancement des réparations (dossiers Suivi Technique du PDV),
 * affiché dans l'Agenda PEP pour le manager. Le manager peut y effectuer la
 * vérification finale (matériel réparé → clôture).
 */
export function PepRepairStatus({ refreshKey = 0 }: { refreshKey?: number }) {
  const { can, pdvId } = useAuth();
  const canValidate = can("manage_pep") || can("view_pep");
  const [issues, setIssues] = useState<TechIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState<TechIssue | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (!pdvId) return;
    setLoading(true);
    try {
      setIssues(await getTechIssues());
    } catch (e: any) {
      toast({ title: "Suivi Technique", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [pdvId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const rows = useMemo(() => {
    const list = issues.filter((i) => showClosed || i.status !== "cloture");
    return list.sort((a, b) => {
      const s = TECH_STATUS_ORDER.indexOf(a.status) - TECH_STATUS_ORDER.indexOf(b.status);
      if (s !== 0) return s;
      const p = (PRIO_RANK[a.priority] ?? 9) - (PRIO_RANK[b.priority] ?? 9);
      if (p !== 0) return p;
      return b.reported_at.localeCompare(a.reported_at);
    });
  }, [issues, showClosed]);

  const awaiting = issues.filter(awaitingManager).length;
  const open = issues.filter((i) => i.status === "a_traiter" || i.status === "en_cours").length;

  if (!loading && issues.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b">
        <Wrench className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Avancement des réparations</h3>
        <span className="text-xs text-muted-foreground">{open} en cours · {awaiting} à vérifier</span>
        {awaiting > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-primary text-primary-foreground animate-pulse">
            {awaiting} matériel{awaiting > 1 ? "s" : ""} réparé{awaiting > 1 ? "s" : ""} à vérifier
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowClosed((v) => !v)}>
            {showClosed ? "Masquer clôturés" : "Voir clôturés"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>Actualiser</Button>
        </div>
      </div>
      {canValidate && awaiting > 0 && (
        <div className="px-3 py-2 border-b bg-primary/5 space-y-2">
          <div className="text-xs font-semibold text-primary">Vérification manager requise</div>
          {issues.filter(awaitingManager).map((i) => (
            <div key={"w" + i.id} className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex-1 min-w-[160px]">
                <span className="font-medium">{i.equipment}</span>
                {i.location ? ` (${i.location})` : ""}
                <div className="text-[10px] text-muted-foreground">
                  Réparé par {i.tech_validated_by ?? "—"} le {fmtDateTimeFR(i.tech_validated_at)}
                  {i.action_done ? ` · ${i.action_done}` : ""}
                </div>
              </div>
              <Button size="sm" onClick={() => setValidating(i)}>Vérifier le matériel</Button>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-2 py-1.5">Matériel</th>
              <th className="px-2 py-1.5">Problème</th>
              <th className="px-2 py-1.5">Priorité</th>
              <th className="px-2 py-1.5">Signalé</th>
              <th className="px-2 py-1.5">Statut</th>
              <th className="px-2 py-1.5">Responsable</th>
              <th className="px-2 py-1.5">Deadline</th>
              <th className="px-2 py-1.5">Réparation</th>
              <th className="px-2 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const st = displayStatusMeta(i);
              const pr = TECH_PRIORITIES.find((p) => p.key === i.priority);
              const late = isOverdue(i, today);
              const wait = awaitingManager(i);
              return (
                <tr key={i.id} className={`border-t ${late ? "bg-destructive/5" : wait ? "bg-primary/5" : ""}`}>
                  <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                    {i.equipment}
                    {i.location && <div className="text-[10px] text-muted-foreground font-normal">{i.location}</div>}
                  </td>
                  <td className="px-2 py-1.5 max-w-[220px] truncate" title={i.problem}>{i.problem}</td>
                  <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] ${pr?.className ?? ""}`}>{pr?.label ?? i.priority}</span></td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{fmtDateTimeFR(i.reported_at)}<div className="text-[10px] text-muted-foreground">{i.reported_by}</div></td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${st?.dot ?? ""}`} />{st?.label ?? i.status}</span>
                    {late && <div className="text-[10px] text-destructive inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Retard</div>}
                    {wait && <div className="text-[10px] text-primary">Attente vérification manager</div>}
                    {i.manager_validated_at && i.status === "cloture" && (
                      <div className="text-[10px] text-muted-foreground">Vérifié par {i.manager_validated_by} le {fmtDateTimeFR(i.manager_validated_at)}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5">{i.assigned_to ?? "—"}</td>
                  <td className={`px-2 py-1.5 whitespace-nowrap ${late ? "text-destructive font-semibold" : ""}`}>{i.deadline ? formatDateFR(i.deadline) : "—"}</td>
                  <td className="px-2 py-1.5 max-w-[220px]">
                    {i.tech_validated_at ? (
                      <div>
                        <div className="truncate" title={i.action_done ?? ""}>{i.action_done}</div>
                        <div className="text-[10px] text-muted-foreground">{i.tech_validated_by} · {fmtDateTimeFR(i.tech_validated_at)}</div>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    {canValidate && wait && (
                      <Button size="sm" onClick={() => setValidating(i)}>Vérifier</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {validating && <ManagerValidateDialog issue={validating} onClose={() => setValidating(null)} onSaved={load} />}
    </div>
  );
}
