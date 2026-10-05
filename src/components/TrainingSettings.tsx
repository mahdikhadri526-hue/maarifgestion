import { useEffect, useState } from "react";
import { GraduationCap, Loader2, Mic, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteTrainingStep, generateStepAudio, loadTrainingSteps, upsertTrainingStep, type TrainingStep } from "@/lib/voiceTraining";

const MODULES: Record<string, string> = { dashboard: "Tableau de bord" };

export function TrainingSettings() {
  const [moduleKey, setModuleKey] = useState("dashboard");
  const [steps, setSteps] = useState<TrainingStep[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { loadTrainingSteps(moduleKey).then(setSteps).catch(() => toast.error("Chargement impossible")); }, [moduleKey]);

  const edit = (id: string, patch: Partial<TrainingStep>) => setSteps((l) => l.map((s) => s.id === id ? { ...s, ...patch } : s));

  const add = async () => {
    try {
      const s = await upsertTrainingStep({ module_key: moduleKey, position: steps.length, text: "", target_label: "" });
      setSteps((l) => [...l, s]);
    } catch { toast.error("Ajout impossible"); }
  };

  const save = async (s: TrainingStep, withVoice: boolean) => {
    if (withVoice && !s.text.trim()) { toast.error("Écrivez d'abord le texte de l'étape."); return; }
    setBusy(s.id);
    try {
      let saved = await upsertTrainingStep({ id: s.id, module_key: s.module_key, position: s.position, text: s.text, target_label: s.target_label });
      if (withVoice) saved = await generateStepAudio(saved);
      edit(s.id, saved);
      toast.success(withVoice ? "Vocal de l'étape créé" : "Étape enregistrée");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(null); }
  };

  const remove = async (s: TrainingStep) => {
    try { await deleteTrainingStep(s); setSteps((l) => l.filter((x) => x.id !== s.id)); }
    catch { toast.error("Suppression impossible"); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> Formation guidée</CardTitle>
        <p className="text-xs text-muted-foreground">Écrivez chaque étape et le mot affiché à l'écran à mettre en évidence (ex. « Ruptures »). La voix lit les étapes une par une et la page s'illumine au même moment.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={moduleKey} onChange={(e) => setModuleKey(e.target.value)}>
          {Object.entries(MODULES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {steps.map((s, i) => (
          <div key={s.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between text-sm font-medium">
              Étape {i + 1}
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Supprimer l'étape" onClick={() => void remove(s)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <Input placeholder="Élément à mettre en évidence (texte visible, ex. Ruptures)" value={s.target_label} onChange={(e) => edit(s.id, { target_label: e.target.value })} />
            <Textarea rows={2} placeholder="Ce que dit la voix à cette étape…" value={s.text} onChange={(e) => edit(s.id, { text: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void save(s, false)}><Save className="h-4 w-4" /> Enregistrer</Button>
              <Button size="sm" disabled={busy !== null} onClick={() => void save(s, true)}>
                {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                {s.audio_path ? "Recréer le vocal" : "Créer le vocal"}
              </Button>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => void add()}><Plus className="h-4 w-4" /> Ajouter une étape</Button>
      </CardContent>
    </Card>
  );
}
