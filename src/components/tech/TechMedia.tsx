import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VIDEO_PREFIX } from "@/lib/techMedia";
export { VIDEO_PREFIX, isTechVideo, uploadTechVideo } from "@/lib/techMedia";

export function useTechMediaUrl(u: string | null) {
  const [url, setUrl] = useState<string | null>(u && !u.startsWith(VIDEO_PREFIX) ? u : null);
  useEffect(() => {
    if (!u) return setUrl(null);
    if (!u.startsWith(VIDEO_PREFIX)) return setUrl(u);
    const path = u.slice(VIDEO_PREFIX.length);
    setUrl(null);
    let alive = true;
    void supabase.storage.from("tech-videos").createSignedUrl(path, 3600).then(({ data }) => {
      if (!alive) return;
      setUrl(data?.signedUrl ?? `/stockage/tech-videos/${path}`);
    }).catch(() => {
      if (alive) setUrl(`/stockage/tech-videos/${path}`);
    });
    return () => { alive = false; };
  }, [u]);
  return url;
}

export function TechVideo({ src, className, controls }: { src: string; className?: string; controls?: boolean }) {
  const url = useTechMediaUrl(src);
  if (!url) return <div className={className + " bg-muted"} />;
  return <video src={url} className={className} muted={!controls} controls={controls} autoPlay={controls} playsInline preload={controls ? "metadata" : "none"} onError={() => {
    if (src.startsWith(VIDEO_PREFIX) && !url.startsWith("/stockage/")) setFallback();
  }} />;

  function setFallback() {
    // The static server copy remains available when signed playback fails.
    const element = document.querySelector<HTMLVideoElement>(`video[src="${CSS.escape(url ?? "")}"]`);
    if (element) element.src = `/stockage/tech-videos/${src.slice(VIDEO_PREFIX.length)}`;
  }
}
