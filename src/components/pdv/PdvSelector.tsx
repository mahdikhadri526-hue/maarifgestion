import { useState } from "react";
import { ArrowLeft, Building2, LogOut, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, Pdv } from "@/contexts/AuthContext";

export function PdvSelector() {
  const { pdvs, pdvLoading, selectPdv, signOut, user } = useAuth();
  const [pending, setPending] = useState<Pdv | null>(null);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);

  const submitCode = async () => {
    if (!pending || !code.trim()) return;
    setChecking(true);
    const { data, error } = await (supabase as any).rpc("verify_pdv_code", {
      _pdv_id: pending.id,
      _code: code.trim(),
    });
    setChecking(false);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    if (data === true) {
      selectPdv(pending.id);
    } else {
      toast.error("Code incorrect");
      setCode("");
    }
  };

  if (pending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5 text-primary" />
              {pending.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Saisir le code d'accès du point de vente</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              autoFocus
              type="password"
              inputMode="numeric"
              placeholder="Code d'accès"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCode()}
            />
            <Button className="w-full" onClick={submitCode} disabled={checking || !code.trim()}>
              {checking ? "Vérification…" : "Entrer"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setPending(null);
                setCode("");
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            Choisir un point de vente
          </CardTitle>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {pdvLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : pdvs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun point de vente disponible. Contactez un administrateur.
            </p>
          ) : (
            pdvs.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => setPending(p)}
              >
                <Building2 className="h-4 w-4 mr-3 text-primary" />
                <span className="text-left">
                  <span className="block font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.code}</span>
                </span>
              </Button>
            ))
          )}
          <Button variant="ghost" size="sm" className="w-full mt-2" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
