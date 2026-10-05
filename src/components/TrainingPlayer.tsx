import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GraduationCap, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getVoiceGuideUrl } from "@/lib/voiceGuides";
import { findTargetElement, loadTrainingSteps, type TrainingStep } from "@/lib/voiceTraining";

interface Rect { top: number; left: number; width: number; height: number }

export function TrainingPlayer({ moduleKey }: { moduleKey: string }) {
  const { isAdmin, can } = useAuth();
  const [steps, setSteps] = useState<TrainingStep[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const allowed = isAdmin || can("listen_voice_guides");

  useEffect(() => {
    if (!allowed) return;
    loadTrainingSteps(moduleKey).then((l) => setSteps(l.filter((s) => s.audio_path))).catch(() => setSteps([]));
  }, [moduleKey, allowed]);

  const stop = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    setIndex(null);
    setRect(null);
  }, []);

  const next = useCallback(() => setIndex((i) => (i === null ? null : i + 1 < steps.length ? i + 1 : null)), [steps.length]);

  const step = index !== null ? steps[index] : undefined;

  // Play the voice of the current step; when it ends, the card moves to the next step automatically.
  useEffect(() => {
    if (!step?.audio_path) return;
    let cancelled = false;
    audio.current?.pause();
    void getVoiceGuideUrl(step.audio_path).then((url) => {
      if (cancelled) return;
      const a = new Audio(url);
      audio.current = a;
      a.onended = () => window.setTimeout(next, 500);
      void a.play().catch(() => undefined);
    });
    return () => { cancelled = true; audio.current?.pause(); };
  }, [step, next]);

  // Keep the highlight on the real element of the page.
  useLayoutEffect(() => {
    if (!step) return;
    const el = findTargetElement(step.target_label);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => {
      const r = el?.getBoundingClientRect();
      setRect(r ? { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 } : null);
    };
    update();
    const id = window.setInterval(update, 150);
    return () => window.clearInterval(id);
  }, [step]);

  useEffect(() => () => { audio.current?.pause(); }, []);

  if (!allowed || !steps.length) return null;

  if (index === null) {
    return createPortal(
      <Button data-training-overlay className="fixed bottom-4 right-4 z-40 rounded-full shadow-lg" onClick={() => setIndex(0)}>
        <GraduationCap className="h-4 w-4" /> Formation
      </Button>,
      document.body,
    );
  }

  const cardBelow = rect ? rect.top + rect.height + 180 < window.innerHeight : true;
  const cardTop = rect ? (cardBelow ? rect.top + rect.height + 12 : Math.max(12, rect.top - 172)) : undefined;

  return createPortal(
    <div data-training-overlay className="fixed inset-0 z-50 pointer-events-none">
      {rect ? (
        <div
          className="absolute rounded-lg ring-4 ring-primary transition-all duration-500 ease-out"
          style={{ ...rect, boxShadow: "0 0 0 9999px hsl(var(--foreground) / 0.45)" }}
        />
      ) : <div className="absolute inset-0 bg-foreground/45" />}
      <div
        key={index}
        className="pointer-events-auto absolute left-1/2 w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl border bg-card p-4 text-card-foreground shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={cardTop !== undefined ? { top: cardTop } : { bottom: 24 }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <GraduationCap className="h-4 w-4" /> Étape {index + 1}/{steps.length}
          </span>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Fermer la formation" onClick={stop}><X className="h-4 w-4" /></Button>
        </div>
        {step?.target_label && <p className="font-semibold">{step.target_label}</p>}
        <p className="text-sm text-muted-foreground" dir="auto">{step?.text}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((s, i) => <span key={s.id} className={`h-1.5 w-5 rounded-full ${i <= index ? "bg-primary" : "bg-muted"}`} />)}
          </div>
          <Button size="sm" variant="outline" onClick={index + 1 < steps.length ? next : stop}>
            {index + 1 < steps.length ? <><SkipForward className="h-4 w-4" /> Suivant</> : "Terminer"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
