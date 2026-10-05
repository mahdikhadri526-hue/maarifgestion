import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AuthPage } from "@/components/auth/AuthPage";
import { PdvSelector } from "@/components/pdv/PdvSelector";
import { WelcomeScreen } from "@/components/auth/WelcomeScreen";
import { loadWelcomePhotos, type WelcomePhoto } from "@/lib/welcomePhotos";
import voiceOverAsset from "@/assets/oliveri-voix-mature.mp3.asset.json";
import introMusic from "@/assets/oliveri-intro-11s.mp3.asset.json";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const MUSIC_STEPS = new Set(["photos", "logo"]);

/** Smoothly moves the audio volume to `target`, then calls `onDone`. Returns a cancel fn. */
function rampVolume(music: HTMLAudioElement, target: number, ms: number, onDone?: () => void) {
  const steps = Math.max(1, Math.round(ms / 50));
  const from = music.volume;
  const delta = (target - from) / steps;
  let step = 0;
  const id = window.setInterval(() => {
    step += 1;
    if (step >= steps) {
      window.clearInterval(id);
      music.volume = Math.min(1, Math.max(0, target));
      onDone?.();
    } else {
      music.volume = Math.min(1, Math.max(0, from + delta * step));
    }
  }, 50);
  return () => window.clearInterval(id);
}

function AuthGate() {

  const { user, loading, role, pdvId, pdvLoading, multiPdvEnabled, can } = useAuth();
  const [loginPhase, setLoginPhase] = useState<"idle" | "authenticating" | "deciding" | "photos" | "logo" | "welcome">("idle");
  const [welcomePhotos, setWelcomePhotos] = useState<WelcomePhoto[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photosReady, setPhotosReady] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const cancelRampRef = useRef<(() => void) | null>(null);
  const musicActive = MUSIC_STEPS.has(loginPhase);

  const prepareMusic = () => {
    const music = musicRef.current ?? new Audio(introMusic.url);
    musicRef.current = music;
    music.loop = false;
    music.volume = 0;
    // Unlock audio on the user's sign-in gesture, but keep it silent until login succeeds.
    void music.play().then(() => {
      if (music.volume === 0) {
        music.pause();
        music.currentTime = 0;
      }
    }).catch(() => undefined);
  };


  // Permission « Voir l'écran de bienvenue » : sans elle, on saute toute la
  // séquence (photos, logo, message) et on arrive directement sur l'application.
  // On attend que le rôle/permissions soient chargés (role non null) avant de décider.
  // Après connexion réussie, on reste sur « Connexion… » jusqu'à connaître les
  // permissions : aucune image, musique ou message ne s'affiche avant la décision.
  useEffect(() => {
    if (loginPhase !== "deciding" || !user) return;
    if (role) {
      if (can("view_welcome_screen")) setLoginPhase("photos");
      else { musicRef.current?.pause(); setLoginPhase("idle"); }
      return;
    }
    const timer = window.setTimeout(() => { musicRef.current?.pause(); setLoginPhase("idle"); }, 6000);
    return () => window.clearTimeout(timer);
  }, [user, role, loginPhase, can]);

  useEffect(() => {
    if (!user || !role) return;
    if (loginPhase === "photos" || loginPhase === "logo" || loginPhase === "welcome") {
      if (!can("view_welcome_screen")) {
        musicRef.current?.pause();
        setLoginPhase("idle");
      }
    }
  }, [user, role, loginPhase, can]);

  useEffect(() => {
    if (loginPhase !== "photos") return;
    let cancelled = false;
    setPhotosReady(false);
    const deadline = new Promise<WelcomePhoto[]>((resolve) => window.setTimeout(() => resolve([]), 4000));
    void Promise.race([loadWelcomePhotos().catch(() => []), deadline]).then((photos) => {
      if (cancelled) return;
      photos.forEach((p) => { const i = new Image(); i.src = p.url; });
      setWelcomePhotos(photos);
      setPhotoIndex(0);
      if (photos.length) setPhotosReady(true);
      else setLoginPhase("logo");
    });
    return () => { cancelled = true; };
  }, [loginPhase]);

  // Music plays from the first photo through the logo/voice-over, and fades out at the
  // very beginning of the welcome message (no music on the welcome message itself).
  useEffect(() => {
    if (!musicActive) return;
    cancelRampRef.current?.();
    cancelRampRef.current = null;
    const music = musicRef.current ?? new Audio(introMusic.url);
    musicRef.current = music;
    music.loop = false;
    void music.play().catch(() => undefined);
    return () => {
      // Fade out instead of cutting the music the moment the welcome message disappears.
      cancelRampRef.current?.();
      cancelRampRef.current = rampVolume(music, 0, 700, () => {
        music.pause();
        music.currentTime = 0;
        cancelRampRef.current = null;
      });
    };
  }, [musicActive]);

  // Duck the music while the voice-over speaks, then bring it back for the welcome message.
  useEffect(() => {
    const music = musicRef.current;
    if (!music || !musicActive) return;
    cancelRampRef.current?.();
    cancelRampRef.current = rampVolume(music, loginPhase === "logo" ? 0.08 : 0.2, 500);
  }, [loginPhase, musicActive]);


  useEffect(() => {
    if (loginPhase !== "photos" || !photosReady) return;
    const timer = window.setTimeout(() => {
      if (photoIndex + 1 < welcomePhotos.length) setPhotoIndex(photoIndex + 1);
      else setLoginPhase("logo");
    }, photoIndex === welcomePhotos.length - 1 ? 4800 : 2400);
    return () => window.clearTimeout(timer);
  }, [loginPhase, photosReady, photoIndex, welcomePhotos.length]);

  useEffect(() => {
    if (loginPhase !== "logo") return;
    const audio = new Audio(voiceOverAsset.url);
    void audio.play().catch(() => undefined);
    const timer = window.setTimeout(() => setLoginPhase("welcome"), 3000);
    return () => window.clearTimeout(timer);
  }, [loginPhase]);

  useEffect(() => {
    if (loginPhase !== "welcome") return;
    const timer = window.setTimeout(() => setLoginPhase("idle"), 4200);
    return () => window.clearTimeout(timer);
  }, [loginPhase]);

  const lastPhoto = welcomePhotos[welcomePhotos.length - 1];
  if (user && loginPhase === "photos" && photosReady && welcomePhotos[photoIndex]) return <WelcomeScreen photo={welcomePhotos[photoIndex]} isLastPhoto={photoIndex === welcomePhotos.length - 1} />;
  if (user && loginPhase === "photos") return <main className="min-h-screen bg-background" />;
  if (user && loginPhase === "logo") return <WelcomeScreen stage="logo" backdrop={lastPhoto} />;
  if (user && loginPhase === "welcome") return <WelcomeScreen stage="welcome" backdrop={lastPhoto} />;
  if (user && (loginPhase === "authenticating" || loginPhase === "deciding")) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Connexion…</div>;
  }
  if (loading || (user && pdvLoading) || (user && !multiPdvEnabled && !pdvId)) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!user) return <AuthPage onLoginStart={() => { prepareMusic(); setLoginPhase("authenticating"); }} onLoginSuccess={() => setLoginPhase("deciding")} onLoginFailure={() => { musicRef.current?.pause(); setLoginPhase("idle"); }} />;
  if (multiPdvEnabled && !pdvId) return <PdvSelector />;
  return (
    <Routes>
      <Route path="/" element={<Index key={pdvId} />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
