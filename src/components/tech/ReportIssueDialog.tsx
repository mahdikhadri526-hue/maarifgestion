import { useEffect, useState } from "react";
import { Camera, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useManagers } from "@/lib/roster";
import { fileToCompressedDataUrl } from "@/lib/pepData";
import { TECH_PRIORITIES, reportTechIssue, type TechPriority } from "@/lib/techData";

interface Props {
  open: boolean;
  onClose: () => void;
  onReported?: () => void;
  /** Pré-remplissage depuis une tâche PEP. */
  defaults?: {
    equipment?: string | null;
    location?: string | null;
    source_task_id?: string | null;
    source_occurrence_id?: string | null;
  };
}

export function ReportIssueDialog({ open, onClose, onReported, defaults }: Props) {
  const { user } = useAuth();
  const managers = useManagers();
  const [equipment, setEquipment] = useState("");
  const [location, setLocation] = useState("");
  const [problem, setProblem] = useState("");
  const [manager, setManager] = useState("");
  const [priority, setPriority] = useState<TechPriority>("normale");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEquipment(defaults?.equipment ?? "");
    setLocation(defaults?.location ?? "");
    setProblem("");
    setManager("");
    setPriority("normale");
    setPhotos([]);
  }, [open, defaults?.equipment, defaults?.location]);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    try {
      const urls = await Promise.all(Array.from(files).map((f) => fileToCompressedDataUrl(f)));
      setPhotos((p) => [...p, ...urls]);
    } catch (e: any) {
      toast({ title: "Photo", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const submit = async () => {
    if (!equipment.trim()) return toast({ title: "Matériel obligatoire", variant: "destructive" });
    if (!problem.trim()) return toast({ title: "Problème constaté obligatoire", variant: "destructive" });
    if (!manager.trim()) return toast({ title: "Manager signalant obligatoire", variant: "destructive" });
    setSaving(true);
    try {
      await reportTechIssue({
        equipment,
        location,
        problem,
        photoUrls: photos,
        reported_by: manager,
        reported_by_user: user?.id ?? null,
        priority,
        source_task_id: defaults?.source_task_id ?? null,
        source_occurrence_id: defaults?.source_occurrence_id ?? null,
      });
      toast({ title: "Signalement transféré au Suivi Technique" });
      onReported?.();
      onClose();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wrench className="h-4 w-4" />Signaler un problème matériel</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Matériel *</Label><Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Ex : Congélateur vitrine n°2" /></div>
          <div><Label className="text-xs">Emplacement</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex : Salle, Chambre froide, Emporter…" /></div>
          <div><Label className="text-xs">Problème constaté *</Label><Textarea rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Manager signalant *</Label>
            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={manager} onChange={(e) => setManager(e.target.value)}>
              <option value="">— Choisir —</option>
              {managers.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Priorité *</Label>
            <div className="flex gap-2 flex-wrap mt-1">
              {TECH_PRIORITIES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPriority(p.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${priority === p.key ? p.className + " border-transparent" : "bg-background"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><Camera className="h-3.5 w-3.5" />Photo(s)</Label>
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
          <p className="text-[11px] text-muted-foreground">Date et heure du signalement enregistrées automatiquement.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={() => void submit()} disabled={saving}>{saving ? "Envoi…" : "Signaler"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
