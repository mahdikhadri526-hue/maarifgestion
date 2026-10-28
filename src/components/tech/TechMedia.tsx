import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const VIDEO_PREFIX = "storage:tech-videos/";

export function isTechVideo(u: string) {
  return u.startsWith(VIDEO_PREFIX) || u.startsWith("data:video");
}

/** Envoie la vidéo directement au stockage (pas dans la base) : envoi rapide. */
export async function uploadTechVideo(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("tech-videos").upload(path, file, { contentType: file.type || "video/mp4" });
  if (error) throw error;
  return VIDEO_PREFIX + path;
}

export function useTechMediaUrl(u: string | null) {
  const [url, setUrl] = useState<string | null>(u && !u.startsWith(VIDEO_PREFIX) ? u : null);
  useEffect(() => {
    if (!u) return setUrl(null);
    if (!u.startsWith(VIDEO_PREFIX)) return setUrl(u);
    const path = u.slice(VIDEO_PREFIX.length);
    let alive = true;
    void supabase.storage.from("tech-videos").createSignedUrl(path, 3600).then(({ data }) => {
      if (!alive) return;
      setUrl(data?.signedUrl ?? `/stockage/tech-videos/${path}`);
    });
    return () => { alive = false; };
  }, [u]);
  return url;
}

export function TechVideo({ src, className, controls }: { src: string; className?: string; controls?: boolean }) {
  const url = useTechMediaUrl(src);
  if (!url) return <div className={className + " bg-muted"} />;
  return <video src={url} className={className} muted={!controls} controls={controls} autoPlay={controls} playsInline preload="metadata" />;
}
