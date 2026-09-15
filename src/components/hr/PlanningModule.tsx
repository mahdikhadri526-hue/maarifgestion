import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarDays, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PlanningGrid } from "./PlanningGrid";
import {
  getHolidays,
  getHrAgents,
  type HrAgent,
  type HrHoliday,
} from "@/lib/hrData";

/**
 * Module « Planning » — sert uniquement à élaborer le planning hebdomadaire
 * des agents par le manager (grille, sans gestion des agents).
 */
export function PlanningModule() {
  const { pdvId, pdvs, can, isAdmin } = useAuth();
  const isRh = isAdmin || can("manage_hr");
  const scopePdvIds = useMemo(
    () => (isRh ? null : pdvId ? [pdvId] : []),
    [isRh, pdvId],
  );

  const [agents, setAgents] = useState<HrAgent[]>([]);
  const [holidays, setHolidays] = useState<HrHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdvFilter, setPdvFilter] = useState<string>(pdvId ?? "all");

  const reload = useCallback(async () => {
    if (scopePdvIds && scopePdvIds.length === 0) return;
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const [a, h] = await Promise.all([
        getHrAgents(scopePdvIds),
        getHolidays(`${year - 1}-01-01`, `${year + 1}-12-31`),
      ]);
      setAgents(a);
      setHolidays(h);
    } catch (e: any) {
      toast.error(e?.message ?? "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [scopePdvIds]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pdvName = pdvs.find((p) => p.id === pdvId)?.name ?? "Mon point de vente";

  /** Caissiers, ménage et sécurité : la grille les filtre selon le PDV planifié. */
  const isShared = (poste: string | null) => {
    const p = (poste ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    return p === "caissier" || p === "menage" || p.includes("securite");
  };

  const visibleAgents = useMemo(
    () =>
      agents.filter(
        (a) => pdvFilter === "all" || a.pdv_id === pdvFilter || a.multi_pdv || isShared(a.poste),
      ),
    [agents, pdvFilter],
  );

  const planningPdvId = isRh ? (pdvFilter === "all" ? null : pdvFilter) : pdvId;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CalendarDays className="w-5 h-5" /> Planning
        </h2>
        <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        {isRh && <Badge variant="secondary">Vue RH — tous les PDV</Badge>}
        <div className="ml-auto">
          {isRh ? (
            <select
              className="h-9 rounded border bg-background px-2 text-sm"
              value={pdvFilter}
              onChange={(e) => setPdvFilter(e.target.value)}
            >
              <option value="all">Tous les PDV</option>
              {pdvs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <Badge variant="outline">{pdvName}</Badge>
          )}
        </div>
      </div>

      <PlanningGrid
        agents={visibleAgents}
        holidays={holidays}
        isRh={isRh}
        onChanged={reload}
        showLevelToggle={false}
        groupedCategories
        planningPdvId={planningPdvId}
      />
    </div>
  );
}
