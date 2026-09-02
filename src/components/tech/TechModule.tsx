import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Camera, CheckCircle2, ClipboardList, History, Plus, Repeat, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useManagers } from "@/lib/roster";
import { fileToCompressedDataUrl, fmtFR, todayISO } from "@/lib/pepData";
import {
  TECH_ALERT_DAYS_BEFORE,
  TECH_EVENT_LABELS,
  TECH_PRIORITIES,
  TECH_RECURRENT_THRESHOLD,
  TECH_RECURRENT_WINDOW_DAYS,
  TECH_STATUSES,
  TECH_STATUS_ORDER,
  awaitingManager,
  daysToDeadline,
  deleteTechIssue,
  describeEvent,
  fmtDateTimeFR,
  getTechEvents,
  getTechIssues,
  isDeadlineSoon,
  isOverdue,
  isRecurring,
  isTechLate,
  managerValidate,
  recurringEquipments,
  techPhotos,
  techRepairPhotos,
  updateTechIssue,
  validateRepair,
  type TechEvent,
  type TechIssue,
  type TechStatus,
} from "@/lib/techData";
import { ReportIssueDialog } from "./ReportIssueDialog";

const PRIO_RANK: Record<string, number> = { critique: 0, urgente: 1, normale: 2 };

type View = "dossiers" | "controle" | "historique";

