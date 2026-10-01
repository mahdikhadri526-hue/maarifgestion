import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Loader2, Mic, Pause, Play, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getVoiceGuideUrl, loadVoiceGuides, saveVoiceGuide, type VoiceGuide } from "@/lib/voiceGuides";

interface Row { section_key: string; module_key: string; section_title: string; script: string }

const MODULE_LABELS: Record<string, string> = { administration: "Administration", anomalies: "Centre des anomalies" };

function wavDuration(buf: ArrayBuffer): number {
  try {
    const v = new DataView(buf);
    const byteRate = v.getUint32(28, true);
    return byteRate ? (buf.byteLength - 44) / byteRate : 1;
  } catch { return 1; }
}

export function VoiceScriptsSettings() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [guides, setGuides] = useState<VoiceGuide[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<{ key: string; audio: HTMLAudioElement } | null>(null);

  const load = async () => {
    const [{ data }, g] = await Promise.all([
      supabase.from("voice_guide_texts" as never).select("*").order("section_key"),
      loadVoiceGuides().catch(() => []),
    ]);
    const list = (data ?? []) as Row[];
    const known = new Set(list.map((r) => r.section_key));
    g.forEach((guide) => {
      if (!known.has(guide.section_key)) list.push({ section_key: guide.section_key, module_key: guide.section_key.split(":")[0], section_title: guide.section_title, script: "" });
    });
    setRows(list);
    setGuides(g);
    setDrafts(Object.fromEntries(list.map((r) => [r.section_key, r.script])));
  };
  useEffect(() => { load(); }, []);

  const guideMap = useMemo(() => new Map(guides.map((g) => [g.section_key, g])), [guides]);
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const m = new Map<string, Row[]>();
    rows.filter((r) => !q || r.section_title.toLowerCase().includes(q) || r.module_key.toLowerCase().includes(q))
      .forEach((r) => m.set(r.module_key, [...(m.get(r.module_key) ?? []), r]));
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows, query]);

  const saveText = async (r: Row) => {
    const { error } = await supabase.from("voice_guide_texts" as never)
      .upsert({ section_key: r.section_key, module_key: r.module_key, section_title: r.section_title, script: drafts[r.section_key] ?? "" } as never);
    if (error) { toast.error("Enregistrement du texte impossible"); return false; }
    return true;
  };

  const generate = async (r: Row) => {
    const text = (drafts[r.section_key] ?? "").trim();
    if (!text) { toast.error("Écrivez d'abord l'explication."); return; }
    if (!user) return;
    setBusy(r.section_key);
    try {
      if (!(await saveText(r))) return;
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-tts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${s.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Erreur"); }
      const buf = await res.arrayBuffer();
      const saved = await saveVoiceGuide({
        sectionKey: r.section_key, sectionTitle: r.section_title,
        blob: new Blob([buf], { type: "audio/wav" }), durationSeconds: wavDuration(buf),
        userId: user.id, previousPath: guideMap.get(r.section_key)?.audio_path,
      });
      setGuides((c) => [...c.filter((g) => g.section_key !== saved.section_key), saved]);
      toast.success("Vocal créé pour « " + r.section_title + " »");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Création du vocal impossible");
    } finally { setBusy(null); }
  };

  const play = async (key: string) => {
    if (playing) { playing.audio.pause(); if (playing.key === key) { setPlaying(null); return; } }
    const g = guideMap.get(key); if (!g) return;
    const audio = new Audio(await getVoiceGuideUrl(g.audio_path));
    audio.onended = () => setPlaying(null);
    audio.play(); setPlaying({ key, audio });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Mic className="h-4 w-4 text-primary" /> Textes des explications vocales</CardTitle>
        <p className="text-xs text-muted-foreground">Écrivez l'explication de chaque rubrique puis appuyez sur « Créer le vocal » (voix d'homme, darija). Les rubriques apparaissent ici dès que vous ouvrez leur page.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Rechercher une rubrique" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {grouped.length === 0 && <p className="text-sm text-muted-foreground">Aucune rubrique encore. Ouvrez les différentes pages de l'application pour les faire apparaître.</p>}
        {grouped.map(([mod, list]) => (
          <div key={mod} className="border rounded-lg">
            <button type="button" className="w-full flex items-center justify-between px-3 py-2 font-semibold text-sm" onClick={() => setOpen((o) => ({ ...o, [mod]: !o[mod] }))}>
              <span className="flex items-center gap-2">{open[mod] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{MODULE_LABELS[mod] ?? mod}</span>
              <span className="text-xs text-muted-foreground">{list.filter((r) => guideMap.has(r.section_key)).length}/{list.length} vocaux</span>
            </button>
            {open[mod] && (
              <div className="space-y-3 p-3 pt-0">
                {list.map((r) => (
                  <div key={r.section_key} className="space-y-2 border-t pt-3">
                    <div className="text-sm font-medium">{r.section_title}</div>
                    <Textarea rows={3} placeholder="Votre explication pour cette rubrique…" value={drafts[r.section_key] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.section_key]: e.target.value }))} />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={async () => { if (await saveText(r)) toast.success("Texte enregistré"); }}><Save className="h-4 w-4" /> Enregistrer le texte</Button>
                      <Button size="sm" disabled={busy !== null} onClick={() => generate(r)}>
                        {busy === r.section_key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                        {guideMap.has(r.section_key) ? "Recréer le vocal" : "Créer le vocal"}
                      </Button>
                      {guideMap.has(r.section_key) && (
                        <Button size="sm" variant="ghost" onClick={() => play(r.section_key)}>
                          {playing?.key === r.section_key ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} Écouter
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
