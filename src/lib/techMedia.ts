import { supabase } from "@/integrations/supabase/client";

export const VIDEO_PREFIX = "storage:tech-videos/";
export const MAX_TECH_VIDEO_BYTES = 50 * 1024 * 1024;

export function isTechVideo(value: string): boolean {
  return value.startsWith(VIDEO_PREFIX) || value.startsWith("data:video");
}

export async function uploadTechVideo(file: File): Promise<string> {
  if (file.size > MAX_TECH_VIDEO_BYTES) throw new Error("Vidéo trop lourde : maximum 50 Mo.");
  if (!file.type.startsWith("video/")) throw new Error("Choisissez un fichier vidéo.");
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("tech-videos").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return VIDEO_PREFIX + path;
}

/** Legacy videos must never be written back into a database record. */
export async function storeTechMedia(values: string[]): Promise<string[]> {
  const result: string[] = [];
  for (const value of values) {
    if (!value.startsWith("data:video")) {
      result.push(value);
      continue;
    }
    const blob = await (await fetch(value)).blob();
    const extension = blob.type.split("/")[1]?.split(";")[0] || "mp4";
    result.push(await uploadTechVideo(new File([blob], `video.${extension}`, { type: blob.type })));
  }
  return result;
}