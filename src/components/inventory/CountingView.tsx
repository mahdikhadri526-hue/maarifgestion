import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  InventorySession,
  InventoryLine,
  InventoryCount,
  CounterSlot,
  listLines,
  listMyCounts,
  upsertCount,
  markCounterDone,
} from "@/lib/inventoryData";
import { formatMaybeDate } from "@/lib/utils";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export function CountingView({ session }: { session: InventorySession }) {
  const { user } = useAuth();
  const slot: CounterSlot = user?.id === session.counterAUserId ? "A" : "B";
  const meDone = slot === "A" ? session.counterADone : session.counterBDone;

  const [lines, setLines] = useState<InventoryLine[]>([]);
  const [counts, setCounts] = useState<Record<string, InventoryCount>>({});
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const [ls, cs] = await Promise.all([listLines(session.id), listMyCounts(session.id)]);
      setLines(ls);
      const byLine: Record<string, InventoryCount> = {};
      cs.forEach((c) => {
        if (c.counterSlot === slot) byLine[c.lineId] = c;
      });
      setCounts(byLine);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`inv-counting-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_counts", filter: `session_id=eq.${session.id}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const grouped = useMemo(() => {
    const map = new Map<string, InventoryLine[]>();
    for (const l of lines) {
      const arr = map.get(l.category) ?? [];
      arr.push(l);
      map.set(l.category, arr);
    }
    return Array.from(map.entries());
  }, [lines]);

  const total = lines.length;
  const filled = lines.filter((l) => {
    const c = counts[l.id];
    return c && c.stockQty !== null && c.miseEnPlaceQty !== null;
  }).length;

  if (loading) return <Card className="p-6 text-sm text-muted-foreground">Chargement…</Card>;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-semibold">{session.label}</div>
            <div className="text-xs text-muted-foreground">
              Vous êtes le compteur <strong>{slot}</strong> · {filled} / {total} lignes
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              ⚠️ Vous ne voyez ni le stock théorique, ni les saisies de l'autre compteur.
            </div>
          </div>
          {meDone ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Comptage envoyé
            </Badge>
          ) : (
            <Button
              disabled={filled < total}
              onClick={async () => {
                if (!confirm("Marquer votre comptage comme terminé ? Vous ne pourrez plus le modifier.")) return;
                try {
                  await markCounterDone(session.id, slot);
                  toast.success("Comptage envoyé");
                } catch (e: any) {
                  toast.error(e.message ?? "Erreur");
                }
              }}
            >
              {filled < total ? `Encore ${total - filled} à compter` : "Marquer comme terminé"}
            </Button>
          )}
        </div>
      </Card>

      {grouped.map(([cat, group]) => (
        <Card key={cat} className="p-0 overflow-hidden">
          <div className="bg-muted px-4 py-2 text-sm font-semibold uppercase tracking-wider">{cat}</div>
          <div className="divide-y">
            {group.map((l) => (
              <CountingRow
                key={l.id}
                line={l}
                count={counts[l.id]}
                disabled={meDone}
                onSave={async (stock, mep) => {
                  await upsertCount({
                    sessionId: session.id,
                    lineId: l.id,
                    counterSlot: slot,
                    stockQty: stock,
                    miseEnPlaceQty: mep,
                  });
                }}
              />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function CountingRow({
  line,
  count,
  disabled,
  onSave,
}: {
  line: InventoryLine;
  count: InventoryCount | undefined;
  disabled: boolean;
  onSave: (stock: number | null, mep: number | null) => Promise<void>;
}) {
  const [stock, setStock] = useState<string>(count?.stockQty?.toString() ?? "");
  const [mep, setMep] = useState<string>(count?.miseEnPlaceQty?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStock(count?.stockQty?.toString() ?? "");
    setMep(count?.miseEnPlaceQty?.toString() ?? "");
  }, [count?.stockQty, count?.miseEnPlaceQty]);

  const saved =
    count &&
    count.stockQty !== null &&
    count.miseEnPlaceQty !== null &&
    stock === count.stockQty.toString() &&
    mep === count.miseEnPlaceQty.toString();

  const save = async () => {
    const s = stock === "" ? null : Number(stock);
    const m = mep === "" ? null : Number(mep);
    if (s === null || m === null || Number.isNaN(s) || Number.isNaN(m)) {
      toast.error("Renseignez les deux quantités");
      return;
    }
    setSaving(true);
    try {
      await onSave(s, m);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{line.productName}</div>
        <div className="text-xs text-muted-foreground">
          Lot : {line.lotNumber ? formatMaybeDate(line.lotNumber) : "—"}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Stock</div>
          <Input
            type="number"
            inputMode="decimal"
            className="w-24 h-9"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Mise en place</div>
          <Input
            type="number"
            inputMode="decimal"
            className="w-24 h-9"
            value={mep}
            onChange={(e) => setMep(e.target.value)}
            disabled={disabled}
          />
        </div>
        <Button size="sm" onClick={save} disabled={disabled || saving} variant={saved ? "secondary" : "default"}>
          {saving ? "…" : saved ? "✓" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}