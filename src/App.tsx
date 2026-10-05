import { useEffect, useState } from "react";
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
import voiceOver from "@/assets/oliveri-voix.mp3";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function AuthGate() {
  const { user, loading, pdvId, pdvLoading, multiPdvEnabled } = useAuth();
  const [loginPhase, setLoginPhase] = useState<"idle" | "authenticating" | "photos" | "logo" | "welcome">("idle");
  const [welcomePhotos, setWelcomePhotos] = useState<WelcomePhoto[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photosReady, setPhotosReady] = useState(false);

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

  useEffect(() => {
    if (loginPhase !== "photos" || !photosReady) return;
    const timer = window.setTimeout(() => {
      if (photoIndex + 1 < welcomePhotos.length) setPhotoIndex(photoIndex + 1);
      else setLoginPhase("logo");
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [loginPhase, photosReady, photoIndex, welcomePhotos.length]);

  useEffect(() => {
    if (loginPhase !== "logo") return;
    const audio = new Audio(voiceOver);
    void audio.play().catch(() => undefined);
    const timer = window.setTimeout(() => setLoginPhase("welcome"), 3000);
    return () => window.clearTimeout(timer);
  }, [loginPhase]);

  useEffect(() => {
    if (loginPhase !== "welcome") return;
    const timer = window.setTimeout(() => setLoginPhase("idle"), 2200);
    return () => window.clearTimeout(timer);
  }, [loginPhase]);

  const lastPhoto = welcomePhotos[welcomePhotos.length - 1];
  if (user && loginPhase === "photos" && photosReady && welcomePhotos[photoIndex]) return <WelcomeScreen photo={welcomePhotos[photoIndex]} />;
  if (user && loginPhase === "photos") return <main className="min-h-screen bg-background" />;
  if (user && loginPhase === "logo") return <WelcomeScreen stage="logo" backdrop={lastPhoto} />;
  if (user && loginPhase === "welcome") return <WelcomeScreen stage="welcome" backdrop={lastPhoto} />;
  if (user && loginPhase === "authenticating") {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Connexion…</div>;
  }
  if (loading || (user && pdvLoading) || (user && !multiPdvEnabled && !pdvId)) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!user) return <AuthPage onLoginStart={() => setLoginPhase("authenticating")} onLoginSuccess={() => setLoginPhase("photos")} onLoginFailure={() => setLoginPhase("idle")} />;
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
