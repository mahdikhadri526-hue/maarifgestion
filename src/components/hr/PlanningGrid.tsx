import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DAY_TYPES,
  DAY_TYPE_LABELS,
  DOW_LABELS,
  formatFr,
  getSchedules,
  isoDate,
  saveSchedule,
  weekDays,
  weekStart,
  type DayType,
  type HrAgent,
  type HrHoliday,
  type HrSchedule,
} from "@/lib/hrData";

export function addWeek(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n * 7);
  return isoDate(d);
}

/** Grille hebdomadaire d'élaboration du planning (partagée RH / Planning). */
export function PlanningGrid({
  agents,
  holidays,
  isRh,
  onChanged,
  showLevelToggle = true,
  readOnly = false,
}: {
  agents: HrAgent[];
  holidays: HrHoliday[];
  isRh: boolean;
  onChanged: () => Promise<void> | void;
  /** false = masquer le sélecteur Managers/Agents (grille agents uniquement). */
  showLevelToggle?: boolean;
  /** true = consultation uniquement (aucune modification possible). */
  readOnly?: boolean;
}) {
  const { pdvs } = useAuth();
  const [start, setStart] = useState(() => weekStart(isoDate(new Date())));
  const [level, setLevel] = useState<"agent" | "manager">(showLevelToggle && isRh ? "manager" : "agent");
  const [rows, setRows] = useState<HrSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  const days = useMemo(() => weekDays(start), [start]);
  const isCaissier = (a: HrAgent) => (a.poste ?? "").trim().toLowerCase() === "caissier";
  /** Les caissiers sont planifiés par la RH : affichés en bas, verrouillés pour les managers. */
  const list = useMemo(() => {
    const base = agents.filter((a) => a.active && (a.staff_level ?? "agent") === level);
    return [...base.filter((a) => !isCaissier(a)), ...base.filter(isCaissier)];
  }, [agents, level]);
  const firstCaissierId = useMemo(() => list.find(isCaissier)?.id ?? null, [list]);
  const rowReadOnly = (a: HrAgent) => (isCaissier(a) ? !isRh : readOnly);
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
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            Planning hebdomadaire
            {readOnly && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Lecture seule
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Semaine du {formatFr(days[0])} au {formatFr(days[6])}
            {readOnly && " — consultation uniquement"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showLevelToggle && (
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
          )}
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
          Aucun {level === "manager" ? "manager" : "agent"} enregistré pour ce périmètre.
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
                <>
                {a.id === firstCaissierId && (
                  <tr key={`sep-${a.id}`}>
                    <td
                      colSpan={days.length + 1}
                      className="sticky left-0 !bg-muted !px-4 !py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Caissiers — planning établi par la RH{!isRh && " (lecture seule)"}
                    </td>
                  </tr>
                )}
                <tr key={a.id} className="group">
                  <td className="sticky left-0 z-20 !bg-card !px-3 !py-2 border-r border-border group-hover:!bg-accent">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                        {initials(a.full_name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{a.full_name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {[a.poste, isRh ? (a.multi_pdv ? "Tous les PDV" : pdvs.find((p) => p.id === a.pdv_id)?.name) : (a.multi_pdv ? "Tous les PDV" : null)].filter(Boolean).join(" · ") || (level === "manager" ? "Manager" : "Agent")}
                        </span>
                      </span>
                    </div>
                  </td>
                  {days.map((d, i) => {
                    const c = cell(a.id, d);
                    const type = c?.day_type as DayType | undefined;
                    return (
                      <td key={d} className={`!p-1 border-r border-border/60 ${i > 4 ? "bg-muted/40" : ""}`}>
                        {readOnly ? (
                          <div className={`min-h-[58px] rounded-md border px-1.5 py-1.5 text-center ${cellTone(type)}`}>
                            <span className="block text-[10px] font-semibold">
                              {type ? DAY_TYPE_LABELS[type] : "—"}
                            </span>
                            {type === "travail" && (
                              <span className="mt-1 block border-t border-current/15 pt-1 text-[9px] opacity-80">
                                {c?.start_time || "--:--"} – {c?.end_time || "--:--"}
                              </span>
                            )}
                          </div>
                        ) : (
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
                        )}
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
