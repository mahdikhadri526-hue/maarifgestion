import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Scale } from "lucide-react";
import { formatDateFR } from "@/lib/utils";
import {
  ECART_CATEGORIES,
  ECART_PRODUCTS,
  ECART_ZONES,
  type EcartEntry,
  type EcartZone,
  computeConsommation,
  computeEcart,
  fetchEcartEntries,
  fetchPreviousFinals,
  monthRange,
  saveEcartEntries,
} from "@/lib/ecartData";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "jour" | "mois" | "periode";

interface Row {
  produit: string;
  categorie: string;
  zone: EcartZone;
  stock_initial: string;
  entrees: string;
  stock_final: string;
  ventes: string;
  autoInitial: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);
const n = (v: string) => {
  const x = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v);

export function EcartModule() {
  const { can, isAdmin, isRegionalAdmin } = useAuth();
  const canEdit = can("edit_ecarts") || isAdmin || isRegionalAdmin;

  const [mode, setMode] = useState<Mode>("jour");
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [fProduit, setFProduit] = useState("all");
  const [fCategorie, setFCategorie] = useState("all");
  const [fZone, setFZone] = useState<"all" | EcartZone>("all");

  const [rows, setRows] = useState<Row[]>([]);
  const [history, setHistory] = useState<EcartEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => {
    if (mode === "jour") return { start: date, end: date };
    if (mode === "mois") return monthRange(month);
    return { start, end };
  }, [mode, date, month, start, end]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await fetchEcartEntries(range.start, range.end);
      setHistory(entries);
      if (mode === "jour") {
        const prev = await fetchPreviousFinals(date);
        const saved = new Map<string, EcartEntry>();
        for (const e of entries) saved.set(`${e.produit}|${e.zone}`, e);
        const next: Row[] = [];
        for (const zone of ECART_ZONES) {
          for (const p of ECART_PRODUCTS) {
            const key = `${p.name}|${zone}`;
            const e = saved.get(key);
            const auto = prev.get(key);
            next.push({
              produit: p.name,
              categorie: p.categorie,
              zone,
              stock_initial: e
                ? String(e.stock_initial)
                : auto !== undefined
                  ? String(auto)
                  : "",
              entrees: e ? String(e.entrees) : "",
              stock_final: e ? String(e.stock_final) : "",
              ventes: e ? String(e.ventes) : "",
              autoInitial: !e && auto !== undefined,
            });
          }
        }
        setRows(next);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, mode, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const matches = (produit: string, categorie: string, zone: string) =>
    (fProduit === "all" || fProduit === produit) &&
    (fCategorie === "all" || fCategorie === categorie) &&
    (fZone === "all" || fZone === zone);

  const visibleRows = rows.filter((r) => matches(r.produit, r.categorie, r.zone));
  const visibleHistory = history.filter((h) =>
    matches(h.produit, h.categorie, h.zone),
  );

  const setCell = (produit: string, zone: EcartZone, field: keyof Row, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.produit === produit && r.zone === zone ? { ...r, [field]: value } : r,
      ),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = rows
        .filter(
          (r) =>
            r.stock_initial !== "" ||
            r.entrees !== "" ||
            r.stock_final !== "" ||
            r.ventes !== "",
        )
        .map((r) => ({
          entry_date: date,
          produit: r.produit,
          categorie: r.categorie,
          zone: r.zone,
          stock_initial: n(r.stock_initial),
          entrees: n(r.entrees),
          stock_final: n(r.stock_final),
          ventes: n(r.ventes),
        }));
      await saveEcartEntries(payload);
      toast.success("Écarts enregistrés");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const totals = (list: { stock_initial: number; entrees: number; stock_final: number; ventes: number }[]) =>
    list.reduce(
      (acc, r) => {
        acc.conso += computeConsommation(r);
        acc.ecart += computeEcart(r);
        acc.ventes += r.ventes;
        return acc;
      },
      { conso: 0, ecart: 0, ventes: 0 },
    );

  const dayTotals = totals(
    visibleRows.map((r) => ({
      stock_initial: n(r.stock_initial),
      entrees: n(r.entrees),
      stock_final: n(r.stock_final),
      ventes: n(r.ventes),
    })),
  );
  const histTotals = totals(visibleHistory);

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-xl p-4 shadow-sm">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Scale className="h-5 w-5 text-primary" /> Calcul des écarts
        </h2>

        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Période</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="border rounded-lg px-2 py-1.5 text-sm bg-background"
            >
              <option value="jour">Jour</option>
              <option value="mois">Mois</option>
              <option value="periode">Période</option>
            </select>
          </div>
          {mode === "jour" && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-background" />
            </div>
          )}
          {mode === "mois" && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Mois</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-background" />
            </div>
          )}
          {mode === "periode" && (
            <>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Du</label>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-background" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Au</label>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-background" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Produit</label>
            <select value={fProduit} onChange={(e) => setFProduit(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-background">
              <option value="all">Tous</option>
              {ECART_PRODUCTS.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Catégorie</label>
            <select value={fCategorie} onChange={(e) => setFCategorie(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-background">
              <option value="all">Toutes</option>
              {ECART_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Zone</label>
            <select value={fZone} onChange={(e) => setFZone(e.target.value as "all" | EcartZone)} className="border rounded-lg px-2 py-1.5 text-sm bg-background">
              <option value="all">Emporter + Surplace</option>
              {ECART_ZONES.map((z) => (
                <option key={z} value={z}>{z === "EMPORTER" ? "Emporter" : "Surplace"}</option>
              ))}
            </select>
          </div>
          {mode === "jour" && canEdit && (
            <button
              onClick={save}
              disabled={saving || loading}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
      ) : mode === "jour" ? (
        <div className="bg-card border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse min-w-[900px]">
            <thead className="bg-muted/60">
              <tr>
                <th className="sticky left-0 z-10 bg-muted/60 px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Produit</th>
                <th className="px-2 py-2 text-left">Catégorie</th>
                <th className="px-2 py-2 text-left">Zone</th>
                <th className="px-2 py-2">Stock initial</th>
                <th className="px-2 py-2">Entrées</th>
                <th className="px-2 py-2">Stock final</th>
                <th className="px-2 py-2">Ventes</th>
                <th className="px-2 py-2">Consommation</th>
                <th className="px-2 py-2">Écart</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const vals = {
                  stock_initial: n(r.stock_initial),
                  entrees: n(r.entrees),
                  stock_final: n(r.stock_final),
                  ventes: n(r.ventes),
                };
                const conso = computeConsommation(vals);
                const ecart = computeEcart(vals);
                return (
                  <tr key={`${r.zone}-${r.produit}`} className="border-t">
                    <td className="sticky left-0 z-10 bg-card px-2 py-1 whitespace-nowrap">{formatDateFR(date)}</td>
                    <td className="px-2 py-1 whitespace-nowrap font-medium">{r.produit}</td>
                    <td className="px-2 py-1 text-muted-foreground">{r.categorie}</td>
                    <td className="px-2 py-1">{r.zone === "EMPORTER" ? "Emporter" : "Surplace"}</td>
                    {(["stock_initial", "entrees", "stock_final", "ventes"] as const).map((f) => (
                      <td key={f} className="px-1 py-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={r[f]}
                          disabled={!canEdit}
                          onChange={(e) => setCell(r.produit, r.zone, f, e.target.value)}
                          className={`w-24 border rounded px-1.5 py-1 text-right bg-background ${f === "stock_initial" && r.autoInitial ? "text-muted-foreground" : ""}`}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right tabular-nums">{fmt(conso)}</td>
                    <td className={`px-2 py-1 text-right tabular-nums font-semibold ${ecart < 0 ? "text-destructive" : ""}`}>{fmt(ecart)}</td>
                  </tr>
                );
              })}
              <tr className="border-t bg-muted/40 font-semibold">
                <td className="sticky left-0 z-10 bg-muted/40 px-2 py-2" colSpan={7}>Total</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(dayTotals.ventes)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(dayTotals.conso)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(dayTotals.ecart)}</td>
              </tr>
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Le stock initial est repris automatiquement du stock final de la veille ; il reste modifiable pour la première saisie.
          </p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse min-w-[900px]">
            <thead className="bg-muted/60">
              <tr>
                <th className="sticky left-0 z-10 bg-muted/60 px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Produit</th>
                <th className="px-2 py-2 text-left">Catégorie</th>
                <th className="px-2 py-2 text-left">Zone</th>
                <th className="px-2 py-2 text-right">Stock initial</th>
                <th className="px-2 py-2 text-right">Entrées</th>
                <th className="px-2 py-2 text-right">Stock final</th>
                <th className="px-2 py-2 text-right">Ventes</th>
                <th className="px-2 py-2 text-right">Consommation</th>
                <th className="px-2 py-2 text-right">Écart</th>
              </tr>
            </thead>
            <tbody>
              {visibleHistory.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Aucune donnée sur la période.</td></tr>
              )}
              {visibleHistory.map((h) => {
                const conso = computeConsommation(h);
                const ecart = computeEcart(h);
                return (
                  <tr key={h.id} className="border-t">
                    <td className="sticky left-0 z-10 bg-card px-2 py-1 whitespace-nowrap">{formatDateFR(h.entry_date)}</td>
                    <td className="px-2 py-1 font-medium whitespace-nowrap">{h.produit}</td>
                    <td className="px-2 py-1 text-muted-foreground">{h.categorie}</td>
                    <td className="px-2 py-1">{h.zone === "EMPORTER" ? "Emporter" : "Surplace"}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmt(h.stock_initial)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmt(h.entrees)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmt(h.stock_final)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmt(h.ventes)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmt(conso)}</td>
                    <td className={`px-2 py-1 text-right tabular-nums font-semibold ${ecart < 0 ? "text-destructive" : ""}`}>{fmt(ecart)}</td>
                  </tr>
                );
              })}
              {visibleHistory.length > 0 && (
                <tr className="border-t bg-muted/40 font-semibold">
                  <td className="sticky left-0 z-10 bg-muted/40 px-2 py-2" colSpan={7}>Total</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(histTotals.ventes)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(histTotals.conso)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(histTotals.ecart)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
