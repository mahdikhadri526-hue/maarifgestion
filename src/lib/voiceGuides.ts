import { supabase } from "@/integrations/supabase/client";

export const VOICE_GUIDES_BUCKET = "voice-guides";

export interface VoiceGuide {
  id: string;
  section_key: string;
  section_title: string;
  audio_path: string;
  mime_type: string;
  duration_seconds: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function loadVoiceGuides(): Promise<VoiceGuide[]> {
  const { data, error } = await supabase
    .from("voice_guides" as never)
    .select("*")
    .order("section_key");
  if (error) throw error;
  return (data ?? []) as VoiceGuide[];
}

export async function getVoiceGuideUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(VOICE_GUIDES_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw error ?? new Error("Audio indisponible");
  return data.signedUrl;
}

export async function saveVoiceGuide(input: {
  sectionKey: string;
  sectionTitle: string;
  blob: Blob;
  durationSeconds: number;
  userId: string;
  previousPath?: string;
}): Promise<VoiceGuide> {
  const extension = input.blob.type.includes("wav") ? "wav" : input.blob.type.includes("mp4") ? "m4a" : input.blob.type.includes("ogg") ? "ogg" : "webm";
  const safeKey = input.sectionKey.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 120);
  const audioPath = `${safeKey}/${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(VOICE_GUIDES_BUCKET)
    .upload(audioPath, input.blob, { contentType: input.blob.type || "audio/webm", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("voice_guides" as never)
    .upsert({
      section_key: input.sectionKey,
      section_title: input.sectionTitle,
      audio_path: audioPath,
      mime_type: input.blob.type || "audio/webm",
      duration_seconds: Math.max(1, Math.round(input.durationSeconds)),
      created_by: input.userId,
    } as never, { onConflict: "section_key" })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(VOICE_GUIDES_BUCKET).remove([audioPath]);
    throw error;
  }
  if (input.previousPath && input.previousPath !== audioPath) {
    await supabase.storage.from(VOICE_GUIDES_BUCKET).remove([input.previousPath]);
  }
  return data as VoiceGuide;
}

export async function deleteVoiceGuide(guide: VoiceGuide): Promise<void> {
  const { error } = await supabase.from("voice_guides" as never).delete().eq("id", guide.id);
  if (error) throw error;
  await supabase.storage.from(VOICE_GUIDES_BUCKET).remove([guide.audio_path]);
}
