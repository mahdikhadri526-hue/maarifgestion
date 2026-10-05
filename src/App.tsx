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
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function AuthGate() {
  const { user, loading, pdvId, pdvLoading, multiPdvEnabled } = useAuth();
  const [loginPhase, setLoginPhase] = useState<"idle" | "authenticating" | "photos" | "welcome">("idle");
  const [welcomePhotos, setWelcomePhotos] = useState<WelcomePhoto[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (loginPhase !== "photos") return;
    let cancelled = false;
    const deadline = new Promise<WelcomePhoto[]>((resolve) => window.setTimeout(() => resolve([]), 4000));
    void Promise.race([loadWelcomePhotos().catch(() => []), deadline]).then((photos) => {
      if (cancelled) return;
      if (photos.length) {
        setWelcomePhotos(photos);
        setPhotoIndex(0);
      } else {
        setLoginPhase("welcome");
      }
    });
    return () => { cancelled = true; };
  }, [loginPhase]);

  useEffect(() => {
    if (loginPhase !== "photos" || welcomePhotos.length === 0) return;
    const timer = window.setTimeout(() => {
      if (photoIndex + 1 < welcomePhotos.length) setPhotoIndex(photoIndex + 1);
      else setLoginPhase("welcome");
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [loginPhase, photoIndex, welcomePhotos.length]);

  useEffect(() => {
    if (loginPhase !== "welcome") return;
    const timer = window.setTimeout(() => setLoginPhase("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [loginPhase]);

  if (user && loginPhase === "photos" && welcomePhotos[photoIndex]) return <WelcomeScreen photo={welcomePhotos[photoIndex]} />;
  if (user && loginPhase === "photos") return <WelcomeScreen logoOnly />;
  if (user && loginPhase === "welcome") return <WelcomeScreen />;
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
