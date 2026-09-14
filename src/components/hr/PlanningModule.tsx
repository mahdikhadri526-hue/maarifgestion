import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarDays, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PlanningGrid } from "./PlanningGrid";
import {
  createHrAgent,
  deleteHrAgent,
  formatFr,
  getHolidays,
  getHrAgents,
  getPlanningRows,
  POSTES,
  type HrAgent,
  type HrHoliday,
  type PlanningRow,
} from "@/lib/hrData";

/**
 * Module « Planning » — table séparée listant les agents par PDV.
 * Basée sur la table public.planning (synchronisée avec attendance_agents).
 */
export function PlanningModule() {
  const { pdvId, pdvs, can, isAdmin } = useAuth();
  const isRh = isAdmin || can("manage_hr");
  const scopePdvIds = useMemo(
    () => (isRh ? null : pdvId ? [pdvId] : []),
    [isRh, pdvId],
  );

  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [agents, setAgents] = useState<HrAgent[]>([]);
  const [holidays, setHolidays] = useState<HrHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdvFilter, setPdvFilter] = useState<string>(pdvId ?? "all");
  const [section, setSection] = useState<"grille" | "liste">("grille");

  const reload = useCallback(async () => {
    if (scopePdvIds && scopePdvIds.length === 0) return;
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const [p, a, h] = await Promise.all([
        getPlanningRows(scopePdvIds),
        getHrAgents(scopePdvIds),
        getHolidays(`${year - 1}-01-01`, `${year + 1}-12-31`),
      ]);
      setRows(p);
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

  const pdvName = (id: string) => pdvs.find((p) => p.id === id)?.name ?? "—";

  const visible = useMemo(
    () => rows.filter((r) => pdvFilter === "all" || r.pdv_id === pdvFilter),
    [rows, pdvFilter],
  );

  const visibleAgents = useMemo(
    () => agents.filter((a) => pdvFilter === "all" || a.pdv_id === pdvFilter),
    [agents, pdvFilter],
  );

  /* ------------------------------------------------------------ Ajout */
  const [name, setName] = useState("");
  const [matricule, setMatricule] = useState("");
  const [hire, setHire] = useState("");
  const [poste, setPoste] = useState("");
  const [level, setLevel] = useState<"agent" | "manager">("agent");
  const [newPdvId, setNewPdvId] = useState<string>(pdvId ?? "");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!newPdvId) {
      toast.error("Choisissez le point de vente");
      return;
    }
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createHrAgent({
        pdv_id: newPdvId,
        full_name: name,
        poste: poste || null,
        hire_date: hire || null,
        staff_level: level,
        matricule: matricule || null,
      });
      setName("");
      setMatricule("");
      setHire("");
      setPoste("");
      toast.success("Agent ajouté au planning");
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Ajout impossible");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: PlanningRow) => {
    if (!r.agent_id) {
      toast.error("Cette ligne n'est pas liée à un agent");
      return;
    }
    if (!confirm(`Supprimer ${r.full_name} ? Son planning sera également supprimé.`)) return;
    try {
      await deleteHrAgent(r.agent_id);
      toast.success("Agent supprimé");
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Suppression impossible");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CalendarDays className="w-5 h-5" /> Planning
        </h2>
        <Button
          size="sm"
          variant={section === "grille" ? "default" : "outline"}
          onClick={() => setSection("grille")}
        >
          <CalendarDays className="w-4 h-4 mr-1" /> Planning hebdomadaire
        </Button>
        <Button
          size="sm"
          variant={section === "liste" ? "default" : "outline"}
          onClick={() => setSection("liste")}
        >
          <Users className="w-4 h-4 mr-1" /> Liste des agents
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        {isRh && <Badge variant="secondary">Vue RH — tous les PDV</Badge>}
        <div className="ml-auto">
          <select
            className="h-9 rounded border bg-background px-2 text-sm"
            value={pdvFilter}
            onChange={(e) => setPdvFilter(e.target.value)}
          >
            {isRh && <option value="all">Tous les PDV</option>}
            {pdvs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card className="p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-7 items-end">
        <div className="sm:col-span-2">
          <label className="text-[11px] text-muted-foreground">Nom et prénom</label>
          <Input
            className="h-9"
            value={name}
            placeholder="Nouvel agent"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void add()}
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Matricule</label>
          <Input
            className="h-9"
            value={matricule}
            placeholder="N° matricule"
            onChange={(e) => setMatricule(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void add()}
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Date d'embauche</label>
          <Input
            className="h-9"
            type="date"
            value={hire}
            onChange={(e) => setHire(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Poste</label>
          <select
            className="h-9 w-full rounded border bg-background px-2 text-sm"
            value={poste}
            onChange={(e) => setPoste(e.target.value)}
          >
            <option value="">Poste…</option>
            {POSTES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Niveau</label>
          <select
            className="h-9 w-full rounded border bg-background px-2 text-sm"
            value={level}
            onChange={(e) => setLevel(e.target.value as "agent" | "manager")}
          >
            <option value="agent">Agent</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Point de vente</label>
          <div className="flex gap-2">
            <select
              className="h-9 w-full rounded border bg-background px-2 text-sm"
              value={newPdvId}
              onChange={(e) => setNewPdvId(e.target.value)}
            >
              <option value="">PDV…</option>
              {pdvs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button size="sm" className="h-9" onClick={() => void add()} disabled={busy || !name.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Matricule</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Embauche</th>
              <th className="px-3 py-2">Poste</th>
              <th className="px-3 py-2">Niveau</th>
              {isRh && <th className="px-3 py-2">PDV</th>}
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  {loading ? "Chargement…" : "Aucun agent dans le planning"}
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2">{r.matricule ?? "—"}</td>
                <td className="px-3 py-2 font-medium">{r.full_name}</td>
                <td className="px-3 py-2">{r.hire_date ? formatFr(r.hire_date) : "—"}</td>
                <td className="px-3 py-2">{r.poste ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant={r.staff_level === "manager" ? "default" : "outline"}>
                    {r.staff_level === "manager" ? "Manager" : "Agent"}
                  </Badge>
                </td>
                {isRh && <td className="px-3 py-2">{pdvName(r.pdv_id)}</td>}
                <td className="px-3 py-2">
                  <Badge variant={r.active ? "secondary" : "destructive"}>
                    {r.active ? "Actif" : "Inactif"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => void remove(r)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">
        {visible.length} agent(s) — cette liste alimente l'élaboration du planning hebdomadaire.
      </p>
        </>
      )}
    </div>
  );
}
