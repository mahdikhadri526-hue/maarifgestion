import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CLEANING_ZONES, CleaningLog, CleaningStatus, addCleaningLog, deleteCleaningLog, getCleaningLogs, updateCleaningLog } from "@/lib/cleaningData";
import { OPERATORS } from "@/lib/operators";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Check, X, Save, Sparkles, Pencil } from "lucide-react";
import { toast } from "sonner";

const CLEANING_EXTRA_OPERATORS = [
  "ANNINY HASSANIA",
  "HACHEM",
  "OUSSAMA BELGHZAL",
  "OTHMAN GHALMI",
  "KHADIJA AMROUG",
  "AYA EL BASTI",
  "SOUAD MOUBTASSIM",
  "ANASS ZNIBI",
  "HAMZA LAMRAMI",
  "ISSAM GRIMEJ",
  "ITRI HASNA",
  "SAFAA SADIKI",
  "ITRI HASNA / SAFAA SADIKI",
  "BOUIRANE MOHAMED",
  "MADIH SAID",
  "BADOU HAMID",
  "ADIL EL HANI",
  "OUSSAMA MOUBTASSIM",
  "MEHDI BAYN",
];

const CLEANING_OPERATORS = Array.from(new Set([...OPERATORS, ...CLEANING_EXTRA_OPERATORS]));

