import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, ListChecks, Plus, Settings2, Trash2, BarChart3, History, Wrench } from "lucide-react";
import { ReportIssueDialog } from "@/components/tech/ReportIssueDialog";
import { PepRepairStatus } from "@/components/tech/PepRepairStatus";
import { TECH_ENABLED } from "@/lib/techFeature";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  PEP_FREQUENCIES,
  FREQ_LABEL,
  STATUS_META,
  addDays,
  completeOccurrence,
  datesBetween,
  deleteHoliday,
  deleteTask,
  effectiveStatus,
  ensurePlanning,
  fileToCompressedDataUrl,
  fmtFR,
  getOccurrences,
  getPepHolidays,
  getPepTasks,
  getPostponements,
  isWeekend,
  mondayOf,
  nextWorkday,
  postponeOccurrence,
  saveHoliday,
  saveTask,
  setOccurrenceStatus,
  removeOccurrencePhoto,
  parsePhotos,
  setOccurrencePhotos,
  setOccurrenceComment,

  todayISO,
  toISO,
  parseISO,
  type PepFrequency,
  type PepHoliday,
  type PepOccurrence,
  type PepPostponement,
  type PepTask,
} from "@/lib/pepData";

type View = "day" | "week" | "month";

interface Row {
  occ: PepOccurrence;
  task: PepTask | undefined;
  status: ReturnType<typeof effectiveStatus>;
}

