import { supabase } from "@/integrations/supabase/client";

export const VIDEO_PREFIX = "storage:tech-videos/";
export const MAX_TECH_VIDEO_BYTES = 50 * 1024 * 1024;

export function isTechVideo(value: string): boolean {
  return value.startsWith(VIDEO_PREFIX) || value.startsWith("data:video");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function uploadTechVideo(file: File): Promise<string> {
  if (file.size > MAX_TECH_VIDEO_BYTES) throw new Error("Vidéo trop lourde : maximum 50 Mo.");
  if (!file.type.startsWith("video/")) throw new Error("Choisissez un fichier vidéo.");
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { error } = await supabase.storage.from("tech-videos").upload(path, file, { contentType: file.type });
      if (!error) return VIDEO_PREFIX + path;
      lastError = error;
      // Server-side errors (rights, quota) are not worth retrying.
      if (error.message && !/fetch|network|timeout|failed/i.test(error.message)) throw error;
    } catch (e) {
      lastError = e;
      if (e instanceof Error && e.message && !/fetch|network|timeout|failed/i.test(e.message)) throw e;
    }
    if (attempt < 2) await sleep(1000 * (attempt + 1));
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError ?? "");
  throw new Error(`Envoi de la vidéo impossible (connexion interrompue). Vérifiez votre connexion et réessayez. ${msg}`.trim());
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