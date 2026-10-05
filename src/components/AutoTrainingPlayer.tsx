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
    const sentences = script.split(/(?<=[.!?؟،,;:])\s+|\n+/).map((x) => x.trim()).filter((x) => x.length > 1);
    out.push({ guide, heading: h, sentences: sentences.length ? sentences : [guide.section_title] });
  });
  return out;
}

const words = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f\u064B-\u065F]/g, "").toLowerCase()
  .split(/[^a-z0-9\u0600-\u06FF]+/).filter((w) => w.length >= 3);

/** Whole block of the section: climbs until the next parent would contain another section heading. */
let sectionHeadings: HTMLElement[] = [];

function sectionBox(heading: HTMLElement): HTMLElement {
  let box: HTMLElement = heading;
  while (box.parentElement && !box.parentElement.matches("[data-voice-guide-scope]")) {
    const p = box.parentElement;
    // Only other trained sections bound the block; inner tables/sub-titles belong to this section.
    if (sectionHeadings.some((h) => h !== heading && p.contains(h))) break;
    box = p;
  }
  return box;
}

const SELECTOR = "button, a, th, label, input, select, textarea, [role=tab], [role=combobox], [role=switch], h3, h4";

function details(heading: HTMLElement): HTMLElement[] {
  return Array.from(sectionBox(heading).querySelectorAll<HTMLElement>(SELECTOR)).filter((el) => {
    if (el === heading || el.offsetParent === null || el.closest("[data-voice-guide-control], [data-training-overlay]")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  });
}

const labelOf = (el: HTMLElement) =>
  el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || (el as HTMLInputElement).labels?.[0]?.innerText || "";

/** Element named by the sentence; otherwise walks the section details one by one so the arrow never stays on the title. */
const OPENER = /^(consulter|afficher|voir|details?|voir plus|developper)$/;

/** Temporarily opens collapsed content of the section (e.g. « Consulter ») so the arrow can show the details. */
function openSection(heading: HTMLElement): HTMLElement | null {
  const btn = Array.from(sectionBox(heading).querySelectorAll<HTMLElement>("button"))
    .find((b) => b.offsetParent !== null && OPENER.test(norm(b.innerText).trim()));
  if (!btn) return null;
  btn.click();
  return btn;
}

function findMentioned(heading: HTMLElement, sentence: string, index: number, used: Set<HTMLElement>): HTMLElement {
  const els = details(heading);
  if (!els.length) return heading;
  const said = new Set(words(sentence));
  const saidNorm = norm(sentence);
  let best: HTMLElement | null = null;
  let bestScore = 0;
  for (const el of els) {
    const raw = labelOf(el);
    if (raw.length > 60) continue;
    const lw = words(raw);
    if (!lw.length) continue;
    let score = lw.filter((w) => said.has(w) || [...said].some((s) => s.length >= 4 && (s.startsWith(w) || w.startsWith(s)))).length / lw.length;
    if (saidNorm.includes(norm(raw))) score += 1;
    if (used.has(el)) score -= 0.3;
    if (score > bestScore) { bestScore = score; best = el; }
  }
  if (best && bestScore >= 0.5) return best;
  const fresh = els.filter((e) => !used.has(e));
  const pool = fresh.length ? fresh : els;
  return pool[Math.min(index, pool.length - 1) % pool.length];
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
  const used = useRef<Set<HTMLElement>>(new Set());
  const opened = useRef<HTMLElement | null>(null);
  const closeOpened = () => { const b = opened.current; opened.current = null; if (b?.isConnected) b.click(); };

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
    closeOpened();
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
    used.current = new Set();
    closeOpened();
    opened.current = openSection(current.heading);
    if (opened.current) used.current.add(opened.current);
    // Spoken-time estimate: word count + a pause after each fragment (bigger after a full stop).
    const weights = current.sentences.map((s) => s.split(/\s+/).filter(Boolean).length + (/[.!?؟]$/.test(s) ? 1.6 : 0.8));
    const total = weights.reduce((a, b) => a + b, 0);
    // Safety net: never stay stuck on a section if the audio stalls or cannot play.
    const est = Math.max(6, (current.guide.duration_seconds || total / 14) + 4) * 1000;
    let guard = window.setTimeout(() => !cancelled && nextSection(), est);
    void getVoiceGuideUrl(current.guide.audio_path).then((url) => {
      if (cancelled) return;
      const a = new Audio(url);
      audio.current = a;
      a.ontimeupdate = () => {
        const d = a.duration || current.guide.duration_seconds || 1;
        const target = Math.min(total, ((a.currentTime + 0.25) / d) * total);
        let acc = 0; let idx = 0;
        for (; idx < weights.length - 1; idx++) { acc += weights[idx]; if (acc > target) break; }
        setSentence(idx);
      };
      a.onloadedmetadata = () => {
        window.clearTimeout(guard);
        guard = window.setTimeout(() => !cancelled && nextSection(), ((a.duration || 0) + 4) * 1000);
      };
      a.onended = () => { window.clearTimeout(guard); window.setTimeout(nextSection, 600); };
      a.onerror = () => { window.clearTimeout(guard); nextSection(); };
      void a.play().catch(() => {
        // Autoplay blocked: advance sentence by sentence at reading pace instead of freezing.
        let i = 0;
        const step = () => { if (cancelled) return; i++; if (i < weights.length) { setSentence(i); window.setTimeout(step, 3500); } };
        window.setTimeout(step, 3500);
      });
    }).catch(() => nextSection());
    return () => { cancelled = true; window.clearTimeout(guard); audio.current?.pause(); };
  }, [current, nextSection]);

  // Arrow follows the element mentioned by the current sentence.
  useEffect(() => {
    if (!current) return;
    let el: HTMLElement = current.heading;
    const pick = () => {
      el = findMentioned(current.heading, current.sentences[sentence] ?? "", sentence, used.current);
      used.current.add(el);
      el.scrollIntoView({ block: "center", behavior: "auto" });
    };
    // Wait for opened details to render before pointing.
    const t = window.setTimeout(pick, opened.current && sentence === 0 ? 500 : 0);
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
    };
    update();
    const id = window.setInterval(update, 150);
    return () => { window.clearTimeout(t); window.clearInterval(id); };
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
          sectionHeadings = list.map((x) => x.heading);
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
          <div className="absolute rounded-lg ring-4 ring-primary transition-all duration-200 ease-out"
            style={{ ...rect, boxShadow: "0 0 0 9999px hsl(var(--foreground) / 0.4)" }} />
          <div className="absolute transition-all duration-200 ease-out text-primary"
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