export function PepModule({ initialView = "day" }: { initialView?: View }) {
  const { can, pdv, user } = useAuth();
  const canManage = can("manage_pep");

  const [tasks, setTasks] = useState<PepTask[]>([]);
  const [holidays, setHolidays] = useState<PepHoliday[]>([]);
  const [occurrences, setOccurrences] = useState<PepOccurrence[]>([]);
  const [posts, setPosts] = useState<PepPostponement[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [techRefresh, setTechRefresh] = useState(0);

  const today = todayISO();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Une erreur de génération ne doit pas empêcher la lecture des tâches
      // déjà enregistrées et donc bloquer tout l'Agenda PEP.
      try {
        await ensurePlanning();
      } catch (planningError) {
        console.warn("Planification PEP temporairement indisponible", planningError);
      }
      const [t, h, o, p] = await Promise.all([
        getPepTasks(),
        getPepHolidays(),
        getOccurrences(addDays(today, -400), addDays(today, 120)),
        getPostponements(),
      ]);
      setTasks(t);
      setHolidays(h);
      setOccurrences(o);
      setPosts(p);
    } catch (e: any) {
      toast({ title: "Erreur PEP", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const rows: Row[] = useMemo(
    () =>
      occurrences.map((occ) => ({ occ, task: taskById.get(occ.task_id), status: effectiveStatus(occ, today) })),
    [occurrences, taskById, today],
  );

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.holiday_date)), [holidays]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Agenda PEP</h2>
        </div>
        {pdv && <span className="text-xs text-muted-foreground">PDV : {pdv.name}</span>}
        <div className="ml-auto flex gap-2">
          {TECH_ENABLED && (
            <Button size="sm" variant="outline" onClick={() => setReportOpen(true)}>
              <Wrench className="h-4 w-4 mr-1" />Signaler un problème matériel
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? "Chargement…" : "Actualiser"}
          </Button>
        </div>
      </div>
      {TECH_ENABLED && (
        <>
          <ReportIssueDialog open={reportOpen} onClose={() => setReportOpen(false)} onReported={() => setTechRefresh((k) => k + 1)} />
          <PepRepairStatus refreshKey={techRefresh} />
        </>
      )}

      <Tabs defaultValue="agenda">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="agenda"><ListChecks className="h-4 w-4 mr-1" />Agenda</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />Historique</TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-1" />Statistiques</TabsTrigger>
          {canManage && <TabsTrigger value="tasks"><Settings2 className="h-4 w-4 mr-1" />Tâches</TabsTrigger>}
          {canManage && <TabsTrigger value="holidays">Jours fériés</TabsTrigger>}
        </TabsList>

        <TabsContent value="agenda" className="mt-4">
          <AgendaView
            rows={rows}
            holidays={holidaySet}
            initialView={initialView}
            userName={user?.email ?? null}
            onChanged={load}
            posts={posts}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryView rows={rows} posts={posts} tasks={tasks} />
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <StatsView rows={rows} />
        </TabsContent>

        {canManage && (
          <TabsContent value="tasks" className="mt-4">
            <TasksAdmin tasks={tasks} onChanged={load} />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="holidays" className="mt-4">
            <HolidaysAdmin holidays={holidays} onChanged={load} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ------------------------------- AGENDA --------------------------------------

function AgendaView({
  rows,
  holidays,
  initialView,
  userName,
  onChanged,
  posts,
}: {
  rows: Row[];
  holidays: Set<string>;
  initialView: View;
  userName: string | null;
  onChanged: () => Promise<void> | void;
  posts: PepPostponement[];
}) {
  const [view, setView] = useState<View>(initialView);
  const [anchor, setAnchor] = useState(todayISO());
  const today = todayISO();

  const [range, label] = useMemo<[string[], string]>(() => {
    if (view === "day") return [[anchor], fmtFR(anchor)];
    if (view === "week") {
      const start = mondayOf(anchor);
      const end = addDays(start, 6);
      return [datesBetween(start, end), `Semaine du ${fmtFR(start)} au ${fmtFR(end)}`];
    }
    const d = parseISO(anchor);
    const start = `${anchor.slice(0, 7)}-01`;
    const end = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    return [datesBetween(start, end), `${fmtFR(start)} → ${fmtFR(end)}`];
  }, [view, anchor]);

  const step = view === "day" ? 1 : view === "week" ? 7 : 30;
  const inRange = new Set(range);

  // Les tâches en retard ne sont JAMAIS reportées : elles restent visibles
  // uniquement sur leur jour d'échéance.
  const visible = rows.filter((r) => inRange.has(r.occ.due_date));

  const [completing, setCompleting] = useState<Row | null>(null);
  const [postponing, setPostponing] = useState<Row | null>(null);

  // Compteurs de synthèse sur la plage affichée.
  const counts = useMemo(() => {
    const c = { total: visible.length, todo: 0, done: 0, late: 0 };
    visible.forEach((r) => {
      if (r.status === "done") c.done++;
      else if (r.status === "late") c.late++;
      else c.todo++;
    });
    return c;
  }, [visible]);

  const [freqFilter, setFreqFilter] = useState<string>("all");
  const [hideDone, setHideDone] = useState(false);

  const applyFilters = useCallback(
    (list: Row[]) =>
      list.filter(
        (r) =>
          (freqFilter === "all" || r.task?.frequency === freqFilter) &&
          (!hideDone || r.status !== "done"),
      ),
    [freqFilter, hideDone],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border overflow-hidden">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium ${view === v ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >
              {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setAnchor(addDays(anchor, -step))}>◀</Button>
        <span className="text-sm font-medium">{label}</span>
        <Button size="sm" variant="outline" onClick={() => setAnchor(addDays(anchor, step))}>▶</Button>
        <Button size="sm" variant="ghost" onClick={() => setAnchor(today)}>Aujourd'hui</Button>
      </div>

      {/* Synthèse de la période */}
      <div className="grid grid-cols-4 gap-2">
        <Kpi label="Total" value={counts.total} className="bg-muted/40" />
        <Kpi label="À faire" value={counts.todo} className="bg-orange-50 border-orange-200 text-orange-700" />
        <Kpi label="En retard" value={counts.late} className="bg-red-50 border-red-200 text-red-700" />
        <Kpi label="Réalisées" value={counts.done} className="bg-green-50 border-green-200 text-green-700" />
      </div>

      {/* Filtres de lecture */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          <FreqChip active={freqFilter === "all"} onClick={() => setFreqFilter("all")}>Toutes</FreqChip>
          {PEP_FREQUENCIES.filter((f) => rows.some((r) => r.task?.frequency === f.key)).map((f) => (
            <FreqChip key={f.key} active={freqFilter === f.key} onClick={() => setFreqFilter(f.key)}>
              {f.label}
            </FreqChip>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setHideDone((v) => !v)}
          className={`ml-auto text-[11px] px-2 py-1 rounded-full border ${hideDone ? "bg-primary text-primary-foreground" : "bg-background"}`}
        >
          Masquer les réalisées
        </button>
      </div>


      {range.map((d) => {
        const dayRows = applyFilters(visible.filter((r) => r.occ.due_date === d));
        if (view !== "day" && dayRows.length === 0) return null;
        const groups = groupByFrequency(dayRows);
        const doneCount = dayRows.filter((r) => r.status === "done").length;
        return (
          <div key={d} className="rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-2 bg-muted/50 border-b">
              <h3 className="text-sm font-semibold">
                {dayLabelFR(d)}
                {d === today && <span className="ml-2 text-xs text-primary">(aujourd'hui)</span>}
                {isWeekend(d) && <span className="ml-2 text-xs text-muted-foreground">week-end</span>}
                {holidays.has(d) && <span className="ml-2 text-xs text-purple-600">jour férié</span>}
              </h3>
              <span className="text-xs text-muted-foreground">
                {doneCount}/{dayRows.length} réalisée(s)
              </span>
            </div>
            {dayRows.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">Aucune tâche PEP planifiée.</p>
            ) : (
              <div className="divide-y">
                {groups.map(([freq, list]) => (
                  <div key={freq} className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {FREQ_LABEL[freq] ?? "Autre"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">({list.length})</span>
                      <span className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-2">
                      {list.map((r) => (
                        <TaskCard key={r.occ.id} row={r} onComplete={() => setCompleting(r)} onPostpone={() => setPostponing(r)} onChanged={onChanged} posts={posts} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}


      {completing && (
        <CompleteDialog row={completing} userName={userName} onClose={() => setCompleting(null)} onDone={onChanged} />
      )}
      {postponing && (
        <PostponeDialog row={postponing} holidays={holidays} userName={userName} onClose={() => setPostponing(null)} onDone={onChanged} />
      )}
    </div>
  );
}

function Kpi({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div className={`rounded-lg border p-2 text-center ${className}`}>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function FreqChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] px-2 py-1 rounded-full border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
    >
      {children}
    </button>
  );
}

const FREQ_ORDER = PEP_FREQUENCIES.map((f) => f.key as string);

/** Regroupe les tâches d'une journée par fréquence (quotidien d'abord). */
function groupByFrequency(list: Row[]): [string, Row[]][] {
  const map = new Map<string, Row[]>();
  for (const r of list) {
    const key = r.task?.frequency ?? "autre";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return [...map.entries()].sort(
    (a, b) => (FREQ_ORDER.indexOf(a[0]) + 1 || 99) - (FREQ_ORDER.indexOf(b[0]) + 1 || 99),
  );
}

const WEEKDAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/** « Lundi 26.08.2026 » */
function dayLabelFR(iso: string) {
  return `${WEEKDAYS_FR[parseISO(iso).getDay()]} ${fmtFR(iso)}`;
}



function TaskCard({
  row,
  onComplete,
  onPostpone,
  onChanged,
  posts,
}: {
  row: Row;
  onComplete: () => void;
  onPostpone: () => void;
  onChanged: () => Promise<void> | void;
  posts: PepPostponement[];
}) {
  const { occ, task, status } = row;
  const meta = STATUS_META[status];
  const history = posts.filter((p) => p.occurrence_id === occ.id);
  const done = status === "done";
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [reportIssue, setReportIssue] = useState(false);
  const hasBeforeAfter = !!task?.requires_photo_before_after;



  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-start gap-2 flex-wrap">
        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{task?.name ?? "Tâche supprimée"}</p>
          <p className="text-xs text-muted-foreground">
            {task?.equipment ? `${task.equipment} · ` : ""}
            {FREQ_LABEL[task?.frequency ?? ""] ?? "—"} · Prévue le {fmtFR(occ.due_date)}
            {task?.responsable ? ` · ${task.responsable}` : ""}
          </p>
          {occ.comment && <p className="text-xs mt-1">💬 {occ.comment}</p>}
          {([
            { kind: "before" as const, label: "AVANT", value: occ.photo_before_url },
            { kind: "after" as const, label: hasBeforeAfter ? "APRÈS" : "Photo", value: occ.photo_url },
          ]).map(({ kind, label, value }) =>
            parsePhotos(value).length > 0 ? (
              <div key={kind} className="mt-1">
                <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                <div className="flex flex-wrap gap-3">
                  {parsePhotos(value).map((url, i) => (
                    <div key={i} className="flex flex-col items-start">
                      <button type="button" onClick={() => setPhotoPreview(url)} className="block" title="Voir le justificatif">
                        <img src={url} alt={`${label} ${i + 1}`} className="h-16 w-16 rounded border object-cover" />
                        <span className="text-[11px] text-primary underline">{label} {i + 1}</span>
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-6 px-1 text-[11px]"
                        onClick={async () => {
                          if (!confirm("Supprimer cette photo ?")) return;
                          try {
                            const rest = parsePhotos(value).filter((_, idx) => idx !== i);
                            await setOccurrencePhotos(occ.id, rest, kind);
                            toast({ title: "Photo supprimée" });
                            await onChanged();
                          } catch (e: any) {
                            toast({ title: "Erreur", description: e?.message, variant: "destructive" });
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null,
          )}



          {history.map((h) => (
            <p key={h.id} className="text-[11px] text-purple-700 mt-1">
              Reportée du {fmtFR(h.from_date)} au {fmtFR(h.to_date)} — {h.reason || "sans motif"} ({h.postponed_by_name ?? "—"})
            </p>
          ))}
          {done && occ.completed_at && (
            <p className="text-[11px] text-green-700 mt-1">
              Réalisée le {fmtFR(occ.completed_at.slice(0, 10))} à {new Date(occ.completed_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              {occ.completed_by_name ? ` par ${occ.completed_by_name}` : ""}
            </p>
          )}
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${meta.badge}`}>{meta.label}</span>
      </div>

      {!done && occ.status !== "missed" && (
        <div className="flex gap-2 mt-2 flex-wrap">
          <Button size="sm" onClick={onComplete}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marquer comme réalisée
          </Button>
          <Button size="sm" variant="outline" onClick={onPostpone}>
            <Clock className="h-3.5 w-3.5 mr-1" /> Reporter
          </Button>
          {occ.status !== "in_progress" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await setOccurrenceStatus(occ.id, "in_progress");
                await onChanged();
              }}
            >
              En cours
            </Button>
          )}
        </div>
      )}

      {done && (
        <div className="flex gap-2 mt-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={onComplete}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Modifier la validation
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (!confirm("Repasser cette tâche en « À faire » ?")) return;
              try {
                await setOccurrenceStatus(occ.id, "todo");
                toast({ title: "Statut modifié", description: "La tâche est de nouveau à faire." });
                await onChanged();
              } catch (e: any) {
                toast({ title: "Erreur", description: e?.message, variant: "destructive" });
              }
            }}
          >
            <Clock className="h-3.5 w-3.5 mr-1" /> Rouvrir (à faire)
          </Button>
        </div>
      )}

      {TECH_ENABLED && (
        <>
          <div className="mt-2">
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setReportIssue(true)}>
              <Wrench className="h-3.5 w-3.5 mr-1" /> Signaler un problème matériel
            </Button>
          </div>
          <ReportIssueDialog
            open={reportIssue}
            onClose={() => setReportIssue(false)}
            defaults={{ equipment: task?.equipment ?? task?.name ?? "", source_task_id: task?.id ?? null, source_occurrence_id: occ.id }}
          />
        </>
      )}

      {photoPreview && (
        <Dialog open onOpenChange={(o) => !o && setPhotoPreview(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader><DialogTitle>Photo justificative</DialogTitle></DialogHeader>
            <img src={photoPreview} alt="Justificatif" className="w-full rounded border object-contain max-h-[70vh]" />
          </DialogContent>
        </Dialog>
      )}
    </div>

  );
}

function CompleteDialog({
  row,
  userName,
  onClose,
  onDone,
}: {
  row: Row;
  userName: string | null;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const [comment, setComment] = useState(row.occ.comment ?? "");
  const [photos, setPhotos] = useState<string[]>(parsePhotos(row.occ.photo_url));
  const [photosBefore, setPhotosBefore] = useState<string[]>(parsePhotos(row.occ.photo_before_url));
  const [busy, setBusy] = useState(false);
  const [savingBefore, setSavingBefore] = useState(false);
  const beforeAfter = !!row.task?.requires_photo_before_after && row.task?.frequency !== "daily";
  const missingBeforeAfter = beforeAfter && (!photosBefore.length || !photos.length);


  const photoField = (
    label: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    required: boolean,
  ) => (
    <div>
      <Label className="text-xs">
        {label} {required ? <span className="text-destructive">*</span> : "(facultatif)"}
      </Label>
      <Input
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          try {
            const added = await Promise.all(files.map((f) => fileToCompressedDataUrl(f)));
            setList((prev) => [...prev, ...added]);
          } catch (err: any) {
            toast({ title: "Photo non prise en compte", description: err?.message, variant: "destructive" });
          }
          e.target.value = "";
        }}
      />
      {list.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {list.map((p, i) => (
            <div key={i} className="flex flex-col items-start">
              <img src={p} alt={`${label} ${i + 1}`} className="h-24 w-24 rounded border object-cover" />
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive h-6 px-1 text-[11px]"
                onClick={() => setList((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Retirer
              </Button>
            </div>
          ))}
        </div>
      )}
      {required && !list.length && (
        <p className="text-[11px] text-destructive mt-1">Cette photo est obligatoire.</p>
      )}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90dvh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Marquer comme réalisée</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-4">

          <p className="text-sm">{row.task?.name}</p>
          <div>
            <Label className="text-xs">Commentaire</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          </div>
          {row.task?.frequency !== "daily" && (
            <div className="space-y-3">
              {beforeAfter && photoField("Photos AVANT intervention", photosBefore, setPhotosBefore, true)}
              {beforeAfter && (
                <div className="rounded-md border bg-muted/40 p-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={savingBefore || !photosBefore.length}
                    onClick={async () => {
                      setSavingBefore(true);
                      try {
                        await setOccurrencePhotos(row.occ.id, photosBefore, "before");
                        if (comment) await setOccurrenceComment(row.occ.id, comment);
                        if (row.occ.status !== "in_progress") await setOccurrenceStatus(row.occ.id, "in_progress");
                        toast({ title: "Photos AVANT enregistrées", description: "Vous pourrez revenir plus tard pour ajouter les photos APRÈS et valider." });
                        onClose();
                        await onDone();
                      } catch (e: any) {
                        toast({ title: "Erreur", description: e?.message, variant: "destructive" });
                      } finally {
                        setSavingBefore(false);
                      }
                    }}
                  >
                    Enregistrer les photos AVANT et continuer plus tard
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    La tâche passe « En cours ». Rouvrez « Marquer comme réalisée » pour ajouter les photos APRÈS et valider.
                  </p>
                </div>
              )}
              {photoField(
                beforeAfter ? "Photos APRÈS intervention" : "Photos / justificatifs",
                photos,
                setPhotos,
                beforeAfter || !!row.task?.requires_photo,
              )}
              <p className="text-[11px] text-muted-foreground">
                Vous pouvez ajouter plusieurs photos (reprenez le bouton après chaque prise).
              </p>
            </div>
          )}

        </div>
        <DialogFooter className="p-4 pt-3 mt-2 border-t flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>

          <Button
            disabled={
              busy ||
              missingBeforeAfter ||
              (row.task?.frequency !== "daily" && !!row.task?.requires_photo && !photos.length)
            }

            onClick={async () => {
              setBusy(true);
              try {
                await completeOccurrence(row.occ, {
                  comment,
                  photoUrls: photos,
                  photoBeforeUrls: beforeAfter ? photosBefore : undefined,
                  userName,
                });


                toast({ title: "Tâche réalisée" });
                onClose();
                await onDone();
              } catch (e: any) {
                toast({ title: "Erreur", description: e?.message, variant: "destructive" });
              } finally {
                setBusy(false);
              }
            }}
          >
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostponeDialog({
  row,
  holidays,
  userName,
  onClose,
  onDone,
}: {
  row: Row;
  holidays: Set<string>;
  userName: string | null;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const weekendAllowed = !!row.task?.weekend_allowed;
  const suggestions = useMemo(() => {
    const out: string[] = [];
    let cur = addDays(row.occ.due_date > todayISO() ? row.occ.due_date : todayISO(), 1);
    for (let i = 0; i < 60 && out.length < 6; i++) {
      const d = nextWorkday(cur, holidays, weekendAllowed);
      out.push(d);
      cur = addDays(d, 1);
    }
    return out;
  }, [row.occ.due_date, holidays, weekendAllowed]);

  const [date, setDate] = useState(suggestions[0] ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const invalid = !date || (!weekendAllowed && isWeekend(date)) || holidays.has(date);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reporter la tâche</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">{row.task?.name} — prévue le {fmtFR(row.occ.due_date)}</p>
          <div>
            <Label className="text-xs">Prochains jours ouvrables disponibles</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setDate(s)}
                  className={`px-2 py-1 rounded border text-xs ${date === s ? "bg-primary text-primary-foreground" : "bg-background"}`}
                >
                  {fmtFR(s)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Nouvelle date</Label>
            <Input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} />
            {invalid && date && (
              <p className="text-xs text-destructive mt-1">Week-end ou jour férié : choisissez un jour ouvrable.</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Motif du report</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={busy || invalid}
            onClick={async () => {
              setBusy(true);
              try {
                await postponeOccurrence(row.occ, date, reason, userName);
                toast({ title: "Tâche reportée", description: `Nouvelle date : ${fmtFR(date)}` });
                onClose();
                await onDone();
              } catch (e: any) {
                toast({ title: "Erreur", description: e?.message, variant: "destructive" });
              } finally {
                setBusy(false);
              }
            }}
          >
            Reporter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------ HISTORIQUE -----------------------------------

function HistoryView({ rows, posts, tasks }: { rows: Row[]; posts: PepPostponement[]; tasks: PepTask[] }) {
  const today = todayISO();
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [taskId, setTaskId] = useState("");
  const [freq, setFreq] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const filtered = rows.filter((r) => {
    if (r.occ.due_date < from || r.occ.due_date > to) return false;
    if (taskId && r.occ.task_id !== taskId) return false;
    if (freq && r.task?.frequency !== freq) return false;
    if (status && r.status !== status) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${r.task?.name ?? ""} ${r.task?.equipment ?? ""} ${r.task?.responsable ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div><Label className="text-xs">Du</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Au</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label className="text-xs">Tâche</Label>
          <select className="w-full h-10 rounded-md border bg-background px-2 text-sm" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">Toutes</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Fréquence</Label>
          <select className="w-full h-10 rounded-md border bg-background px-2 text-sm" value={freq} onChange={(e) => setFreq(e.target.value)}>
            <option value="">Toutes</option>
            {PEP_FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Statut</Label>
          <select className="w-full h-10 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div><Label className="text-xs">Recherche</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Matériel, responsable…" /></div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              {["Tâche", "Matériel", "Fréquence", "Date prévue", "Réalisée le", "Par", "Statut", "Reports", "Commentaire"].map((h) => (
                <th key={h} className="px-2 py-2 text-left whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">Aucune donnée sur la période.</td></tr>
            )}
            {filtered.map((r) => {
              const hist = posts.filter((p) => p.occurrence_id === r.occ.id);
              return (
                <tr key={r.occ.id} className="border-t align-top">
                  <td className="px-2 py-1.5">{r.task?.name ?? "—"}</td>
                  <td className="px-2 py-1.5">{r.task?.equipment ?? "—"}</td>
                  <td className="px-2 py-1.5">{FREQ_LABEL[r.task?.frequency ?? ""] ?? "—"}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{fmtFR(r.occ.due_date)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {r.occ.completed_at
                      ? `${fmtFR(r.occ.completed_at.slice(0, 10))} ${new Date(r.occ.completed_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                      : "—"}
                  </td>
                  <td className="px-2 py-1.5">{r.occ.completed_by_name ?? "—"}</td>
                  <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded ${STATUS_META[r.status].badge}`}>{STATUS_META[r.status].label}</span></td>
                  <td className="px-2 py-1.5">
                    {hist.length === 0 ? "—" : hist.map((h) => (
                      <div key={h.id}>{fmtFR(h.from_date)} → {fmtFR(h.to_date)} ({h.reason || "sans motif"})</div>
                    ))}
                  </td>
                  <td className="px-2 py-1.5">{r.occ.comment ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------- STATISTIQUES ----------------------------------

function StatsView({ rows }: { rows: Row[] }) {
  const today = todayISO();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);

  const inRange = rows.filter((r) => r.occ.due_date >= from && r.occ.due_date <= to);
  const count = (s: string) => inRange.filter((r) => r.status === s).length;
  const postponedCount = inRange.filter((r) => r.occ.status === "postponed").length;

  const cards = [
    { label: "Tâches prévues", value: inRange.length, cls: "text-foreground" },
    { label: "Réalisées", value: count("done"), cls: "text-green-700" },
    { label: "En retard", value: count("late"), cls: "text-red-600" },
    { label: "Reportées", value: postponedCount, cls: "text-purple-600" },
    { label: "Non réalisées", value: count("missed"), cls: "text-neutral-700" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <div><Label className="text-xs">Du</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Au</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex items-end gap-1">
          <Button size="sm" variant="outline" onClick={() => { setFrom(today); setTo(today); }}>Jour</Button>
          <Button size="sm" variant="outline" onClick={() => { setFrom(mondayOf(today)); setTo(addDays(mondayOf(today), 6)); }}>Semaine</Button>
          <Button size="sm" variant="outline" onClick={() => { setFrom(`${today.slice(0, 7)}-01`); setTo(today); }}>Mois</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-3 text-center">
            <div className={`text-2xl font-bold ${c.cls}`}>{c.value}</div>
            <div className="text-[11px] text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------ ADMIN TÂCHES ---------------------------------

const EMPTY: Partial<PepTask> = {
  name: "",
  equipment: "",
  frequency: "monthly",
  responsable: "",
  weekend_allowed: false,
  requires_photo: false,
  requires_photo_before_after: false,
  active: true,
  start_date: todayISO(),
};

function TasksAdmin({ tasks, onChanged }: { tasks: PepTask[]; onChanged: () => Promise<void> | void }) {
  const [editing, setEditing] = useState<Partial<PepTask> | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="h-4 w-4 mr-1" /> Nouvelle tâche PEP
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Importer le catalogue PEP standard (matériels + fréquences) ? Les tâches déjà existantes ne seront pas modifiées.")) return;
            setBusy(true);
            try {
              const { importPepCatalog, ensurePlanning: plan } = await import("@/lib/pepData");
              const res = await importPepCatalog();
              await plan();
              toast({ title: "Catalogue PEP importé", description: `${res.added} tâche(s) ajoutée(s), ${res.skipped} déjà présente(s).` });
              await onChanged();
            } catch (e: any) {
              toast({ title: "Erreur", description: e?.message, variant: "destructive" });
            } finally {
              setBusy(false);
            }
          }}
        >
          Importer le catalogue PEP
        </Button>
      </div>


      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              {["Tâche", "Matériel", "Fréquence", "Responsable", "Début", "Photos", "Week-end", "Active", ""].map((h) => (
                <th key={h} className="px-2 py-2 text-left whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">Aucune tâche PEP. Créez la première.</td></tr>
            )}
            {tasks.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-2 py-1.5">{t.name}</td>
                <td className="px-2 py-1.5">{t.equipment ?? "—"}</td>
                <td className="px-2 py-1.5">{FREQ_LABEL[t.frequency]}</td>
                <td className="px-2 py-1.5">{t.responsable ?? "—"}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{fmtFR(t.start_date)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {t.requires_photo_before_after ? "Avant + Après" : t.requires_photo ? "Oui" : "—"}
                </td>
                <td className="px-2 py-1.5">{t.weekend_allowed ? "Oui" : "Non"}</td>
                <td className="px-2 py-1.5">{t.active ? "Oui" : "Non"}</td>

                <td className="px-2 py-1.5 whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Modifier</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      if (!confirm(`Supprimer « ${t.name} » et son historique ?`)) return;
                      await deleteTask(t.id);
                      await onChanged();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing.id ? "Modifier la tâche" : "Nouvelle tâche PEP"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nom de la tâche *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label className="text-xs">Matériel concerné</Label><Input value={editing.equipment ?? ""} onChange={(e) => setEditing({ ...editing, equipment: e.target.value })} /></div>
              <div>
                <Label className="text-xs">Fréquence *</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                  value={editing.frequency ?? "monthly"}
                  onChange={(e) => setEditing({ ...editing, frequency: e.target.value as PepFrequency })}
                >
                  {PEP_FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Responsable</Label><Input value={editing.responsable ?? ""} onChange={(e) => setEditing({ ...editing, responsable: e.target.value })} /></div>
              <div><Label className="text-xs">Date de début</Label><Input type="date" value={editing.start_date ?? todayISO()} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} /></div>
              {([
                { key: "weekend_allowed", label: "Peut être planifiée le week-end" },
                ...(editing.frequency === "daily"
                  ? []
                  : [
                      { key: "requires_photo" as const, label: "Photo / justificatif attendu" },
                      { key: "requires_photo_before_after" as const, label: "Photos AVANT et APRÈS obligatoires" },
                    ]),
                { key: "active", label: "Tâche active" },
              ] as const).map(({ key, label }) => {
                const value = key === "active" ? editing.active !== false : !!(editing as any)[key];
                return (
                  <button
                    key={key}
                    type="button"
                    className="w-full flex items-center justify-between py-1 text-left"
                    onClick={() => setEditing((prev) => ({ ...(prev ?? {}), [key]: !value }))}
                  >
                    <Label className="text-xs pointer-events-none">{label}</Label>
                    <Switch checked={value} tabIndex={-1} className="pointer-events-none" onCheckedChange={() => {}} />
                  </button>
                );
              })}

              <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
              <Button
                disabled={busy || !editing.name?.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await saveTask(editing as any);
                    toast({ title: "Tâche enregistrée" });
                    setEditing(null);
                    await onChanged();
                  } catch (e: any) {
                    toast({ title: "Erreur", description: e?.message, variant: "destructive" });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ----------------------------- JOURS FÉRIÉS ----------------------------------

function HolidaysAdmin({ holidays, onChanged }: { holidays: PepHoliday[]; onChanged: () => Promise<void> | void }) {
  const [date, setDate] = useState(todayISO());
  const [label, setLabel] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end flex-wrap">
        <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="flex-1 min-w-[160px]"><Label className="text-xs">Libellé</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Fête du Trône…" /></div>
        <Button
          size="sm"
          disabled={!label.trim() || !date}
          onClick={async () => {
            try {
              await saveHoliday({ holiday_date: date, label: label.trim() });
              setLabel("");
              await onChanged();
            } catch (e: any) {
              toast({ title: "Erreur", description: e?.message, variant: "destructive" });
            }
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      <div className="rounded-lg border divide-y">
        {holidays.length === 0 && <p className="p-4 text-sm text-muted-foreground">Aucun jour férié enregistré.</p>}
        {holidays.map((h) => (
          <div key={h.id} className="flex items-center gap-2 p-2">
            <Input
              type="date"
              className="w-40"
              value={h.holiday_date}
              onChange={async (e) => {
                await saveHoliday({ id: h.id, holiday_date: e.target.value, label: h.label });
                await onChanged();
              }}
            />
            <Input
              className="flex-1"
              defaultValue={h.label}
              onBlur={async (e) => {
                if (e.target.value !== h.label) {
                  await saveHoliday({ id: h.id, holiday_date: h.holiday_date, label: e.target.value });
                  await onChanged();
                }
              }}
            />
            <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { await deleteHoliday(h.id); await onChanged(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
