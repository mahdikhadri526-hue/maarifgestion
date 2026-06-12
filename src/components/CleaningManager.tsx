import { useEffect, useMemo, useState } from "react";
import { CLEANING_ZONES, CleaningLog, CleaningStatus, addCleaningLog, deleteCleaningLog, getCleaningLogs } from "@/lib/cleaningData";
import { OPERATORS } from "@/lib/operators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Check, X, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function CleaningManager() {
  const [zoneKey, setZoneKey] = useState(CLEANING_ZONES[0].key);
  const zone = useMemo(() => CLEANING_ZONES.find((z) => z.key === zoneKey)!, [zoneKey]);

  const [date, setDate] = useState(todayISO());
  const [collaborateur, setCollaborateur] = useState("");
  const [visa, setVisa] = useState("");
  const [notes, setNotes] = useState("");
  const [tasks, setTasks] = useState<Record<string, CleaningStatus>>({});
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      setLogs(await getCleaningLogs(zoneKey));
    } catch (e: any) {
      toast.error(e.message ?? "Erreur de chargement");
    }
  };

  useEffect(() => {
    setTasks({});
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneKey]);

  const setTask = (t: string, v: CleaningStatus) =>
    setTasks((prev) => ({ ...prev, [t]: prev[t] === v ? null : v }));

  const setAll = (v: CleaningStatus) => {
    const next: Record<string, CleaningStatus> = {};
    for (const t of zone.tasks) next[t] = v;
    setTasks(next);
  };

  const save = async () => {
    if (!collaborateur) return toast.error("Sélectionnez un collaborateur");
    const filled = zone.tasks.filter((t) => tasks[t] === "C" || tasks[t] === "NC").length;
    if (filled === 0) return toast.error("Cochez au moins une tâche");
    setSaving(true);
    try {
      await addCleaningLog({
        zone: zoneKey,
        logDate: date,
        collaborateur,
        tasks,
        visaManager: visa || null,
        notes: notes || null,
      });
      toast.success("Fiche enregistrée");
      setTasks({});
      setNotes("");
      setVisa("");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette fiche ?")) return;
    try {
      await deleteCleaningLog(id);
      toast.success("Supprimé");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Suivi de nettoyage quotidien</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label>Zone</Label>
            <Select value={zoneKey} onValueChange={setZoneKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLEANING_ZONES.map((z) => (
                  <SelectItem key={z.key} value={z.key}>{z.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Collaborateur</Label>
            <Select value={collaborateur} onValueChange={setCollaborateur}>
              <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Visa Manager (optionnel)</Label>
            <Select value={visa} onValueChange={setVisa}>
              <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setAll("C")}>
            <Check className="h-4 w-4 mr-1" /> Tout Conforme
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAll(null)}>
            Réinitialiser
          </Button>
        </div>

        <div className="space-y-2">
          {zone.tasks.map((t) => {
            const v = tasks[t];
            return (
              <div key={t} className="flex items-center gap-2 p-2 rounded-lg border bg-background">
                <div className="flex-1 text-sm">{t}</div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setTask(t, "C")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${v === "C" ? "bg-green-600 text-white border-green-600" : "bg-background hover:bg-green-50"}`}
                  >
                    C
                  </button>
                  <button
                    type="button"
                    onClick={() => setTask(t, "NC")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${v === "NC" ? "bg-red-600 text-white border-red-600" : "bg-background hover:bg-red-50"}`}
                  >
                    NC
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <Label>Notes (optionnel)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-2" /> Enregistrer la fiche
        </Button>
      </div>

      <div className="bg-card border rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="font-semibold mb-3">Historique — {zone.label}</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune fiche enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => {
              const total = zone.tasks.length;
              const conf = zone.tasks.filter((t) => l.tasks[t] === "C").length;
              const nc = zone.tasks.filter((t) => l.tasks[t] === "NC").length;
              return (
                <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <div className="font-medium text-sm">{l.logDate} — {l.collaborateur}</div>
                    <div className="text-xs text-muted-foreground">
                      {conf}/{total} conformes · {nc} NC{l.visaManager ? ` · Visa: ${l.visaManager}` : ""}
                    </div>
                    {l.notes && <div className="text-xs italic mt-1">{l.notes}</div>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remove(l.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}