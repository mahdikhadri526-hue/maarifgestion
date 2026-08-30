import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { analyzePdv, computeScore, toISO, type Anomaly, type PdvScore } from "@/lib/anomalies";
import { formatDateFR } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "jour" | "mois" | "periode";

export function AnomalyCenter({ onBack }: { onBack: () => void }) {
  const { pdvs, isAdmin, isRegionalAdmin } = useAuth();
  const [pdvId, setPdvId] = useState<string>("");
  const [mode, setMode] = useState<Mode>("jour");
  const [day, setDay] = useState(toISO(new Date()));
  const [month, setMonth] = useState(toISO(new Date()).slice(0, 7));
  const [from, setFrom] = useState(toISO(new Date()));
  const [to, setTo] = useState(toISO(new Date()));
  const [rows, setRows] = useState<Anomaly[] | null>(null);
  const [score, setScore] = useState<PdvScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState<"all" | "urgent" | "attention">("all");

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
  const reset = () => { setRows(null); setScore(null); };

  const run = async () => {
    if (!pdvId) {
      toast.error("Choisissez d'abord un point de vente");
      return;
    }
    let start: string, end: string;
    if (mode === "jour") {
      start = end = day;
    } else if (mode === "mois") {
      const [y, m] = month.split("-").map(Number);
      start = toISO(new Date(y, m - 1, 1));
      // On s'arrête à J-1 (la journée en cours n'est pas encore terminée).
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const monthEnd = toISO(new Date(y, m, 0));
      end = monthEnd > toISO(yesterday) ? toISO(yesterday) : monthEnd;
      if (end < start) {
        toast.error("Aucune journée terminée pour ce mois");
        return;
      }
    } else {
      if (from > to) {
        toast.error("La date de début doit précéder la date de fin");
        return;
      }
      start = from;
      end = to;
    }
    setLoading(true);
    try {
      const result = await analyzePdv(pdvId, start, end);
      setRows(result.rows);
      setScore(computeScore(result.rows, result.postponedCount));
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const urgent = rows?.filter((r) => r.severity === "urgent").length ?? 0;
    const attention = rows?.filter((r) => r.severity === "attention").length ?? 0;
    return { urgent, attention, total: urgent + attention };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (sevFilter !== "all" && r.severity !== sevFilter) return false;
      if (!q) return true;
      return (
        r.label.toLowerCase().includes(q) ||
        (r.product ?? "").toLowerCase().includes(q) ||
        (r.details ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, sevFilter]);

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Point de vente</Label>
            <Select value={pdvId} onValueChange={(v) => { setPdvId(v); reset(); }}>
              <SelectTrigger><SelectValue placeholder="Choisir un PDV" /></SelectTrigger>
              <SelectContent>
                {pdvs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Type de période</Label>
            <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); reset(); }}>
              <TabsList className="w-full">
                <TabsTrigger value="jour" className="flex-1">Jour</TabsTrigger>
                <TabsTrigger value="mois" className="flex-1">Mois</TabsTrigger>
                <TabsTrigger value="periode" className="flex-1">Période</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {mode === "jour" && (
            <div className="space-y-1.5">
              <Label>Jour</Label>
              <Input type="date" value={day} onChange={(e) => { setDay(e.target.value); reset(); }} />
            </div>
          )}
          {mode === "mois" && (
            <div className="space-y-1.5">
              <Label>Mois</Label>
              <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); reset(); }} />
            </div>
          )}
          {mode === "periode" && (
            <>
              <div className="space-y-1.5">
                <Label>Date début</Label>
                <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); reset(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Date fin</Label>
                <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); reset(); }} />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={run} disabled={loading || !pdvId}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Analyser
          </Button>
          {rows && (
            <Input
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full sm:w-56 sm:ml-auto"
            />
          )}
        </div>
      </div>

      {rows && score && (
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">Note du PDV</span>
              <span
                className={`text-3xl font-bold ${
                  score.score >= 8 ? "text-green-600" : score.score >= 5 ? "text-amber-500" : "text-destructive"
                }`}
              >
                {score.score.toFixed(1).replace(".", ",")}
              </span>
              <span className="text-lg text-muted-foreground">/10</span>
            </div>
            <div className="flex-1 min-w-[180px] h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  score.score >= 8 ? "bg-green-500" : score.score >= 5 ? "bg-amber-500" : "bg-destructive"
                }`}
                style={{ width: `${(score.score / 10) * 100}%` }}
              />
            </div>
          </div>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {score.lines.map((l) => (
              <div
                key={l.label}
                className="flex items-center justify-between gap-2 text-xs rounded-lg border px-2.5 py-1.5"
              >
                <span className="text-muted-foreground">
                  {l.label} <span className="font-medium text-foreground">({l.count})</span>
                </span>
                <span className={`font-semibold ${l.penalty > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {l.penalty > 0 ? `−${l.penalty.toFixed(1).replace(".", ",")}` : "0"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows && (
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setSevFilter(sevFilter === "urgent" ? "all" : "urgent")}
            className={`rounded-xl border p-3 text-left transition ${sevFilter === "urgent" ? "ring-2 ring-primary" : ""}`}
          >
            <div className="text-xs text-muted-foreground">🔴 Urgentes</div>
            <div className="text-2xl font-bold text-destructive">{counts.urgent}</div>
          </button>
          <button
            onClick={() => setSevFilter(sevFilter === "attention" ? "all" : "attention")}
            className={`rounded-xl border p-3 text-left transition ${sevFilter === "attention" ? "ring-2 ring-primary" : ""}`}
          >
            <div className="text-xs text-muted-foreground">🟠 Attention</div>
            <div className="text-2xl font-bold text-amber-500">{counts.attention}</div>
          </button>
          <button
            onClick={() => setSevFilter("all")}
            className={`rounded-xl border p-3 text-left transition ${sevFilter === "all" ? "ring-2 ring-primary" : ""}`}
          >
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{counts.total}</div>
          </button>
        </div>
      )}

      {rows && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b bg-muted/40">
            {pdvName} — {filtered.length} anomalie{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Gravité</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Heure</th>
                  <th className="text-left px-3 py-2 font-semibold">Anomalie</th>
                  <th className="text-left px-3 py-2 font-semibold">Produit / Élément</th>
                  <th className="text-left px-3 py-2 font-semibold">Détails</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      Aucune anomalie pour cette sélection.
                    </td>
                  </tr>
                )}
                {filtered.map((a) => (
                  <tr key={a.id} className="border-t align-top">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.severity === "urgent"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {a.severity === "urgent" ? "🔴 Urgente" : "🟠 Attention"}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateFR(a.date)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{a.time}</td>
                    <td className="px-3 py-2">{a.label}</td>
                    <td className="px-3 py-2 font-medium">{a.product ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.details ?? "—"}</td>
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
