import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, GraduationCap, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getVoiceGuideUrl, loadVoiceGuides, type VoiceGuide } from "@/lib/voiceGuides";

/** Read-only guided training built from the existing voice explanations: it never changes them. */

const slug = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, "date").replace(/\d+/g, "n")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "rubrique";
const norm = (v: string) => ` ${v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

interface Section { guide: VoiceGuide; heading: HTMLElement; sentences: string[] }
interface Rect { top: number; left: number; width: number; height: number }

const headingTitle = (h: HTMLElement) => {
  const c = h.cloneNode(true) as HTMLElement;
  c.querySelectorAll("[data-voice-guide-control]").forEach((n) => n.remove());
  return (c.textContent ?? "").trim().replace(/\s+/g, " ");
};

function collectSections(moduleKey: string, guides: Map<string, VoiceGuide>, scripts: Map<string, string>): Section[] {
  const scope = document.querySelector("[data-voice-guide-scope]");
  if (!scope) return [];
  const occ = new Map<string, number>();
  const out: Section[] = [];
  scope.querySelectorAll<HTMLElement>("h2, h3").forEach((h) => {
    if (h.closest("[data-voice-guide-ignore]") || h.offsetParent === null) return;
    const title = headingTitle(h);
    if (!title) return;
    const s = slug(title);
    const n = (occ.get(s) ?? 0) + 1;
    occ.set(s, n);
    const key = `${moduleKey}:${s}:${n}`;
    const guide = guides.get(key);
    if (!guide) return;
    const script = scripts.get(key) ?? "";
    const sentences = script.split(/(?<=[.!?؟])\s+|\n+/).map((x) => x.trim()).filter((x) => x.length > 1);
    out.push({ guide, heading: h, sentences: sentences.length ? sentences : [guide.section_title] });
  });
  return out;
}

/** Finds, inside the section, the visible element whose label is mentioned in the sentence. */
function findMentioned(heading: HTMLElement, sentence: string): HTMLElement {
  let box: HTMLElement = heading;
  for (let i = 0; i < 4 && box.parentElement; i++) {
    box = box.parentElement;
    if (box.matches("[data-voice-guide-scope]")) break;
    if (box.getBoundingClientRect().height > heading.getBoundingClientRect().height * 3) break;
  }
  const said = norm(sentence);
  let best: HTMLElement | null = null;
  let bestLen = 0;
  box.querySelectorAll<HTMLElement>("button, a, th, label, [role=tab], h3, h4, [role=combobox]").forEach((el) => {
    if (el.offsetParent === null || el.closest("[data-voice-guide-control], [data-training-overlay]")) return;
    const label = norm(el.innerText || el.getAttribute("aria-label") || "").trim();
    if (label.length < 4 || label.length > 40) return;
    if (said.includes(` ${label} `) && label.length > bestLen) { best = el; bestLen = label.length; }
  });
  return best ?? heading;
}

export function AutoTrainingPlayer({ moduleKey }: { moduleKey: string }) {
  const { isAdmin, can } = useAuth();
  const allowed = isAdmin || can("listen_voice_guides");
  const [guides, setGuides] = useState<Map<string, VoiceGuide>>(new Map());
  const [scripts, setScripts] = useState<Map<string, string>>(new Map());
  const [sections, setSections] = useState<Section[] | null>(null);
  const [si, setSi] = useState(0);
  const [sentence, setSentence] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!allowed) return;
    void (async () => {
      const [all, { data }] = await Promise.all([
        loadVoiceGuides().catch(() => [] as VoiceGuide[]),
        supabase.from("voice_guide_texts" as never).select("section_key, script, active").eq("module_key" as never, moduleKey as never),
      ]);
      const rows = (data ?? []) as { section_key: string; script: string; active: boolean }[];
      const off = new Set(rows.filter((r) => !r.active).map((r) => r.section_key));
      setGuides(new Map(all.filter((g) => g.section_key.startsWith(`${moduleKey}:`) && !off.has(g.section_key)).map((g) => [g.section_key, g])));
      setScripts(new Map(rows.map((r) => [r.section_key, r.script])));
    })();
  }, [moduleKey, allowed]);

  const stop = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    setSections(null);
    setRect(null);
  }, []);

  useEffect(() => stop, [moduleKey, stop]);

  const current = sections?.[si];
  const nextSection = useCallback(() => {
    setSentence(0);
    setSi((i) => { if (sections && i + 1 < sections.length) return i + 1; window.setTimeout(stop, 0); return i; });
  }, [sections, stop]);

  // Play the existing audio; the sentence follows the voice proportionally to its length.
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    audio.current?.pause();
    const weights = current.sentences.map((s) => s.length);
    const total = weights.reduce((a, b) => a + b, 0);
    void getVoiceGuideUrl(current.guide.audio_path).then((url) => {
      if (cancelled) return;
      const a = new Audio(url);
      audio.current = a;
      a.ontimeupdate = () => {
        const d = a.duration || current.guide.duration_seconds || 1;
        const target = (a.currentTime / d) * total;
        let acc = 0; let idx = 0;
        for (; idx < weights.length - 1; idx++) { acc += weights[idx]; if (acc > target) break; }
        setSentence(idx);
      };
      a.onended = () => window.setTimeout(nextSection, 600);
      void a.play().catch(() => undefined);
    }).catch(() => nextSection());
    return () => { cancelled = true; audio.current?.pause(); };
  }, [current, nextSection]);

  // Arrow follows the element mentioned by the current sentence.
  useEffect(() => {
    if (!current) return;
    const el = findMentioned(current.heading, current.sentences[sentence] ?? "");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
    };
    update();
    const id = window.setInterval(update, 150);
    return () => window.clearInterval(id);
  }, [current, sentence]);

  if (!allowed || guides.size === 0) return null;

  if (!sections) {
    return createPortal(
      <Button
        data-training-overlay
        className="fixed bottom-4 left-4 z-40 rounded-full shadow-lg"
        onClick={() => {
          const list = collectSections(moduleKey, guides, scripts);
          if (!list.length) return;
          setSi(0); setSentence(0); setSections(list);
        }}
      >
        <GraduationCap className="h-4 w-4" /> Formation guidée
      </Button>,
      document.body,
    );
  }

  const arrowAbove = rect ? rect.top > 60 : true;
  const cardAtTop = rect ? rect.top + rect.height > window.innerHeight * 0.6 : false;

  return createPortal(
    <div data-training-overlay className="fixed inset-0 z-50 pointer-events-none">
      {rect && (
        <>
          <div className="absolute rounded-lg ring-4 ring-primary transition-all duration-500 ease-out"
            style={{ ...rect, boxShadow: "0 0 0 9999px hsl(var(--foreground) / 0.4)" }} />
          <div className="absolute transition-all duration-500 ease-out text-primary"
            style={{ left: rect.left + rect.width / 2 - 20, top: arrowAbove ? rect.top - 48 : rect.top + rect.height + 4 }}>
            <ArrowDown className={`h-10 w-10 animate-bounce drop-shadow ${arrowAbove ? "" : "rotate-180"}`} strokeWidth={3} />
          </div>
        </>
      )}
      <div
        className="pointer-events-auto absolute left-1/2 w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl border bg-card p-4 text-card-foreground shadow-xl"
        style={cardAtTop ? { top: 16 } : { bottom: 20 }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <GraduationCap className="h-4 w-4" /> Rubrique {si + 1}/{sections.length}
          </span>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Fermer la formation" onClick={stop}><X className="h-4 w-4" /></Button>
        </div>
        <p className="font-semibold">{current?.guide.section_title}</p>
        <p key={sentence} className="text-sm text-muted-foreground animate-in fade-in duration-300" dir="auto">{current?.sentences[sentence]}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {sections.map((s, i) => <span key={s.guide.id} className={`h-1.5 w-4 rounded-full ${i <= si ? "bg-primary" : "bg-muted"}`} />)}
          </div>
          <Button size="sm" variant="outline" onClick={si + 1 < sections.length ? nextSection : stop}>
            {si + 1 < sections.length ? <><SkipForward className="h-4 w-4" /> Suivant</> : "Terminer"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
