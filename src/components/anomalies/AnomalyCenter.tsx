import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { detectAnomalies, toISO, type Anomaly } from "@/lib/anomalies";
import { toast } from "sonner";

export function AnomalyCenter({ onBack }: { onBack: () => void }) {
  const { pdvs, isAdmin, isRegionalAdmin } = useAuth();
  const [pdvId, setPdvId] = useState<string>("");
  const [mode, setMode] = useState<"jour" | "mois">("jour");
  const [day, setDay] = useState(toISO(new Date()));
  const [month, setMonth] = useState(toISO(new Date()).slice(0, 7));
  const [rows, setRows] = useState<Anomaly[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  if (!isAdmin && !isRegionalAdmin) {
    return (
      <div className="bg-card border rounded-xl p-8 text-center">
        <h2 className="text-lg font-semibold mb-2">Accès refusé</h2>
        <p className="text-sm text-muted-foreground">
          Le Centre des anomalies est réservé à l'Admin principal et aux Admin régionaux.
        </p>
      </div>
    );
  }

  const pdvName = pdvs.find((p) => p.id === pdvId)?.name ?? "";

  const run = async () => {
    if (!pdvId) {
      toast.error("Choisissez d'abord un point de vente");
      return;
    }
    let start: string, end: string;
    if (mode === "jour") {
      start = end = day;
    } else {
      const [y, m] = month.split("-").map(Number);
      start = toISO(new Date(y, m - 1, 1));
      end = toISO(new Date(y, m, 0));
    }
    setLoading(true);
    try {
      setRows(await detectAnomalies(pdvId, start, end));
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.label.toLowerCase().includes(q) || (r.product ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" /> Centre des anomalies
        </h2>
      </div>

      <div className="bg-card border rounded-xl p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Point de vente</Label>
            <Select value={pdvId} onValueChange={(v) => { setPdvId(v); setRows(null); }}>
              <SelectTrigger><SelectValue placeholder="Choisir un PDV" /></SelectTrigger>
              <SelectContent>
                {pdvs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Période</Label>
            <Tabs value={mode} onValueChange={(v) => { setMode(v as any); setRows(null); }}>
              <TabsList className="w-full">
                <TabsTrigger value="jour" className="flex-1">Jour</TabsTrigger>
                <TabsTrigger value="mois" className="flex-1">Mois</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-1.5">
            <Label>{mode === "jour" ? "Jour" : "Mois"}</Label>
            {mode === "jour" ? (
              <Input type="date" value={day} onChange={(e) => { setDay(e.target.value); setRows(null); }} />
            ) : (
              <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setRows(null); }} />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={run} disabled={loading || !pdvId}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Analyser
          </Button>
          {rows && (
            <>
              <span className="text-sm text-muted-foreground">
                {rows.length} anomalie{rows.length > 1 ? "s" : ""} détectée{rows.length > 1 ? "s" : ""}
              </span>
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full sm:w-56 sm:ml-auto"
              />
            </>
          )}
        </div>
      </div>

      {rows && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">PDV</th>
                  <th className="text-left px-3 py-2 font-semibold">Anomalie</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">
                      Aucune anomalie pour cette sélection.
                    </td>
                  </tr>
                )}
                {filtered.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{pdvName}</td>
                    <td className="px-3 py-2">
                      {a.label}
                      {a.product ? <span className="font-medium"> — {a.product}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
