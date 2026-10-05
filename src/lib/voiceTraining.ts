import { supabase } from "@/integrations/supabase/client";
import { VOICE_GUIDES_BUCKET } from "@/lib/voiceGuides";

export interface TrainingStep {
  id: string;
  module_key: string;
  position: number;
  text: string;
  target_label: string;
  audio_path: string | null;
}

const table = () => supabase.from("voice_training_steps" as never);

export async function loadTrainingSteps(moduleKey?: string): Promise<TrainingStep[]> {
  let q = table().select("*").order("position");
  if (moduleKey) q = q.eq("module_key" as never, moduleKey as never);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TrainingStep[];
}

export async function upsertTrainingStep(step: Partial<TrainingStep> & { module_key: string }): Promise<TrainingStep> {
  const { data, error } = await table().upsert(step as never).select("*").single();
  if (error) throw error;
  return data as TrainingStep;
}

export async function deleteTrainingStep(step: TrainingStep) {
  const { error } = await table().delete().eq("id" as never, step.id as never);
  if (error) throw error;
  if (step.audio_path) await supabase.storage.from(VOICE_GUIDES_BUCKET).remove([step.audio_path]);
}

/** Generates the darija male voice for a step (same voice as the other guides) and stores it. */
export async function generateStepAudio(step: TrainingStep): Promise<TrainingStep> {
  const call = (token: string) => fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-tts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text: step.text }),
  });
  const { data: s } = await supabase.auth.getSession();
  let res = s.session?.access_token ? await call(s.session.access_token) : null;
  if (!res || res.status === 401) {
    const { data: r } = await supabase.auth.refreshSession();
    if (!r.session?.access_token) throw new Error("Session expirée. Reconnectez-vous.");
    res = await call(r.session.access_token);
  }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Erreur"); }
  const blob = new Blob([await res.arrayBuffer()], { type: "audio/wav" });
  const path = `training/${step.module_key}/${step.id}-${Date.now()}.wav`;
  const { error: upErr } = await supabase.storage.from(VOICE_GUIDES_BUCKET).upload(path, blob, { contentType: "audio/wav" });
  if (upErr) throw upErr;
  const previous = step.audio_path;
  const saved = await upsertTrainingStep({ ...step, audio_path: path });
  if (previous) await supabase.storage.from(VOICE_GUIDES_BUCKET).remove([previous]);
  return saved;
}

const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Finds the smallest visible element in the page whose text matches the label. */
export function findTargetElement(label: string): HTMLElement | null {
  const wanted = norm(label);
  if (!wanted) return null;
  const scope = document.querySelector("[data-voice-guide-scope]") ?? document.body;
  const candidates = Array.from(scope.querySelectorAll<HTMLElement>("button, a, th, h1, h2, h3, h4, label, [role=tab], span, p, div, td"))
    .filter((el) => el.offsetParent !== null && !el.closest("[data-training-overlay]"));
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of candidates) {
    const t = norm(el.innerText || "");
    if (!t || !t.includes(wanted)) continue;
    const score = (t === wanted ? 0 : 1000) + t.length;
    if (score < bestScore) { best = el; bestScore = score; }
  }
  // Prefer a clickable/card ancestor when the match is a tiny inner text node.
  return best?.closest<HTMLElement>("button, a, th, [role=tab]") ?? best;
}