const CLEANING_MANAGERS = ["Mr Mahdi Khadri", "Mr Hamza Fadlou"] as const;

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function CleaningManager() {
  const [zoneKey, setZoneKey] = useState("");
  const zone = useMemo(() => CLEANING_ZONES.find((z) => z.key === zoneKey), [zoneKey]);

  const [date, setDate] = useState(todayISO());
  const [collaborateur, setCollaborateur] = useState("");
  const [visa, setVisa] = useState("");
  const [notes, setNotes] = useState("");
  const [tasks, setTasks] = useState<Record<string, CleaningStatus>>({});
  const [historyDate, setHistoryDate] = useState<string>("");
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTasks, setEditTasks] = useState<Record<string, CleaningStatus>>({});
  const [editNotes, setEditNotes] = useState("");
  const [editVisa, setEditVisa] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const { user } = useAuth();

  const refresh = async () => {
    try {
      setLogs(await getCleaningLogs());
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
    if (!zone) return;
    const next: Record<string, CleaningStatus> = {};
    for (const t of zone.tasks) next[t] = v;
    setTasks(next);
  };

  const save = async () => {
    if (!zone) return toast.error("Sélectionnez une zone");
    if (!collaborateur) return toast.error("Sélectionnez un collaborateur");
    const filled = zone.tasks.filter((t) => tasks[t] === "F" || tasks[t] === "C" || tasks[t] === "NC").length;
    if (filled === 0) return toast.error("Cochez au moins une tâche");
    const exists = logs.some((l) => l.zone === zoneKey && l.logDate === date);
    if (exists) return toast.error("Une fiche est déjà enregistrée pour cette zone et cette date");
    setSaving(true);
    try {
      await addCleaningLog({
        zone: zoneKey,
        logDate: date,
        collaborateur,
        tasks,
        visaManager: visa || null,
        notes: notes.trim() || null,
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

  const startEdit = (l: CleaningLog) => {
    setEditingId(l.id);
    setEditTasks({ ...l.tasks });
    setEditNotes(l.notes ?? "");
    setEditVisa(l.visaManager ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTasks({});
    setEditNotes("");
    setEditVisa("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      await updateCleaningLog(editingId, {
        tasks: editTasks,
        notes: editNotes.trim() || null,
        visaManager: editVisa || null,
      });
      toast.success("Fiche mise à jour");
      cancelEdit();
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Suivi de nettoyage quotidien</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label>Zone</Label>
            <Select value={zoneKey} onValueChange={setZoneKey}>
              <SelectTrigger><SelectValue placeholder="Choisir une zone..." /></SelectTrigger>
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
                {CLEANING_OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {zone && (
          <>
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
                const isDone = v === "F" || v === "C" || v === "NC";
                return (
                  <div key={t} className="flex items-center gap-2 p-2 rounded-lg border bg-background">
                    <Checkbox
                      checked={isDone}
                      onCheckedChange={(checked) => {
                        setTasks((prev) => ({ ...prev, [t]: checked ? "F" : null }));
                      }}
                    />
                    <div className="flex-1 text-sm">{t}</div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setTasks((prev) => ({ ...prev, [t]: prev[t] === "C" ? "F" : "C" }))
                        }
                        disabled={!isDone}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${v === "C" ? "bg-green-600 text-white border-green-600" : "bg-background hover:bg-green-50"}`}
                      >
                        C
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTasks((prev) => ({ ...prev, [t]: prev[t] === "NC" ? "F" : "NC" }))
                        }
                        disabled={!isDone}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${v === "NC" ? "bg-red-600 text-white border-red-600" : "bg-background hover:bg-red-50"}`}
                      >
                        NC
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div>
              <Label>Visa Manager</Label>
              <Select value={visa} onValueChange={setVisa}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {CLEANING_MANAGERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
              <Save className="h-4 w-4 mr-2" /> Enregistrer la fiche
            </Button>
          </>
        )}
      </div>

      <div className="bg-card border rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h3 className="font-semibold">Historique — toutes les zones</h3>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-sm">Filtrer par jour</Label>
            <Input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="w-auto" />
            {historyDate && (
              <Button size="sm" variant="ghost" onClick={() => setHistoryDate("")}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {(() => {
          if (!historyDate) {
            return (
              <p className="text-sm text-muted-foreground">
                Sélectionnez une date pour afficher l'historique du nettoyage.
              </p>
            );
          }

          const displayedLogs = logs.filter((l) => l.logDate === historyDate);

          if (displayedLogs.length === 0) {
            return <p className="text-sm text-muted-foreground">Aucune fiche pour cette date.</p>;
          }

          const zonesDone = new Set(displayedLogs.map((l) => l.zone));
          const missingZones = CLEANING_ZONES.filter((z) => !zonesDone.has(z.key));
          return (
            <div className="space-y-2">
              {displayedLogs.map((l) => {
                const z = CLEANING_ZONES.find((x) => x.key === l.zone);
                const zoneTasks = z?.tasks ?? Object.keys(l.tasks);
                const total = zoneTasks.length;
                const conf = zoneTasks.filter((t) => l.tasks[t] === "C").length;
                const nc = zoneTasks.filter((t) => l.tasks[t] === "NC").length;
                const fait = zoneTasks.filter((t) => l.tasks[t] === "F").length;
                const done = conf + nc + fait;
                return (
                  <div key={l.id} className="p-3 rounded-lg border bg-background space-y-2">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-[180px]">
                        <div className="font-medium text-sm">{z?.label ?? l.zone} — {l.collaborateur}</div>
                        <div className="text-xs text-muted-foreground">
                          {done}/{total} tâches · {conf} conformes · {nc} NC · {fait} fait{l.visaManager ? ` · Visa: ${l.visaManager}` : ""}
                        </div>
                      </div>
                      {user?.email !== "gestionmaarif1@gmail.com" && editingId !== l.id && (
                        <Button size="sm" variant="ghost" onClick={() => startEdit(l)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {user?.email !== "gestionmaarif1@gmail.com" && editingId !== l.id && (
                        <Button size="sm" variant="ghost" onClick={() => remove(l.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    {editingId === l.id ? (
                      <div className="space-y-2 border-t pt-2">
                        {zoneTasks.map((t) => {
                          const v = editTasks[t];
                          const isDone = v === "F" || v === "C" || v === "NC";
                          return (
                            <div key={t} className="flex items-center gap-2 p-2 rounded-md border bg-background">
                              <Checkbox
                                checked={isDone}
                                onCheckedChange={(checked) =>
                                  setEditTasks((p) => ({ ...p, [t]: checked ? "F" : null }))
                                }
                              />
                              <div className="flex-1 text-xs">{t}</div>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditTasks((p) => ({ ...p, [t]: p[t] === "C" ? "F" : "C" }))}
                                  disabled={!isDone}
                                  className={`px-2 py-1 text-xs font-semibold rounded-md border disabled:opacity-40 ${v === "C" ? "bg-green-600 text-white border-green-600" : "bg-background"}`}
                                >C</button>
                                <button
                                  type="button"
                                  onClick={() => setEditTasks((p) => ({ ...p, [t]: p[t] === "NC" ? "F" : "NC" }))}
                                  disabled={!isDone}
                                  className={`px-2 py-1 text-xs font-semibold rounded-md border disabled:opacity-40 ${v === "NC" ? "bg-red-600 text-white border-red-600" : "bg-background"}`}
                                >NC</button>
                              </div>
                            </div>
                          );
                        })}
                        <div>
                          <Label className="text-xs">Notes</Label>
                          <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
                        </div>
                        <div>
                          <Label className="text-xs">Visa Manager</Label>
                          <Select value={editVisa} onValueChange={setEditVisa}>
                            <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                            <SelectContent>
                              {CLEANING_MANAGERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} disabled={savingEdit}>
                            <Save className="h-4 w-4 mr-1" /> Enregistrer
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>Annuler</Button>
                        </div>
                      </div>
                    ) : (
                    <div className="space-y-1 border-t pt-2">
                      {zoneTasks.map((t) => {
                        const v = l.tasks[t];
                        return (
                          <div key={t} className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex-1">{t}</span>
                            <span
                              className={`px-2 py-0.5 rounded font-semibold border ${
                                v === "F"
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : v === "C"
                                  ? "bg-green-600 text-white border-green-600"
                                  : v === "NC"
                                  ? "bg-red-600 text-white border-red-600"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {v === "F" ? "Fait" : v ?? "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    )}
                    {editingId !== l.id && l.notes && (
                      <div className="text-xs italic border-t pt-2"><span className="font-semibold not-italic">Notes :</span> {l.notes}</div>
                    )}
                    {editingId !== l.id && l.visaManager && (
                      <div className="text-xs"><span className="font-semibold">Visa Manager :</span> {l.visaManager}</div>
                    )}
                  </div>
                );
              })}
              {missingZones.map((z) => (
                <div key={z.key} className="p-3 rounded-lg border border-dashed bg-muted/30 space-y-2">
                  <div className="font-medium text-sm text-muted-foreground">{z.label}</div>
                  <div className="text-xs text-orange-600 font-semibold">Non remplie</div>
                  <div className="space-y-1 border-t pt-2">
                    {z.tasks.map((t) => (
                      <div key={t} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="flex-1">{t}</span>
                        <span className="px-2 py-0.5 rounded font-semibold border bg-muted">—</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}