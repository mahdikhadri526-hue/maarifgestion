import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  InventorySession,
  InventoryLine,
  InventoryCount,
  InventoryResolution,
  listLines,
  listAllCounts,
  listResolutions,
  upsertResolution,
  setSessionStatus,
} from "@/lib/inventoryData";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface RowData {
  line: InventoryLine;
  a?: InventoryCount;
  b?: InventoryCount;
  resolution?: InventoryResolution;
  stockDiff: number | null;
  mepDiff: number | null;
}

export function ReconciliationView({ session }: { session: InventorySession }) {
  const [lines, setLines] = useState<InventoryLine[]>([]);
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [resolutions, setResolutions] = useState<InventoryResolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "discrepancies">("discrepancies");

  const refresh = async () => {
    try {
      const [ls, cs, rs] = await Promise.all([
        listLines(session.id),
        listAllCounts(session.id),
        listResolutions(session.id),
      ]);
      setLines(ls);
      setCounts(cs);
      setResolutions(rs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`inv-recon-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_resolutions", filter: `session_id=eq.${session.id}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const rows: RowData[] = useMemo(() => {
    const byLine = new Map<string, { a?: InventoryCount; b?: InventoryCount }>();
    for (const c of counts) {
      const entry = byLine.get(c.lineId) ?? {};
      if (c.counterSlot === "A") entry.a = c;
      else entry.b = c;
      byLine.set(c.lineId, entry);
    }
    const resByLine = new Map(resolutions.map((r) => [r.lineId, r]));
    return lines.map((line) => {
      const e = byLine.get(line.id) ?? {};
      const stockDiff =
        e.a && e.b && e.a.stockQty !== null && e.b.stockQty !== null
          ? e.a.stockQty - e.b.stockQty
          : null;
      const mepDiff =
        e.a && e.b && e.a.miseEnPlaceQty !== null && e.b.miseEnPlaceQty !== null
          ? e.a.miseEnPlaceQty - e.b.miseEnPlaceQty
          : null;
      return {
        line,
        a: e.a,
        b: e.b,
        resolution: resByLine.get(line.id),
        stockDiff,
        mepDiff,
      };
    });
  }, [lines, counts, resolutions]);

  const filteredRows = rows.filter((r) => {
    if (filter === "all") return true;
    const stockMismatch = r.stockDiff !== null && r.stockDiff !== 0;
    const mepMismatch = r.mepDiff !== null && r.mepDiff !== 0;
    return stockMismatch || mepMismatch;
  });

  const grouped = useMemo(() => {
    const map = new Map<string, RowData[]>();
    for (const r of filteredRows) {
      const arr = map.get(r.line.category) ?? [];
      arr.push(r);
      map.set(r.line.category, arr);
    }
    return Array.from(map.entries());
  }, [filteredRows]);

  const discrepanciesCount = rows.filter(
    (r) => (r.stockDiff !== null && r.stockDiff !== 0) || (r.mepDiff !== null && r.mepDiff !== 0),
  ).length;
  const allResolved = rows.every((r) => r.resolution);

  if (loading) return <Card className="p-6 text-sm text-muted-foreground">Chargement…</Card>;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold">{session.label} — Rapprochement</div>
            <div className="text-xs text-muted-foreground">
              {rows.length} lignes · {discrepanciesCount} écart(s) entre compteurs
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={filter === "discrepancies" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("discrepancies")}
            >
              À revérifier ({discrepanciesCount})
            </Button>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Tout afficher
            </Button>
            {session.status === "reconciling" && (
              <Button
                disabled={!allResolved}
                onClick={async () => {
                  if (!confirm("Clôturer définitivement cette session ?")) return;
                  try {
                    await setSessionStatus(session.id, "closed");
                    toast.success("Session clôturée");
                  } catch (e: any) {
                    toast.error(e.message ?? "Erreur");
                  }
                }}
              >
                Valider et clôturer
              </Button>
            )}
          </div>
        </div>
      </Card>

      {grouped.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">
          {filter === "discrepancies"
            ? "Aucun écart entre les deux comptages."
            : "Aucune ligne."}
        </Card>
      )}

      {grouped.map(([cat, group]) => (
        <Card key={cat} className="p-0 overflow-hidden">
          <div className="bg-muted px-4 py-2 text-sm font-semibold uppercase tracking-wider">{cat}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left p-2">Article / Lot</th>
                  <th className="text-right p-2">A Stock</th>
                  <th className="text-right p-2">B Stock</th>
                  <th className="text-right p-2">Écart</th>
                  <th className="text-right p-2">A MeP</th>
                  <th className="text-right p-2">B MeP</th>
                  <th className="text-right p-2">Théorique</th>
                  <th className="text-right p-2">Stock validé</th>
                  <th className="text-right p-2">Écart vs Théo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {group.map((r) => (
                  <ResolutionRow
                    key={r.line.id}
                    row={r}
                    readOnly={session.status === "closed"}
                    onResolve={async (stockFinal, mepFinal) => {
                      await upsertResolution({
                        sessionId: session.id,
                        lineId: r.line.id,
                        finalStockQty: stockFinal,
                        finalMiseEnPlaceQty: mepFinal,
                        theoreticalQty: r.line.theoreticalQty,
                      });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ResolutionRow({
  row,
  readOnly,
  onResolve,
}: {
  row: RowData;
  readOnly: boolean;
  onResolve: (stockFinal: number, mepFinal: number | null) => Promise<void>;
}) {
  const initialStock = row.resolution?.finalStockQty ?? (row.stockDiff === 0 ? row.a?.stockQty ?? null : null);
  const initialMep = row.resolution?.finalMiseEnPlaceQty ?? (row.mepDiff === 0 ? row.a?.miseEnPlaceQty ?? null : null);
  const [finalStock, setFinalStock] = useState<string>(initialStock?.toString() ?? "");
  const [finalMep, setFinalMep] = useState<string>(initialMep?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const variance =
    finalStock !== "" && !Number.isNaN(Number(finalStock))
      ? Number(finalStock) - row.line.theoreticalQty
      : null;

  const stockMismatch = row.stockDiff !== null && row.stockDiff !== 0;
  const mepMismatch = row.mepDiff !== null && row.mepDiff !== 0;

  return (
    <tr className="border-b last:border-0">
      <td className="p-2">
        <div className="font-medium">{row.line.productName}</div>
        <div className="text-xs text-muted-foreground">Lot : {row.line.lotNumber || "—"}</div>
      </td>
      <td className="p-2 text-right">{row.a?.stockQty ?? "—"}</td>
      <td className="p-2 text-right">{row.b?.stockQty ?? "—"}</td>
      <td className="p-2 text-right">
        {row.stockDiff === null ? (
          "—"
        ) : stockMismatch ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {row.stockDiff > 0 ? "+" : ""}
            {row.stockDiff}
          </Badge>
        ) : (
          <Badge variant="secondary">0</Badge>
        )}
      </td>
      <td className="p-2 text-right">{row.a?.miseEnPlaceQty ?? "—"}</td>
      <td className="p-2 text-right">{row.b?.miseEnPlaceQty ?? "—"}</td>
      <td className="p-2 text-right text-muted-foreground">{row.line.theoreticalQty}</td>
      <td className="p-2 text-right">
        <Input
          type="number"
          inputMode="decimal"
          className="w-20 h-8 ml-auto"
          value={finalStock}
          onChange={(e) => setFinalStock(e.target.value)}
          disabled={readOnly}
        />
      </td>
      <td className="p-2 text-right">
        {variance === null ? (
          "—"
        ) : variance === 0 ? (
          <Badge variant="secondary">0</Badge>
        ) : (
          <Badge variant={Math.abs(variance) > 0 ? "destructive" : "secondary"}>
            {variance > 0 ? "+" : ""}
            {Number(variance.toFixed(2))}
          </Badge>
        )}
      </td>
      <td className="p-2 text-right">
        {!readOnly && (
          <div className="flex flex-col items-end gap-1">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="MeP finale"
              className="w-24 h-8"
              value={finalMep}
              onChange={(e) => setFinalMep(e.target.value)}
            />
            <Button
              size="sm"
              variant={row.resolution ? "secondary" : "default"}
              disabled={saving || finalStock === "" || Number.isNaN(Number(finalStock))}
              onClick={async () => {
                setSaving(true);
                try {
                  await onResolve(
                    Number(finalStock),
                    finalMep === "" ? null : Number(finalMep),
                  );
                  toast.success("Ligne validée");
                } catch (e: any) {
                  toast.error(e.message ?? "Erreur");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {row.resolution ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Re-valider
                </>
              ) : (
                "Valider"
              )}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}