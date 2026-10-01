import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CircleStop, Mic, Pause, Play, RotateCcw, Trash2, Volume2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { deleteVoiceGuide, getVoiceGuideUrl, loadVoiceGuides, saveVoiceGuide, type VoiceGuide } from "@/lib/voiceGuides";

import { supabase } from "@/integrations/supabase/client";

const registered = new Set<string>();

interface SectionRef { key: string; title: string }
interface Mount { root: Root; host: HTMLElement }

const normalizeTitle = (value: string) => value
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, "date")
  .replace(/\d+/g, "n")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 80) || "rubrique";

function VoiceButton({ hasAudio, isAdmin, playing, onClick }: {
  hasAudio: boolean; isAdmin: boolean; playing: boolean; onClick: () => void;
}) {
  if (!hasAudio && !isAdmin) return null;
  const label = hasAudio ? (playing ? "Mettre l'explication en pause" : "Écouter l'explication") : "Enregistrer une explication";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="ml-2 h-8 w-8 shrink-0 rounded-full text-primary"
      aria-label={label}
      title={label}
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); onClick(); }}
    >
      {playing ? <Pause /> : hasAudio ? <Volume2 /> : <Mic />}
    </Button>
  );
}

export function VoiceGuideManager({ moduleKey }: { moduleKey: string }) {
  const { isAdmin, user } = useAuth();
  const [guides, setGuides] = useState<VoiceGuide[]>([]);
  const [selected, setSelected] = useState<SectionRef | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const mounts = useRef<Map<HTMLElement, Mount>>(new Map());
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);

  const guideMap = useMemo(() => new Map(guides.map((guide) => [guide.section_key, guide])), [guides]);
  const selectedGuide = selected ? guideMap.get(selected.key) : undefined;

  const refresh = useCallback(async () => {
    try { setGuides(await loadVoiceGuides()); }
    catch { toast.error("Impossible de charger les explications vocales."); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const stopPlayback = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    setPlayingKey(null);
  }, []);

  const playGuide = useCallback(async (guide: VoiceGuide) => {
    if (playingKey === guide.section_key) { stopPlayback(); return; }
    stopPlayback();
    try {
      const url = await getVoiceGuideUrl(guide.audio_path);
      const next = new Audio(url);
      audio.current = next;
      setPlayingKey(guide.section_key);
      next.onended = stopPlayback;
      next.onerror = () => { stopPlayback(); toast.error("Impossible de lire cette explication."); };
      await next.play();
    } catch { stopPlayback(); toast.error("Impossible de lire cette explication."); }
  }, [playingKey, stopPlayback]);

  const handleSection = useCallback((section: SectionRef) => {
    const guide = guideMap.get(section.key);
    if (isAdmin) setSelected(section);
    else if (guide) void playGuide(guide);
  }, [guideMap, isAdmin, playGuide]);

  useEffect(() => {
    const container = document.querySelector("[data-voice-guide-scope]");
    if (!container) return;
    let scheduled = false;
    const sync = () => {
      scheduled = false;
      const headings = Array.from(container.querySelectorAll<HTMLElement>("h2, h3"))
        .filter((heading) => !heading.closest("[data-voice-guide-ignore]") && heading.offsetParent !== null);
      const occurrence = new Map<string, number>();
      const current = new Set(headings);
      headings.forEach((heading) => {
        const clone = heading.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("[data-voice-guide-control]").forEach((node) => node.remove());
        const title = (clone.textContent ?? "").trim().replace(/\s+/g, " ");
        if (!title) return;
        const slug = normalizeTitle(title);
        const number = (occurrence.get(slug) ?? 0) + 1;
        occurrence.set(slug, number);
        const key = `${moduleKey}:${slug}:${number}`;
        if (isAdmin && !registered.has(key)) {
          registered.add(key);
          void supabase.from("voice_guide_texts" as never)
            .upsert({ section_key: key, module_key: moduleKey, section_title: title } as never, { onConflict: "section_key", ignoreDuplicates: true }).then(({ error }) => { if (error) registered.delete(key); });
        }
        let mount = mounts.current.get(heading);
        if (!mount) {
          const host = document.createElement("span");
          host.dataset.voiceGuideControl = "true";
          host.className = "inline-flex align-middle";
          heading.appendChild(host);
          mount = { host, root: createRoot(host) };
          mounts.current.set(heading, mount);
        }
        mount.root.render(<VoiceButton hasAudio={guideMap.has(key)} isAdmin={isAdmin} playing={playingKey === key} onClick={() => handleSection({ key, title })} />);
      });
      mounts.current.forEach((mount, heading) => {
        if (!current.has(heading) || !heading.isConnected) {
          queueMicrotask(() => mount.root.unmount());
          mount.host.remove();
          mounts.current.delete(heading);
        }
      });
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(sync);
    };
    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      mounts.current.forEach((mount) => mount.root.unmount());
      mounts.current.clear();
    };
  }, [guideMap, handleSection, isAdmin, moduleKey, playingKey]);

  useEffect(() => () => {
    stopPlayback();
    stream.current?.getTracks().forEach((track) => track.stop());
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
  }, [recordedUrl, stopPlayback]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))), 500);
    return () => window.clearInterval(timer);
  }, [recording]);

  const resetRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setSeconds(0);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("L’enregistrement audio n’est pas disponible sur cet appareil.");
      return;
    }
    try {
      resetRecording();
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mediaStream;
      const preferred = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const mediaRecorder = preferred ? new MediaRecorder(mediaStream, { mimeType: preferred }) : new MediaRecorder(mediaStream);
      recorder.current = mediaRecorder;
      chunks.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
      };
      startedAt.current = Date.now();
      setSeconds(0);
      mediaRecorder.start();
      setRecording(true);
    } catch { toast.error("Autorisez le microphone pour enregistrer votre explication."); }
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(false);
  };

  const closeDialog = () => {
    if (recording) stopRecording();
    resetRecording();
    setSelected(null);
  };

  const save = async () => {
    if (!selected || !recordedBlob || !user) return;
    setSaving(true);
    try {
      const saved = await saveVoiceGuide({
        sectionKey: selected.key,
        sectionTitle: selected.title,
        blob: recordedBlob,
        durationSeconds: seconds,
        userId: user.id,
        previousPath: selectedGuide?.audio_path,
      });
      setGuides((current) => [...current.filter((guide) => guide.section_key !== saved.section_key), saved]);
      toast.success("Explication vocale enregistrée.");
      closeDialog();
    } catch { toast.error("L’explication n’a pas pu être enregistrée."); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!selectedGuide) return;
    setSaving(true);
    try {
      await deleteVoiceGuide(selectedGuide);
      setGuides((current) => current.filter((guide) => guide.id !== selectedGuide.id));
      toast.success("Explication vocale supprimée.");
      closeDialog();
    } catch { toast.error("L’explication n’a pas pu être supprimée."); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) closeDialog(); }}>
      <DialogContent data-voice-guide-ignore className="w-[calc(100%-2rem)] max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle>Explication vocale</DialogTitle>
          <DialogDescription>{selected?.title}</DialogDescription>
        </DialogHeader>

        {selectedGuide && !recordedUrl && !recording && (
          <Button variant="outline" onClick={() => void playGuide(selectedGuide)}>
            {playingKey === selectedGuide.section_key ? <Pause /> : <Play />}
            {playingKey === selectedGuide.section_key ? "Mettre en pause" : "Écouter l’explication actuelle"}
          </Button>
        )}

        <div className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-md border bg-muted/40 p-4">
          {recording ? (
            <>
              <span className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
              <p className="font-medium">Enregistrement en cours · {seconds} s</p>
              <Button variant="destructive" onClick={stopRecording}><CircleStop />Arrêter</Button>
            </>
          ) : recordedUrl ? (
            <>
              <audio className="w-full" controls src={recordedUrl} />
              <Button variant="outline" onClick={() => void startRecording()}><RotateCcw />Recommencer</Button>
            </>
          ) : (
            <Button onClick={() => void startRecording()}><Mic />{selectedGuide ? "Remplacer l’explication" : "Commencer l’enregistrement"}</Button>
          )}
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          {selectedGuide && !recording && (
            <Button variant="destructive" disabled={saving} onClick={() => void remove()}><Trash2 />Supprimer</Button>
          )}
          <Button variant="outline" disabled={saving} onClick={closeDialog}>Annuler</Button>
          {recordedBlob && <Button disabled={saving || recording} onClick={() => void save()}>{saving ? "Enregistrement…" : "Sauvegarder"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
