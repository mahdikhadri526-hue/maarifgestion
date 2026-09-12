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

type View = "planning" | "agents" | "soldes" | "feries" | "rapports";

export function HrModule() {
  const { pdvId, pdvs, can, isAdmin } = useAuth();
  const isRh = isAdmin || can("manage_hr");
  const scopePdvIds = useMemo(
    () => (isRh ? pdvs.map((p) => p.id) : pdvId ? [pdvId] : []),
    [isRh, pdvs, pdvId],
  );

  const [view, setView] = useState<View>("planning");
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
    { id: "soldes", label: "Congés & Récup", icon: Sun },
    { id: "feries", label: "Jours fériés", icon: CalendarDays },
    { id: "rapports", label: "Rapports", icon: BarChart3 },
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
      {view === "soldes" && (
        <BalancesView agents={agents} schedules={allSchedules} entries={balances} onChanged={reload} />
      )}
      {view === "feries" && <HolidaysView holidays={holidays} canEdit={isRh} onChanged={reload} />}
      {view === "rapports" && (
        <ReportsView agents={agents} holidays={holidays} scopePdvIds={scopePdvIds} isRh={isRh} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Planning */

function PlanningView({
  agents,
  holidays,
  isRh,
  onChanged,
}: {
  agents: HrAgent[];
  holidays: HrHoliday[];
  isRh: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const { pdvs } = useAuth();
  const [start, setStart] = useState(() => weekStart(isoDate(new Date())));
  const [level, setLevel] = useState<"agent" | "manager">(isRh ? "manager" : "agent");
  const [rows, setRows] = useState<HrSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  const days = useMemo(() => weekDays(start), [start]);
  const list = useMemo(
    () => agents.filter((a) => a.active && (a.staff_level ?? "agent") === level),
    [agents, level],
  );
  const holidayMap = useMemo(
    () => new Map(holidays.map((h) => [h.holiday_date, h.label])),
    [holidays],
  );

  const load = useCallback(async () => {
    const ids = Array.from(new Set(agents.map((a) => a.pdv_id)));
    if (ids.length === 0) return;
    setLoading(true);
    try {
      setRows(await getSchedules(ids, days[0], days[6]));
    } catch (e: any) {
      toast.error(e?.message ?? "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [agents, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const cell = (agentId: string, date: string) =>
    rows.find((r) => r.agent_id === agentId && r.work_date === date) ?? null;

  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

  const cellTone = (type: DayType | undefined) => {
    if (type === "travail") return "border-success/30 bg-success/10 text-success";
    if (type === "repos") return "border-border bg-secondary text-secondary-foreground";
    if (type === "conge") return "border-warning/40 bg-warning/15 text-warning-foreground";
    if (type === "recuperation") return "border-primary/25 bg-accent text-accent-foreground";
    return "border-dashed border-border bg-card text-muted-foreground";
  };

  const update = async (
    agent: HrAgent,
    date: string,
    patch: { day_type?: DayType; start_time?: string; end_time?: string },
  ) => {
    const cur = cell(agent.id, date);
    const next = {
      pdv_id: agent.pdv_id,
      agent_id: agent.id,
      work_date: date,
      day_type: patch.day_type ?? (cur?.day_type as DayType) ?? "travail",
      start_time: patch.start_time ?? cur?.start_time ?? "",
      end_time: patch.end_time ?? cur?.end_time ?? "",
    };
    setRows((prev) => {
      const others = prev.filter((r) => !(r.agent_id === agent.id && r.work_date === date));
      return [...others, { id: cur?.id ?? `tmp-${agent.id}-${date}`, notes: null, ...next } as HrSchedule];
    });
    try {
      await saveSchedule(next);
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Enregistrement impossible");
      void load();
    }
  };

  return (
    <Card className="overflow-hidden border-border shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Planning hebdomadaire</h2>
          <p className="text-sm text-muted-foreground">
            Semaine du {formatFr(days[0])} au {formatFr(days[6])}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border bg-muted p-0.5">
            {isRh && (
              <Button
                size="sm"
                variant={level === "manager" ? "default" : "ghost"}
                className="h-8"
                onClick={() => setLevel("manager")}
              >
                Managers
              </Button>
            )}
            <Button
              size="sm"
              variant={level === "agent" ? "default" : "ghost"}
              className="h-8"
              onClick={() => setLevel("agent")}
            >
              Agents
            </Button>
          </div>
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9"
            aria-label="Semaine précédente"
            title="Semaine précédente"
            onClick={() => setStart(addWeek(start, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setStart(weekStart(isoDate(new Date())))}>
            Aujourd'hui
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9"
            aria-label="Semaine suivante"
            title="Semaine suivante"
            onClick={() => setStart(addWeek(start, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading && <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">Chargement…</div>}

      {list.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Aucun {level === "manager" ? "manager" : "agent"} enregistré. Renseignez le poste et le niveau dans l'onglet « Agents ».
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] table-fixed !rounded-none !overflow-visible text-xs">
            <colgroup>
              <col className="w-[220px]" />
              {days.map((d) => <col key={d} className="w-[123px]" />)}
            </colgroup>
            <thead>
              <tr>
                <th className="sticky left-0 z-30 !bg-accent !px-4 !py-3 text-left text-[11px] font-semibold uppercase border-r border-border">
                  Collaborateur
                </th>
                {days.map((d, i) => {
                  const hol = holidayMap.get(d);
                  return (
                    <th key={d} className={`!px-2 !py-2 text-center ${i > 4 ? "!bg-muted" : "!bg-accent"}`}>
                      <span className="block text-[11px] font-semibold normal-case">{DOW_LABELS[i]}</span>
                      <span className="block text-[10px] font-medium text-muted-foreground">{formatFr(d).slice(0, 5)}</span>
                      {hol && <span className="mt-1 block truncate text-[9px] font-medium normal-case text-warning-foreground">Férié</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="group">
                  <td className="sticky left-0 z-20 !bg-card !px-3 !py-2 border-r border-border group-hover:!bg-accent">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                        {initials(a.full_name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{a.full_name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {[a.poste, isRh ? pdvs.find((p) => p.id === a.pdv_id)?.name : null].filter(Boolean).join(" · ") || (level === "manager" ? "Manager" : "Agent")}
                        </span>
                      </span>
                    </div>
                  </td>
                  {days.map((d, i) => {
                    const c = cell(a.id, d);
                    const type = c?.day_type as DayType | undefined;
                    return (
                      <td key={d} className={`!p-1 border-r border-border/60 ${i > 4 ? "bg-muted/40" : ""}`}>
                        <div className={`min-h-[58px] rounded-md border px-1.5 py-1 ${cellTone(type)}`}>
                          <select
                            aria-label={`${a.full_name}, ${DOW_LABELS[i]} ${formatFr(d)}`}
                            className="h-6 w-full cursor-pointer bg-transparent text-center text-[10px] font-semibold outline-none"
                            value={type ?? ""}
                            onChange={(e) => void update(a, d, { day_type: e.target.value as DayType })}
                          >
                            <option value="">+ Planifier</option>
                            {DAY_TYPES.map((t) => (
                              <option key={t} value={t}>{DAY_TYPE_LABELS[t]}</option>
                            ))}
                          </select>
                          {type === "travail" && (
                            <div className="mt-0.5 flex items-center gap-0.5 border-t border-current/15 pt-0.5">
                              <Input
                                type="time"
                                aria-label={`Entrée prévue de ${a.full_name} le ${formatFr(d)}`}
                                className="h-6 min-w-0 border-0 bg-transparent px-0 text-center text-[9px] shadow-none focus-visible:ring-1"
                                value={c?.start_time ?? ""}
                                onChange={(e) => void update(a, d, { start_time: e.target.value })}
                              />
                              <span className="text-[9px] opacity-60">–</span>
                              <Input
                                type="time"
                                aria-label={`Sortie prévue de ${a.full_name} le ${formatFr(d)}`}
                                className="h-6 min-w-0 border-0 bg-transparent px-0 text-center text-[9px] shadow-none focus-visible:ring-1"
                                value={c?.end_time ?? ""}
                                onChange={(e) => void update(a, d, { end_time: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border bg-muted/60 px-4 py-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" />Travail</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-secondary-foreground/40" />Repos</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" />Congé</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Récupération</span>
      </div>
    </Card>
  );
}

function addWeek(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n * 7);
  return isoDate(d);
}

/* ------------------------------------------------------------------ Agents RH */

function AgentsHrView({ agents, onChanged }: { agents: HrAgent[]; onChanged: () => Promise<void> | void }) {
  const { pdvs } = useAuth();
  const save = async (id: string, patch: any) => {
    try {
      await updateAgentHr(id, patch);
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Enregistrement impossible");
    }
  };
  return (
    <div className="space-y-2">
      {agents.map((a) => (
        <Card key={a.id} className="p-3 grid gap-2 sm:grid-cols-4 items-center">
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
        </Card>
      ))}
      {agents.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Aucun agent. Enrôlez-les d'abord dans le module Pointage.
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
  onChanged,
}: {
  agents: HrAgent[];
  schedules: HrSchedule[];
  entries: HrBalanceEntry[];
  onChanged: () => Promise<void> | void;
}) {
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
          });
          return (
            <Card key={a.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{a.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Embauche : {a.hire_date ? formatFr(a.hire_date) : "non renseignée"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">Congés acquis {b.accrued}</Badge>
                  <Badge variant="secondary">Pris {b.leaveTaken}</Badge>
                  <Badge>Restants {b.leaveRemaining}</Badge>
                  <Badge variant="outline">Récup restante {b.recupRemaining}</Badge>
                </div>
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
