import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { fmtFR, todayISO } from "@/lib/pepData";
import {
  TECH_PRIORITIES,
  TECH_STATUSES,
  TECH_STATUS_ORDER,
  deleteTechIssue,
  fmtDateTimeFR,
  getTechIssues,
  isOverdue,
  techPhotos,
  updateTechIssue,
  type TechIssue,
  type TechStatus,
} from "@/lib/techData";
import { ReportIssueDialog } from "./ReportIssueDialog";

const PRIO_RANK: Record<string, number> = { critique: 0, urgente: 1, normale: 2 };

export function TechModule() {
  const { can, pdv } = useAuth();
  const canManage = can("manage_tech");
  const [issues, setIssues] = useState<TechIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TechStatus | "open" | "all">("open");
  const [reportOpen, setReportOpen] = useState(false);
  const [editing, setEditing] = useState<TechIssue | null>(null);
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
    const c: Record<string, number> = { a_traiter: 0, en_cours: 0, repare: 0, cloture: 0, overdue: 0 };
    for (const i of issues) { c[i.status]++; if (isOverdue(i, today)) c.overdue++; }
    return c;
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

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {TECH_STATUSES.map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)} className={`rounded-lg border p-3 text-left bg-card hover:bg-accent transition ${filter === s.key ? "ring-2 ring-primary" : ""}`}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}</div>
            <div className="text-2xl font-bold">{counts[s.key]}</div>
          </button>
        ))}
        <div className={`rounded-lg border p-3 ${counts.overdue > 0 ? "border-destructive bg-destructive/10" : "bg-card"}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3 w-3" />Deadline dépassée</div>
          <div className="text-2xl font-bold">{counts.overdue}</div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        <Button size="sm" variant={filter === "open" ? "default" : "outline"} onClick={() => setFilter("open")}>En cours de traitement</Button>
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Tous</Button>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucun signalement.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((i) => {
            const prio = TECH_PRIORITIES.find((p) => p.key === i.priority)!;
            const st = TECH_STATUSES.find((s) => s.key === i.status)!;
            const overdue = isOverdue(i, today);
            return (
              <div key={i.id} className={`rounded-lg border bg-card p-3 ${overdue ? "border-destructive" : ""} ${i.priority === "critique" && i.status !== "cloture" ? "animate-pulse-border" : ""}`}>
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${st.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{i.equipment}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${prio.className}`}>{prio.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] border">{st.label}</span>
                      {overdue && <span className="px-2 py-0.5 rounded-full text-[11px] bg-destructive text-destructive-foreground">Deadline dépassée</span>}
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
                  </div>
                  {canManage && (
                    <div className="flex flex-col gap-1">
                      {i.status === "a_traiter" && <Button size="sm" onClick={() => setEditing({ ...i, status: "en_cours" })}>Prendre en charge</Button>}
                      {i.status === "en_cours" && <Button size="sm" onClick={() => setEditing({ ...i, status: "repare" })}>Marquer réparé</Button>}
                      {i.status === "repare" && <Button size="sm" onClick={() => setEditing({ ...i, status: "cloture" })}>Clôturer</Button>}
                      <Button size="sm" variant="outline" onClick={() => setEditing(i)}>Suivi</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                        if (!confirm("Supprimer ce signalement ?")) return;
                        try { await deleteTechIssue(i.id); await load(); } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ReportIssueDialog open={reportOpen} onClose={() => setReportOpen(false)} onReported={load} />

      {editing && <FollowUpDialog issue={editing} onClose={() => setEditing(null)} onSaved={load} />}

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

  const save = async () => {
    if ((status === "en_cours" || status === "repare") && !deadline) {
      return toast({ title: "Deadline obligatoire pour l'intervention", variant: "destructive" });
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
              {TECH_STATUSES.map((s) => (
                <button key={s.key} type="button" onClick={() => setStatus(s.key)} className={`px-3 py-1 rounded-full text-xs border flex items-center gap-1 ${status === s.key ? "bg-primary text-primary-foreground border-transparent" : "bg-background"}`}>
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}
                </button>
              ))}
            </div>
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
