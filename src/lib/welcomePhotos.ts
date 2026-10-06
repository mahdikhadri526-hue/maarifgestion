import { supabase } from "@/integrations/supabase/client";

const BUCKET = "welcome-photos";

export interface WelcomePhoto {
  id: string;
  storage_path: string;
  position: number;
  url: string;
}

export async function loadWelcomePhotos(): Promise<WelcomePhoto[]> {
  const { data, error } = await supabase.from("welcome_photos").select("id, storage_path, position").order("position").order("created_at");
  if (error) throw error;
  const photos = data ?? [];
  return Promise.all(photos.map(async (photo) => {
    const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(photo.storage_path, 3600);
    // Self-hosted servers without storage: use the copy shipped next to the built app.
    if (signError || !signed?.signedUrl) return { ...photo, url: `/stockage/${BUCKET}/${encodeURIComponent(photo.storage_path)}` };
    return { ...photo, url: signed.signedUrl };
  }));
}

export async function addWelcomePhotos(files: File[], startPosition: number): Promise<void> {
  for (const [index, file] of files.entries()) {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      throw new Error("Choisissez des images de moins de 10 Mo chacune.");
    }
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : file.type === "image/avif" ? "avif" : "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (uploadError) throw uploadError;
    const { error } = await supabase.from("welcome_photos").insert({ storage_path: path, position: startPosition + index });
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw error;
    }
  }
}

export async function removeWelcomePhoto(photo: WelcomePhoto): Promise<void> {
  const { error } = await supabase.from("welcome_photos").delete().eq("id", photo.id);
  if (error) throw error;
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  if (storageError) throw storageError;
}

export async function swapWelcomePhotos(a: WelcomePhoto, b: WelcomePhoto): Promise<void> {
  const [{ error: first }, { error: second }] = await Promise.all([
    supabase.from("welcome_photos").update({ position: b.position }).eq("id", a.id),
    supabase.from("welcome_photos").update({ position: a.position }).eq("id", b.id),
  ]);
  if (first || second) throw first ?? second;
}