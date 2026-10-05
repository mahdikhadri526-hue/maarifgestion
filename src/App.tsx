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
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function AuthGate() {
  const { user, loading, pdvId, pdvLoading, multiPdvEnabled } = useAuth();
  const [loginPhase, setLoginPhase] = useState<"idle" | "authenticating" | "welcome">("idle");

  useEffect(() => {
    if (loginPhase !== "welcome") return;
    const timer = window.setTimeout(() => setLoginPhase("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [loginPhase]);

  if (user && loginPhase === "welcome") return <WelcomeScreen />;
  if (user && loginPhase === "authenticating") {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Connexion…</div>;
  }
  if (loading || (user && pdvLoading) || (user && !multiPdvEnabled && !pdvId)) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!user) return <AuthPage onLoginStart={() => setLoginPhase("authenticating")} onLoginSuccess={() => setLoginPhase("welcome")} onLoginFailure={() => setLoginPhase("idle")} />;
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