export function TechModule() {
  const { can, pdv } = useAuth();
  const canManage = can("manage_tech");
  // La vérification finale est réservée au manager (Agenda PEP), pas au
  // responsable technique.
  const canManagerValidate = can("manage_pep") || can("view_pep");
  const [issues, setIssues] = useState<TechIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("dossiers");
  const [filter, setFilter] = useState<TechStatus | "open" | "all">("open");
  const [reportOpen, setReportOpen] = useState(false);
  const [editing, setEditing] = useState<TechIssue | null>(null);
  const [repairing, setRepairing] = useState<TechIssue | null>(null);
  const [validating, setValidating] = useState<TechIssue | null>(null);
  const [historyOf, setHistoryOf] = useState<TechIssue | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const today = todayISO();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setIssues(await getTechIssues());
    } catch (e: any) {
      toast({ title: "Erreur Suivi Technique", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const recurring = useMemo(() => recurringEquipments(issues), [issues]);

  const visible = useMemo(() => {
    const list = issues.filter((i) =>
      filter === "all" ? true : filter === "open" ? i.status === "a_traiter" || i.status === "en_cours" : i.status === filter,
    );
    return [...list].sort((a, b) => {
      const sa = TECH_STATUS_ORDER.indexOf(a.status), sb = TECH_STATUS_ORDER.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      const pa = PRIO_RANK[a.priority] ?? 9, pb = PRIO_RANK[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return b.reported_at.localeCompare(a.reported_at);
    });
  }, [issues, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { a_traiter: 0, en_cours: 0, repare: 0, cloture: 0, overdue: 0, soon: 0, awaiting: 0 };
    for (const i of issues) {
      c[i.status]++;
      if (isOverdue(i, today)) c.overdue++;
      if (isDeadlineSoon(i, today)) c.soon++;
      if (awaitingManager(i)) c.awaiting++;
    }
    return c;
  }, [issues, today]);

  const alerts = useMemo(() => {
    const overdue = issues.filter((i) => isOverdue(i, today));
    const soon = issues.filter((i) => isDeadlineSoon(i, today));
    const awaiting = issues.filter(awaitingManager);
    return { overdue, soon, awaiting };
  }, [issues, today]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Suivi Technique</h2>
        </div>
        {pdv && <span className="text-xs text-muted-foreground">PDV : {pdv.name}</span>}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>{loading ? "Chargement…" : "Actualiser"}</Button>
          <Button size="sm" onClick={() => setReportOpen(true)}><Plus className="h-4 w-4 mr-1" />Signaler</Button>
        </div>
      </div>

      {/* Alertes automatiques */}
      {(alerts.overdue.length > 0 || alerts.soon.length > 0 || alerts.awaiting.length > 0) && (
        <div className="space-y-2">
          {alerts.overdue.length > 0 && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm animate-pulse-border">
              <div className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />Retard : {alerts.overdue.length} intervention(s) au-delà de la deadline</div>
              <ul className="mt-1 text-xs space-y-0.5">
                {alerts.overdue.map((i) => (
                  <li key={i.id}>• <b>{i.equipment}</b> — deadline {fmtFR(i.deadline!)} ({Math.abs(daysToDeadline(i, today)!)} j de retard) · Responsable : {i.assigned_to || "non désigné"}</li>
                ))}
              </ul>
            </div>
          )}
          {alerts.soon.length > 0 && (
            <div className="rounded-lg border border-amber-500 bg-amber-500/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-amber-600" />Deadline proche (≤ {TECH_ALERT_DAYS_BEFORE} j) : {alerts.soon.length} intervention(s)</div>
              <ul className="mt-1 text-xs space-y-0.5">
                {alerts.soon.map((i) => {
                  const d = daysToDeadline(i, today)!;
                  return <li key={i.id}>• <b>{i.equipment}</b> — {d === 0 ? "aujourd'hui" : `dans ${d} j`} ({fmtFR(i.deadline!)}) · {i.assigned_to || "non désigné"}</li>;
                })}
              </ul>
            </div>
          )}
          {alerts.awaiting.length > 0 && (
            <div className="rounded-lg border border-primary bg-primary/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-primary" />{alerts.awaiting.length} réparation(s) en attente de la vérification du manager</div>
              <ul className="mt-1 text-xs space-y-0.5">
                {alerts.awaiting.map((i) => <li key={i.id}>• <b>{i.equipment}</b> — réparé le {fmtDateTimeFR(i.tech_validated_at)} par {i.tech_validated_by}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        {TECH_STATUSES.map((s) => (
          <button key={s.key} onClick={() => { setView("dossiers"); setFilter(s.key); }} className={`rounded-lg border p-3 text-left bg-card hover:bg-accent transition ${view === "dossiers" && filter === s.key ? "ring-2 ring-primary" : ""}`}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}</div>
            <div className="text-2xl font-bold">{counts[s.key]}</div>
          </button>
        ))}
        <div className={`rounded-lg border p-3 ${counts.overdue > 0 ? "border-destructive bg-destructive/10" : "bg-card"}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3 w-3" />Deadline dépassée</div>
          <div className="text-2xl font-bold">{counts.overdue}</div>
        </div>
        <div className={`rounded-lg border p-3 ${recurring.size > 0 ? "border-amber-500 bg-amber-500/10" : "bg-card"}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Repeat className="h-3 w-3" />Problèmes récurrents</div>
          <div className="text-2xl font-bold">{recurring.size}</div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        <Button size="sm" variant={view === "dossiers" && filter === "open" ? "default" : "outline"} onClick={() => { setView("dossiers"); setFilter("open"); }}>En cours de traitement</Button>
        <Button size="sm" variant={view === "dossiers" && filter === "all" ? "default" : "outline"} onClick={() => { setView("dossiers"); setFilter("all"); }}>Tous</Button>
        <Button size="sm" variant={view === "controle" ? "default" : "outline"} onClick={() => setView("controle")}><ClipboardList className="h-3.5 w-3.5 mr-1" />Retards & validations</Button>
        <Button size="sm" variant={view === "historique" ? "default" : "outline"} onClick={() => setView("historique")}><History className="h-3.5 w-3.5 mr-1" />Historique des interventions</Button>
      </div>

      {recurring.size > 0 && view === "dossiers" && (
        <div className="rounded-lg border border-amber-500/60 bg-card p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold"><Repeat className="h-4 w-4 text-amber-600" />Problèmes récurrents détectés (≥ {TECH_RECURRENT_THRESHOLD} signalements sur {TECH_RECURRENT_WINDOW_DAYS} jours)</div>
          <ul className="mt-1 text-xs space-y-0.5">
            {[...recurring.entries()].map(([k, list]) => (
              <li key={k}>• <b>{list[0].equipment}</b> — {list.length} signalements (dernier : {fmtDateTimeFR(list.sort((a, b) => b.reported_at.localeCompare(a.reported_at))[0].reported_at)})</li>
            ))}
          </ul>
        </div>
      )}

      {view === "controle" && <ControlView issues={issues} today={today} />}
      {view === "historique" && <GlobalHistory issues={issues} />}

      {view === "dossiers" && (visible.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucun signalement.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((i) => {
            const prio = TECH_PRIORITIES.find((p) => p.key === i.priority)!;
            const st = TECH_STATUSES.find((s) => s.key === i.status)!;
            const overdue = isOverdue(i, today);
            const soon = isDeadlineSoon(i, today);
            const dd = daysToDeadline(i, today);
            const rec = isRecurring(i, recurring);
            return (
              <div key={i.id} className={`rounded-lg border bg-card p-3 ${overdue ? "border-destructive" : soon ? "border-amber-500" : ""} ${i.priority === "critique" && i.status !== "cloture" ? "animate-pulse-border" : ""}`}>
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${st.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{i.equipment}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${prio.className}`}>{prio.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] border">{st.label}</span>
                      {overdue && <span className="px-2 py-0.5 rounded-full text-[11px] bg-destructive text-destructive-foreground">Deadline dépassée ({Math.abs(dd!)} j)</span>}
                      {soon && !overdue && <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500 text-white">Deadline {dd === 0 ? "aujourd'hui" : `J-${dd}`}</span>}
                      {rec && <span className="px-2 py-0.5 rounded-full text-[11px] border border-amber-500 text-amber-700 flex items-center gap-1"><Repeat className="h-3 w-3" />Récurrent</span>}
                      {awaitingManager(i) && <span className="px-2 py-0.5 rounded-full text-[11px] bg-primary text-primary-foreground">Attente validation manager</span>}
                      {isTechLate(i) && <span className="px-2 py-0.5 rounded-full text-[11px] border border-destructive text-destructive">Réparé en retard</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {i.location ? `${i.location} · ` : ""}Signalé le {fmtDateTimeFR(i.reported_at)} par {i.reported_by}
                    </p>
                    <p className="text-sm mt-1">{i.problem}</p>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                      <span>Responsable : <b>{i.assigned_to || "—"}</b></span>
                      <span>Deadline : <b className={overdue ? "text-destructive" : ""}>{i.deadline ? fmtFR(i.deadline) : "—"}</b></span>
                      {i.taken_at && <span>Pris en charge : {fmtDateTimeFR(i.taken_at)}</span>}
                      {i.repaired_at && <span>Réparé : {fmtDateTimeFR(i.repaired_at)}</span>}
                      {i.closed_at && <span>Clôturé : {fmtDateTimeFR(i.closed_at)}</span>}
                    </div>
                    {i.tech_notes && <p className="text-xs mt-1">🔧 {i.tech_notes}</p>}
                    {techPhotos(i).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {techPhotos(i).map((u, k) => (
                          <button key={k} type="button" onClick={() => setPreview(u)}><img src={u} alt={`Photo ${k + 1}`} className="h-14 w-14 rounded border object-cover" /></button>
                        ))}
                      </div>
                    )}

                    {/* Bloc contrôle après réparation */}
                    {(i.tech_validated_at || i.manager_validated_at) && (
                      <div className="mt-2 rounded-md border bg-muted/40 p-2 text-xs space-y-1">
                        {i.tech_validated_at && (
                          <div>
                            <div className="flex items-center gap-1 font-semibold"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Réparation validée par {i.tech_validated_by} le {fmtDateTimeFR(i.tech_validated_at)}{isTechLate(i) && <span className="text-destructive"> — après la deadline</span>}</div>
                            {i.action_done && <div>Action réalisée : {i.action_done}</div>}
                            {i.tech_comment && <div>Commentaire : {i.tech_comment}</div>}
                            {techRepairPhotos(i).length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-1">
                                {techRepairPhotos(i).map((u, k) => (
                                  <button key={k} type="button" onClick={() => setPreview(u)}><img src={u} alt={`Photo réparation ${k + 1}`} className="h-14 w-14 rounded border object-cover" /></button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {i.manager_validated_at ? (
                          <div className="flex items-center gap-1 font-semibold"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Fonctionnement vérifié par {i.manager_validated_by} le {fmtDateTimeFR(i.manager_validated_at)}{i.manager_comment ? ` — ${i.manager_comment}` : ""}</div>
                        ) : i.tech_validated_at ? (
                          <div className="text-muted-foreground">En attente de la vérification du manager.</div>
                        ) : null}
                        {!i.manager_validated_at && i.manager_comment && i.status === "en_cours" && (
                          <div className="text-destructive">Refus manager : {i.manager_comment}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {canManage && i.status === "a_traiter" && <Button size="sm" onClick={() => setEditing({ ...i, status: "en_cours" })}>Prendre en charge</Button>}
                    {canManage && i.status === "en_cours" && <Button size="sm" onClick={() => setRepairing(i)}>Valider la réparation</Button>}
                    {canManagerValidate && i.status === "repare" && !i.manager_validated_at && <Button size="sm" onClick={() => setValidating(i)}>Vérification manager</Button>}
                    {canManage && <Button size="sm" variant="outline" onClick={() => setEditing(i)}>Suivi</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setHistoryOf(i)}><History className="h-4 w-4 mr-1" />Historique</Button>
                    {canManage && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                        if (!confirm("Supprimer ce signalement ?")) return;
                        try { await deleteTechIssue(i.id); await load(); } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
                      }}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <ReportIssueDialog open={reportOpen} onClose={() => setReportOpen(false)} onReported={load} />

      {editing && <FollowUpDialog issue={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {repairing && <RepairDialog issue={repairing} onClose={() => setRepairing(null)} onSaved={load} />}
      
      {historyOf && <HistoryDialog issue={historyOf} onClose={() => setHistoryOf(null)} />}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Photo</DialogTitle></DialogHeader>
          {preview && <img src={preview} alt="Photo signalement" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FollowUpDialog({ issue, onClose, onSaved }: { issue: TechIssue; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<TechStatus>(issue.status);
  const [assigned, setAssigned] = useState(issue.assigned_to ?? "");
  const [deadline, setDeadline] = useState(issue.deadline ?? "");
  const [notes, setNotes] = useState(issue.tech_notes ?? "");
  const [priority, setPriority] = useState(issue.priority);
  const [saving, setSaving] = useState(false);
  const bothValidated = !!issue.tech_validated_at && !!issue.manager_validated_at;

  const save = async () => {
    if ((status === "en_cours" || status === "repare") && !deadline) {
      return toast({ title: "Deadline obligatoire pour l'intervention", variant: "destructive" });
    }
    if (status === "cloture" && !bothValidated) {
      return toast({ title: "Clôture impossible", description: "La validation du responsable technique et la vérification du manager sont obligatoires.", variant: "destructive" });
    }
    setSaving(true);
    try {
      await updateTechIssue(issue.id, { status, assigned_to: assigned.trim() || null, deadline: deadline || null, tech_notes: notes.trim() || null, priority });
      toast({ title: "Suivi enregistré" });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Suivi de l'intervention — {issue.equipment}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Statut</Label>
            <div className="flex gap-1 flex-wrap mt-1">
              {TECH_STATUSES.map((s) => {
                const disabled = s.key === "cloture" && !bothValidated;
                return (
                  <button key={s.key} type="button" disabled={disabled} title={disabled ? "Nécessite les deux validations" : undefined} onClick={() => setStatus(s.key)} className={`px-3 py-1 rounded-full text-xs border flex items-center gap-1 disabled:opacity-40 ${status === s.key ? "bg-primary text-primary-foreground border-transparent" : "bg-background"}`}>
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}
                  </button>
                );
              })}
            </div>
            {!bothValidated && <p className="text-[11px] text-muted-foreground mt-1">« Clôturé » n'est possible qu'après validation du responsable technique et vérification du manager.</p>}
          </div>
          <div>
            <Label className="text-xs">Priorité</Label>
            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
              {TECH_PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">Responsable technique</Label><Input value={assigned} onChange={(e) => setAssigned(e.target.value)} placeholder="Nom du technicien / prestataire" /></div>
          <div><Label className="text-xs">Deadline de l'intervention</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
          <div><Label className="text-xs">Notes de suivi</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepairDialog({ issue, onClose, onSaved }: { issue: TechIssue; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(issue.assigned_to ?? "");
  const [action, setAction] = useState(issue.action_done ?? "");
  const [comment, setComment] = useState(issue.tech_comment ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [photos, setPhotos] = useState<string[]>(techRepairPhotos(issue));
  const [saving, setSaving] = useState(false);
  const today = todayISO();
  const late = !!issue.deadline && date.slice(0, 10) > issue.deadline;

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    try {
      const urls = await Promise.all(Array.from(files).map((f) => fileToCompressedDataUrl(f)));
      setPhotos((p) => [...p, ...urls]);
    } catch (e: any) {
      toast({ title: "Photo", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const save = async () => {
    if (!name.trim()) return toast({ title: "Nom du responsable technique obligatoire", variant: "destructive" });
    if (!action.trim()) return toast({ title: "Action réalisée obligatoire", variant: "destructive" });
    if (photos.length === 0) return toast({ title: "Photo après réparation obligatoire", variant: "destructive" });
    if (date.slice(0, 10) > today) return toast({ title: "La date de réparation ne peut pas être future", variant: "destructive" });
    setSaving(true);
    try {
      await validateRepair(issue.id, {
        validated_by: name,
        action_done: action,
        tech_comment: comment,
        repairPhotoUrls: photos,
        repaired_at: new Date(date).toISOString(),
      });
      toast({ title: "Réparation validée", description: "En attente de la vérification du manager." });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Valider la réparation — {issue.equipment}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Responsable technique *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du technicien / prestataire" /></div>
          <div><Label className="text-xs">Date de réparation *</Label><Input type="datetime-local" value={date} max={`${today}T23:59`} onChange={(e) => setDate(e.target.value)} />
            {late && <p className="text-[11px] text-destructive mt-1">Réparation après la deadline ({fmtFR(issue.deadline!)}) — sera comptée comme retard.</p>}
          </div>
          <div><Label className="text-xs">Action réalisée *</Label><Textarea rows={3} value={action} onChange={(e) => setAction(e.target.value)} placeholder="Ex : remplacement du thermostat, recharge gaz…" /></div>
          <div><Label className="text-xs">Commentaire du responsable technique</Label><Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
          <div>
            <Label className="text-xs flex items-center gap-1"><Camera className="h-3.5 w-3.5" />Photo(s) après réparation *</Label>
            <Input type="file" accept="image/*" capture="environment" multiple onChange={(e) => void addPhotos(e.target.files)} />
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {photos.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt={`Photo ${i + 1}`} className="h-16 w-16 rounded border object-cover" />
                    <button type="button" className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 text-xs" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Le nom, la date et l'heure de validation sont enregistrés automatiquement. Le dossier passera en « Réparé » puis devra être vérifié par un manager.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? "Enregistrement…" : "Valider la réparation"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ManagerValidateDialog({ issue, onClose, onSaved }: { issue: TechIssue; onClose: () => void; onSaved: () => void }) {
  const managers = useManagers();
  const [manager, setManager] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (ok: boolean) => {
    if (!manager.trim()) return toast({ title: "Manager obligatoire", variant: "destructive" });
    if (!ok && !comment.trim()) return toast({ title: "Commentaire obligatoire en cas de refus", variant: "destructive" });
    setSaving(true);
    try {
      await managerValidate(issue.id, manager, ok, comment);
      toast({ title: ok ? "Dossier clôturé" : "Dossier renvoyé au responsable technique" });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Vérification manager — {issue.equipment}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/40 p-2 text-xs">
            <div>Réparé par <b>{issue.tech_validated_by}</b> le {fmtDateTimeFR(issue.tech_validated_at)}</div>
            {issue.action_done && <div>Action : {issue.action_done}</div>}
          </div>
          <div>
            <Label className="text-xs">Manager vérificateur *</Label>
            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={manager} onChange={(e) => setManager(e.target.value)}>
              <option value="">— Choisir —</option>
              {managers.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">Commentaire</Label><Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Obligatoire en cas de refus" /></div>
          <p className="text-[11px] text-muted-foreground">Nom, date et heure enregistrés automatiquement. La validation clôture le dossier ; le refus le renvoie « En cours ».</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button variant="destructive" onClick={() => void submit(false)} disabled={saving}>Ne fonctionne pas</Button>
          <Button onClick={() => void submit(true)} disabled={saving}>{saving ? "…" : "Fonctionne correctement — Clôturer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventList({ events, showIssue, issues }: { events: TechEvent[]; showIssue?: boolean; issues?: TechIssue[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Aucun événement.</p>;
  const eqOf = (id: string) => issues?.find((i) => i.id === id)?.equipment ?? "—";
  return (
    <ol className="relative border-l ml-2 space-y-3">
      {events.map((e) => (
        <li key={e.id} className="ml-4 text-xs">
          <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-primary" />
          <div className="text-muted-foreground">{fmtDateTimeFR(e.created_at)}{e.actor_name ? ` · ${e.actor_name}` : ""}</div>
          <div className="font-semibold">{showIssue ? `${eqOf(e.issue_id)} — ` : ""}{TECH_EVENT_LABELS[e.event_type] ?? e.event_type}</div>
          <div>{describeEvent(e)}</div>
        </li>
      ))}
    </ol>
  );
}

function HistoryDialog({ issue, onClose }: { issue: TechIssue; onClose: () => void }) {
  const [events, setEvents] = useState<TechEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getTechEvents(issue.id).then(setEvents).catch((e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" })).finally(() => setLoading(false));
  }, [issue.id]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Historique — {issue.equipment}</DialogTitle></DialogHeader>
        {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : <EventList events={events} />}
      </DialogContent>
    </Dialog>
  );
}

function GlobalHistory({ issues }: { issues: TechIssue[] }) {
  const [events, setEvents] = useState<TechEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getTechEvents().then(setEvents).catch((e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" })).finally(() => setLoading(false));
  }, [issues.length]);
  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  return (
    <div className="rounded-lg border bg-card p-3">
      <EventList events={events} showIssue issues={issues} />
    </div>
  );
}

function ControlView({ issues, today }: { issues: TechIssue[]; today: string }) {
  const rows = useMemo(() => [...issues].filter((i) => i.deadline || i.tech_validated_at || i.status !== "a_traiter").sort((a, b) => b.reported_at.localeCompare(a.reported_at)), [issues]);
  const stats = useMemo(() => {
    let lateOpen = 0, lateRepaired = 0, onTime = 0, awaiting = 0, validated = 0, refused = 0;
    for (const i of issues) {
      if (isOverdue(i, today)) lateOpen++;
      if (i.tech_validated_at) (isTechLate(i) ? lateRepaired++ : onTime++);
      if (awaitingManager(i)) awaiting++;
      if (i.manager_validated_at) validated++;
      if (i.status === "en_cours" && i.manager_comment && !i.manager_validated_at) refused++;
    }
    return { lateOpen, lateRepaired, onTime, awaiting, validated, refused };
  }, [issues, today]);

  const Cell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <td className={`px-2 py-1.5 border-b align-top ${className}`}>{children}</td>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
        <div className={`rounded-lg border p-2 ${stats.lateOpen ? "border-destructive bg-destructive/10" : "bg-card"}`}><div className="text-muted-foreground">Retards en cours</div><div className="text-xl font-bold">{stats.lateOpen}</div></div>
        <div className={`rounded-lg border p-2 ${stats.lateRepaired ? "border-destructive bg-destructive/10" : "bg-card"}`}><div className="text-muted-foreground">Réparés en retard</div><div className="text-xl font-bold">{stats.lateRepaired}</div></div>
        <div className="rounded-lg border p-2 bg-card"><div className="text-muted-foreground">Réparés dans les délais</div><div className="text-xl font-bold">{stats.onTime}</div></div>
        <div className={`rounded-lg border p-2 ${stats.awaiting ? "border-primary bg-primary/10" : "bg-card"}`}><div className="text-muted-foreground">Attente manager</div><div className="text-xl font-bold">{stats.awaiting}</div></div>
        <div className="rounded-lg border p-2 bg-card"><div className="text-muted-foreground">Validés manager</div><div className="text-xl font-bold">{stats.validated}</div></div>
        <div className={`rounded-lg border p-2 ${stats.refused ? "border-destructive bg-destructive/10" : "bg-card"}`}><div className="text-muted-foreground">Refusés manager</div><div className="text-xl font-bold">{stats.refused}</div></div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-xs">
          <thead className="bg-muted/60">
            <tr>
              {["Matériel", "Signalé", "Responsable", "Deadline", "Réparation (validation tech)", "Retard", "Vérification manager", "Statut"].map((h) => <th key={h} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><Cell className="text-center text-muted-foreground" >Aucune intervention.</Cell></tr>}
            {rows.map((i) => {
              const dd = daysToDeadline(i, today);
              const overdue = isOverdue(i, today);
              const late = isTechLate(i);
              const st = TECH_STATUSES.find((s) => s.key === i.status)!;
              let retard = "—";
              if (overdue) retard = `${Math.abs(dd!)} j (en cours)`;
              else if (late && i.deadline) retard = `${Math.round((new Date(i.tech_validated_at!.slice(0, 10) + "T00:00:00").getTime() - new Date(i.deadline + "T00:00:00").getTime()) / 86_400_000)} j`;
              else if (i.tech_validated_at && i.deadline) retard = "Dans les délais";
              return (
                <tr key={i.id} className={overdue || late ? "bg-destructive/5" : ""}>
                  <Cell><b>{i.equipment}</b>{i.location ? <div className="text-muted-foreground">{i.location}</div> : null}</Cell>
                  <Cell>{fmtDateTimeFR(i.reported_at)}<div className="text-muted-foreground">{i.reported_by}</div></Cell>
                  <Cell>{i.assigned_to || "—"}</Cell>
                  <Cell className={overdue ? "text-destructive font-semibold" : ""}>{i.deadline ? fmtFR(i.deadline) : "—"}</Cell>
                  <Cell>{i.tech_validated_at ? <>{fmtDateTimeFR(i.tech_validated_at)}<div className="text-muted-foreground">{i.tech_validated_by}</div></> : <span className="text-muted-foreground">Non validée</span>}</Cell>
                  <Cell className={overdue || late ? "text-destructive font-semibold" : ""}>{retard}</Cell>
                  <Cell>{i.manager_validated_at ? <>{fmtDateTimeFR(i.manager_validated_at)}<div className="text-muted-foreground">{i.manager_validated_by}</div></> : i.status === "en_cours" && i.manager_comment ? <span className="text-destructive">Refusée : {i.manager_comment}</span> : i.tech_validated_at ? <span className="text-primary">En attente</span> : "—"}</Cell>
                  <Cell><span className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${st.dot}`} />{st.label}</span></Cell>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
