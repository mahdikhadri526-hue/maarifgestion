import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Download, Plus, RefreshCw, Sun, Trash2, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { AttendancePunch } from "@/lib/attendanceData";
import {
  addBalanceEntry,
  addHoliday,
  DAY_TYPES,
  DAY_TYPE_LABELS,
  DOW_LABELS,
  deleteBalanceEntry,
  deleteHoliday,
  fixedMoroccanHolidays,
  formatFr,
  getBalanceEntries,
  getHolidays,
  createHrAgent,
  deleteHrAgent,
  getHrAgents,
  getPunchesRange,
  getSchedules,
  isoDate,
  POSTES,
  saveSchedule,
  updateAgentHr,
  weekDays,
  weekStart,
  type DayType,
  type HrAgent,
  type HrBalanceEntry,
  type HrHoliday,
  type HrSchedule,
} from "@/lib/hrData";
import { computeBalance, computeDay, downloadCsv, toCsv } from "@/lib/hrCompute";
import { PlanningGrid, addWeek } from "./PlanningGrid";

type View = "planning" | "agents" | "soldes" | "feries" | "suivi";
type SuiviSection = "soldes" | "rapports";

export function HrModule() {
  const { pdvId, pdvs, can, isAdmin } = useAuth();
  const isRh = isAdmin || can("manage_hr");
  const scopePdvIds = useMemo(
    () => (isRh ? pdvs.map((p) => p.id) : pdvId ? [pdvId] : []),
    [isRh, pdvs, pdvId],
  );

  const [view, setView] = useState<View>("planning");
  const [suiviSection, setSuiviSection] = useState<SuiviSection>("soldes");
  const [agents, setAgents] = useState<HrAgent[]>([]);
  const [holidays, setHolidays] = useState<HrHoliday[]>([]);
  const [balances, setBalances] = useState<HrBalanceEntry[]>([]);
  const [allSchedules, setAllSchedules] = useState<HrSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (scopePdvIds.length === 0) return;
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const [a, h, b, s] = await Promise.all([
        getHrAgents(scopePdvIds),
        getHolidays(`${year - 1}-01-01`, `${year + 1}-12-31`),
        getBalanceEntries(scopePdvIds),
        getSchedules(scopePdvIds, `${year}-01-01`, `${year}-12-31`),
      ]);
      setAgents(a);
      setHolidays(h);
      setBalances(b);
      setAllSchedules(s);
    } catch (e: any) {
      toast.error(e?.message ?? "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [scopePdvIds]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const tabs: { id: View; label: string; icon: any }[] = [
    { id: "planning", label: "Planning", icon: CalendarDays },
    { id: "agents", label: "Agents", icon: Users },
    { id: "feries", label: "Jours fériés", icon: CalendarDays },
    { id: "suivi", label: "Congés & Rapports", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <Button key={t.id} size="sm" variant={view === t.id ? "default" : "outline"} onClick={() => setView(t.id)}>
            <t.icon className="w-4 h-4 mr-1" /> {t.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        {isRh && <Badge variant="secondary">Vue RH — tous les PDV</Badge>}
      </div>

      {view === "planning" && (
        <PlanningView agents={agents} holidays={holidays} isRh={isRh} onChanged={reload} />
      )}
      {view === "agents" && <AgentsHrView agents={agents} onChanged={reload} />}
      {view === "feries" && <HolidaysView holidays={holidays} canEdit={isRh} onChanged={reload} />}
      {view === "suivi" && (
        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 border-b pb-3">
            <Button
              size="sm"
              variant={suiviSection === "soldes" ? "default" : "outline"}
              onClick={() => setSuiviSection("soldes")}
            >
              <Sun className="w-4 h-4 mr-1" /> Congés & Récup
            </Button>
            <Button
              size="sm"
              variant={suiviSection === "rapports" ? "default" : "outline"}
              onClick={() => setSuiviSection("rapports")}
            >
              <BarChart3 className="w-4 h-4 mr-1" /> Rapports
            </Button>
          </div>
          {suiviSection === "soldes" ? (
            <BalancesView agents={agents} schedules={allSchedules} entries={balances} holidays={holidays} onChanged={reload} />
          ) : (
            <ReportsView agents={agents} holidays={holidays} scopePdvIds={scopePdvIds} isRh={isRh} />
          )}
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Agents RH */

function AgentsHrView({ agents, onChanged }: { agents: HrAgent[]; onChanged: () => Promise<void> | void }) {
  const { pdvs, pdvId } = useAuth();
  const [name, setName] = useState("");
  const [poste, setPoste] = useState("");
  const [level, setLevel] = useState<"agent" | "manager">("agent");
  const [hire, setHire] = useState("");
  const [newPdvId, setNewPdvId] = useState<string>(pdvId ?? "");
  const [busy, setBusy] = useState(false);

  const save = async (id: string, patch: any) => {
    try {
      await updateAgentHr(id, patch);
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Enregistrement impossible");
    }
  };

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
      });
      setName("");
      setPoste("");
      setHire("");
      toast.success("Agent ajouté");
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Ajout impossible");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: HrAgent) => {
    if (!confirm(`Supprimer ${a.full_name} ? Son planning sera également supprimé.`)) return;
    try {
      await deleteHrAgent(a.id);
      toast.success("Agent supprimé");
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Suppression impossible");
    }
  };

  return (
    <div className="space-y-2">
      <Card className="p-3 grid gap-2 sm:grid-cols-6 items-end">
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
          <label className="text-[11px] text-muted-foreground">Point de vente</label>
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
        </div>
        <select
          className="h-9 rounded border bg-background px-2 text-sm"
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
        <select
          className="h-9 rounded border bg-background px-2 text-sm"
          value={level}
          onChange={(e) => setLevel(e.target.value as any)}
        >
          <option value="agent">Agent</option>
          <option value="manager">Manager</option>
        </select>
        <div className="flex gap-2">
          <Input type="date" className="h-9" value={hire} onChange={(e) => setHire(e.target.value)} />
          <Button size="sm" onClick={() => void add()} disabled={busy || !name.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {agents.map((a) => (
        <Card key={a.id} className="p-3 grid gap-2 sm:grid-cols-5 items-center">
          <div>
            <p className="font-medium">{a.full_name}</p>
            <p className="text-xs text-muted-foreground">{pdvs.find((p) => p.id === a.pdv_id)?.name ?? ""}</p>
          </div>
          <select
            className="h-9 rounded border bg-background px-2 text-sm"
            value={a.poste ?? ""}
            onChange={(e) => void save(a.id, { poste: e.target.value || null })}
          >
            <option value="">Poste…</option>
            {POSTES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded border bg-background px-2 text-sm"
            value={a.staff_level ?? "agent"}
            onChange={(e) => void save(a.id, { staff_level: e.target.value as any })}
          >
            <option value="agent">Agent</option>
            <option value="manager">Manager</option>
          </select>
          <div>
            <label className="text-[11px] text-muted-foreground">Date d'embauche</label>
            <Input
              type="date"
              className="h-9"
              value={a.hire_date ?? ""}
              onChange={(e) => void save(a.id, { hire_date: e.target.value || null })}
            />
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" onClick={() => void remove(a)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </Card>
      ))}
      {agents.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Aucun agent. Ajoutez-les ci-dessus ou enrôlez-les dans le module Pointage.
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Soldes */

function BalancesView({
  agents,
  schedules,
  entries,
  holidays,
  onChanged,
}: {
  agents: HrAgent[];
  schedules: HrSchedule[];
  entries: HrBalanceEntry[];
  holidays: HrHoliday[];
  onChanged: () => Promise<void> | void;
}) {
  const holidayDates = useMemo(() => holidays.map((h) => h.holiday_date), [holidays]);
  const [agentId, setAgentId] = useState("");
  const [kind, setKind] = useState("recup_credit");
  const [days, setDays] = useState("1");
  const [date, setDate] = useState(isoDate(new Date()));
  const [reason, setReason] = useState("");

  const add = async () => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) {
      toast.error("Choisissez un agent");
      return;
    }
    try {
      await addBalanceEntry({
        pdv_id: agent.pdv_id,
        agent_id: agent.id,
        kind: kind as any,
        days: Number(days) || 0,
        entry_date: date,
        reason: reason || null,
      });
      setReason("");
      toast.success("Mouvement enregistré");
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Enregistrement impossible");
    }
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <p className="text-sm font-semibold">Ajouter un mouvement de solde</p>
        <div className="grid gap-2 sm:grid-cols-5">
          <select className="h-9 rounded border bg-background px-2 text-sm" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">Agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
          <select className="h-9 rounded border bg-background px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="recup_credit">Récupération acquise (+)</option>
            <option value="recup_debit">Récupération prise (−)</option>
            <option value="conge_credit">Congé supplémentaire (+)</option>
            <option value="conge_debit">Congé pris hors planning (−)</option>
          </select>
          <Input type="number" step="0.5" value={days} onChange={(e) => setDays(e.target.value)} className="h-9" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
          <Input placeholder="Motif" value={reason} onChange={(e) => setReason(e.target.value)} className="h-9" />
        </div>
        <Button size="sm" onClick={() => void add()}>
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </Card>

      <div className="space-y-2">
        {agents.map((a) => {
          const b = computeBalance({
            hireDate: a.hire_date,
            schedules: schedules.filter((s) => s.agent_id === a.id),
            entries: entries.filter((e) => e.agent_id === a.id),
            holidays: holidayDates,
          });
          return (
            <Card key={a.id} className="p-3 space-y-1.5">
              <div>
                <p className="font-medium">{a.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  Embauche : {a.hire_date ? formatFr(a.hire_date) : "non renseignée"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold w-24">Congés</span>
                <Badge variant="secondary">Acquis {b.accrued}</Badge>
                <Badge variant="secondary">Pris {b.leaveTaken}</Badge>
                <Badge>Restants {b.leaveRemaining}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold w-24">Récupération</span>
                <Badge variant="outline">Acquise {b.recupCredit}</Badge>
                <Badge variant="outline">Prise {b.recupTaken}</Badge>
                <Badge variant="outline">Restante {b.recupRemaining}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs border-t pt-1.5">
                <span className="font-semibold w-24">Total</span>
                <Badge>Total restant {Number((b.leaveRemaining + b.recupRemaining).toFixed(2))} j</Badge>
              </div>
            </Card>
          );
        })}
      </div>

      {entries.length > 0 && (
        <Card className="p-3 space-y-1">
          <p className="text-sm font-semibold mb-1">Historique des mouvements</p>
          {entries.slice(0, 40).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 text-xs border-b py-1">
              <span>
                {formatFr(e.entry_date)} — {agents.find((a) => a.id === e.agent_id)?.full_name ?? "?"} — {e.kind} — {e.days} j
                {e.reason ? ` — ${e.reason}` : ""}
              </span>
              <button
                className="text-destructive"
                onClick={async () => {
                  await deleteBalanceEntry(e.id);
                  await onChanged();
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Jours fériés */

function HolidaysView({
  holidays,
  canEdit,
  onChanged,
}: {
  holidays: HrHoliday[];
  canEdit: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [date, setDate] = useState(isoDate(new Date()));
  const [label, setLabel] = useState("");

  const importFixed = async () => {
    const year = new Date().getFullYear();
    try {
      for (const h of fixedMoroccanHolidays(year)) await addHoliday(h.holiday_date, h.label);
      toast.success("Jours fériés nationaux importés");
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Import impossible");
    }
  };

  return (
    <div className="space-y-3">
      {canEdit && (
        <Card className="p-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
            <Input placeholder="Libellé (ex : Aïd Al Fitr)" value={label} onChange={(e) => setLabel(e.target.value)} className="h-9" />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  if (!label.trim()) return toast.error("Indiquez un libellé");
                  await addHoliday(date, label.trim());
                  setLabel("");
                  await onChanged();
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> Ajouter
              </Button>
              <Button size="sm" variant="outline" onClick={() => void importFixed()}>
                Importer fériés {new Date().getFullYear()}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Les fêtes religieuses (Aïd, Nouvel An hégirien, Aïd Al Mawlid) changent chaque année : ajoutez-les à la main.
          </p>
        </Card>
      )}
      <Card className="p-3 space-y-1">
        {holidays.map((h) => (
          <div key={h.id} className="flex items-center justify-between gap-2 border-b py-1 text-sm">
            <span>
              {formatFr(h.holiday_date)} — {h.label}
            </span>
            {canEdit && (
              <button
                className="text-destructive"
                onClick={async () => {
                  await deleteHoliday(h.id);
                  await onChanged();
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {holidays.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun jour férié enregistré.</p>}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Rapports */

function ReportsView({
  agents,
  holidays,
  scopePdvIds,
  isRh,
}: {
  agents: HrAgent[];
  holidays: HrHoliday[];
  scopePdvIds: string[];
  isRh: boolean;
}) {
  const { pdvs } = useAuth();
  const today = isoDate(new Date());
  const [from, setFrom] = useState(weekStart(today));
  const [to, setTo] = useState(today);
  const [agentId, setAgentId] = useState("");
  const [pdvFilter, setPdvFilter] = useState("");
  const [rows, setRows] = useState<ReturnType<typeof computeDay>[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const ids = pdvFilter ? [pdvFilter] : scopePdvIds;
    if (ids.length === 0) return;
    setLoading(true);
    try {
      const [punches, schedules] = await Promise.all([
        getPunchesRange(ids, from, to),
        getSchedules(ids, from, to),
      ]);
      const holidayMap = new Map(holidays.map((h) => [h.holiday_date, h.label]));
      const targetAgents = agents.filter(
        (a) => ids.includes(a.pdv_id) && (!agentId || a.id === agentId),
      );
      const out: ReturnType<typeof computeDay>[] = [];
      const dates: string[] = [];
      for (let d = from; d <= to; ) {
        dates.push(d);
        const nd = new Date(`${d}T12:00:00`);
        nd.setDate(nd.getDate() + 1);
        d = isoDate(nd);
      }
      targetAgents.forEach((a) => {
        dates.forEach((date) => {
          const dayPunches = (punches as AttendancePunch[]).filter(
            (p) => p.agent_id === a.id && p.punch_date === date,
          );
          const sch = schedules.find((s) => s.agent_id === a.id && s.work_date === date) ?? null;
          if (!sch && dayPunches.length === 0) return;
          out.push(
            computeDay({
              date,
              agentId: a.id,
              agentName: a.full_name,
              pdvId: a.pdv_id,
              punches: dayPunches,
              schedule: sch,
              holidayLabel: holidayMap.get(date) ?? null,
            }),
          );
        });
      });
      out.sort((x, y) => x.date.localeCompare(y.date) || x.agentName.localeCompare(y.agentName));
      setRows(out);
    } catch (e: any) {
      toast.error(e?.message ?? "Rapport impossible");
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        worked: acc.worked + r.workedHours,
        overtime: acc.overtime + r.overtimeHours,
        late: acc.late + r.lateMinutes,
        absences: acc.absences + (r.absence ? 1 : 0),
        conges: acc.conges + (r.dayType === "conge" ? 1 : 0),
        recups: acc.recups + (r.dayType === "recuperation" ? 1 : 0),
      }),
      { worked: 0, overtime: 0, late: 0, absences: 0, conges: 0, recups: 0 },
    );
  }, [rows]);

  const exportCsv = () => {
    const data = rows.map((r) => ({
      Date: formatFr(r.date),
      PDV: pdvs.find((p) => p.id === r.pdvId)?.name ?? "",
      Agent: r.agentName,
      Journée: r.dayType ? DAY_TYPE_LABELS[r.dayType] : "—",
      Férié: r.holidayLabel ?? "",
      "Entrée prévue": r.plannedStart ?? "",
      Entrée: r.entree ?? "",
      "Début pause": r.pauseStart ?? "",
      "Fin pause": r.pauseEnd ?? "",
      Sortie: r.sortie ?? "",
      "Heures travaillées": r.workedHours,
      "Heures sup.": r.overtimeHours,
      "Retard (min)": r.lateMinutes,
      Présence: r.present ? "Présent" : r.absence ? "Absence à justifier" : "—",
    }));
    downloadCsv(`rapport-rh-${from}_${to}.csv`, toCsv(data));
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 grid gap-2 sm:grid-cols-5">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
        <select className="h-9 rounded border bg-background px-2 text-sm" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">Tous les agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
            </option>
          ))}
        </select>
        {isRh ? (
          <select className="h-9 rounded border bg-background px-2 text-sm" value={pdvFilter} onChange={(e) => setPdvFilter(e.target.value)}>
            <option value="">Tous les PDV</option>
            {pdvs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void run()} disabled={loading}>
            {loading ? "…" : "Afficher"}
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
        </div>
      </Card>

      {rows.length > 0 && (
        <Card className="p-3 flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">Heures {totals.worked.toFixed(2)}</Badge>
          <Badge variant="secondary">Heures sup. {totals.overtime.toFixed(2)}</Badge>
          <Badge variant="secondary">Retard {totals.late} min</Badge>
          <Badge variant="destructive">Absences {totals.absences}</Badge>
          <Badge variant="outline">Congés {totals.conges}</Badge>
          <Badge variant="outline">Récup {totals.recups}</Badge>
        </Card>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded">
          <thead className="bg-muted">
            <tr>
              {["Date", "Agent", "Journée", "Prévu", "Entrée", "Pause", "Sortie", "Heures", "H. sup.", "Retard", "Statut"].map((h) => (
                <th key={h} className="p-2 text-left whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.agentId}-${r.date}`} className="border-t">
                <td className="p-2 whitespace-nowrap">{formatFr(r.date)}</td>
                <td className="p-2 whitespace-nowrap">{r.agentName}</td>
                <td className="p-2 whitespace-nowrap">
                  {r.dayType ? DAY_TYPE_LABELS[r.dayType] : "—"}
                  {r.isHoliday && <Badge className="ml-1 text-[9px]">Férié</Badge>}
                </td>
                <td className="p-2 whitespace-nowrap">{r.plannedStart ?? "—"}</td>
                <td className="p-2 whitespace-nowrap">{r.entree ?? "—"}</td>
                <td className="p-2 whitespace-nowrap">
                  {r.pauseStart ?? "—"} / {r.pauseEnd ?? "—"}
                </td>
                <td className="p-2 whitespace-nowrap">{r.sortie ?? "—"}</td>
                <td className="p-2 whitespace-nowrap">{r.workedHours.toFixed(2)}</td>
                <td className="p-2 whitespace-nowrap">{r.overtimeHours > 0 ? r.overtimeHours.toFixed(2) : "—"}</td>
                <td className={`p-2 whitespace-nowrap ${r.lateMinutes > 0 ? "text-destructive font-semibold" : ""}`}>
                  {r.lateMinutes > 0 ? `${r.lateMinutes} min` : "—"}
                </td>
                <td className="p-2 whitespace-nowrap">
                  {r.absence ? (
                    <span className="text-destructive font-semibold">Absence à justifier</span>
                  ) : r.present ? (
                    "Présent"
                  ) : (
                    DAY_TYPE_LABELS[(r.dayType ?? "repos") as DayType]
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Choisissez une période puis cliquez sur « Afficher ».
          </p>
        )}
      </div>
    </div>
  );
}
