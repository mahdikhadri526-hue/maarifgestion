import { Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

export function PdvSelector() {
  const { pdvs, pdvLoading, selectPdv, signOut, user } = useAuth();

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
              Aucun point de vente ne vous est attribué. Contactez un administrateur.
            </p>
          ) : (
            pdvs.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => selectPdv(p.id)}
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
