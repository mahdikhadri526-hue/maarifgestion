import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateFR } from "@/lib/utils";

export const MATERIEL_ARTICLES: { name: string; defaultQty: number }[] = [
  { name: "Verre personnel", defaultQty: 3 },
  { name: "Verre à jus 22cl", defaultQty: 12 },
  { name: "Verre à thé", defaultQty: 66 },
  { name: "Verre à jus 33 cl", defaultQty: 48 },
  { name: "Verre à café", defaultQty: 36 },
  { name: "Verre macédoine", defaultQty: 0 },
  { name: "Grand verre", defaultQty: 22 },
  { name: "Coupe inox", defaultQty: 5 },
  { name: "Tasse café noir", defaultQty: 255 },
  { name: "Tasse café crème", defaultQty: 71 },
  { name: "Thiere en inox", defaultQty: 2 },
  { name: "Sous T.C.noir", defaultQty: 19 },
  { name: "Sous T.C.crème", defaultQty: 55 },
  { name: "Sous verre café noir", defaultQty: 66 },
  { name: "Assiette sous coupe", defaultQty: 4 },
  { name: "Assiette tulipe", defaultQty: 0 },
  { name: "Assiette crêpe", defaultQty: 20 },
  { name: "Cuillère C.Noir", defaultQty: 66 },
  { name: "Cuillère C. Crème", defaultQty: 96 },
  { name: "Cuillère Jus panaché", defaultQty: 54 },
  { name: "Cuillère à glace", defaultQty: 96 },
  { name: "Couteaux inox", defaultQty: 130 },
  { name: "Fourchette", defaultQty: 0 },
  { name: "Plateaux", defaultQty: 8 },
  { name: "Theire", defaultQty: 153 },
  { name: "CVC Theire", defaultQty: 153 },
  { name: "Cendrier rond", defaultQty: 18 },
  { name: "Pince à glace", defaultQty: 0 },
  { name: "Palette à Glace", defaultQty: 0 },
  { name: "CVC cendrier rond", defaultQty: 18 },
  { name: "Bec siphon", defaultQty: 0 },
  { name: "Porte addition", defaultQty: 0 },
  { name: "Jarra grand modèle", defaultQty: 98 },
  { name: "Jarra petit modèle", defaultQty: 0 },
  { name: "Presse agrume", defaultQty: 1 },
  { name: "Boite en plastique G", defaultQty: 0 },
  { name: "Boite en plastique P", defaultQty: 0 },
  { name: "Carafe", defaultQty: 0 },
  { name: "Spatule en inox", defaultQty: 8 },
  { name: "Spatule en plastique", defaultQty: 0 },
  { name: "Couteaux Légume", defaultQty: 21 },
  { name: "Couteaux G", defaultQty: 0 },
  { name: "Siphon", defaultQty: 0 },
  { name: "Moule Cornet", defaultQty: 2 },
  { name: "Moule Tulipe", defaultQty: 0 },
  { name: "Scoupe Topping", defaultQty: 0 },
  { name: "Moule 1L", defaultQty: 0 },
  { name: "Moule 0.5L", defaultQty: 0 },
  { name: "BIBERONS", defaultQty: 0 },
  { name: "SUPPORT TRANCHES", defaultQty: 0 },
  { name: "PLANCHES TRANCHES", defaultQty: 0 },
  { name: "PIQUE TICKET", defaultQty: 0 },
  { name: "PRESENTOIRE SERVIETTE", defaultQty: 0 },
  { name: "PORTE ADDITION", defaultQty: 0 },
  { name: "BROSSR VERRE", defaultQty: 0 },
  { name: "LAVETTE MICROFIBRES(JAUNE/VERTE/BLEU/ROUGE)", defaultQty: 0 },
  { name: "BROSSE SIPHON", defaultQty: 0 },
  { name: "BROSSE AGRUME", defaultQty: 0 },
  { name: "BROSSE METALLIQUE MACHINE A CORNET", defaultQty: 0 },
  { name: "ABRASIFS", defaultQty: 0 },
  { name: "Raclette", defaultQty: 0 },
  { name: "BALAI", defaultQty: 0 },
];

export const MATERIEL_FICHE_TYPE = "Suivi Materiel";

function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function sundayIso(weekStart: string) {
  const d = parseISO(weekStart);
  d.setDate(d.getDate() + 6);
  return fmt(d);
}

function addWeeksIso(weekStart: string, weeks: number) {
  const d = parseISO(weekStart);
  d.setDate(d.getDate() + weeks * 7);
  return fmt(d);
}

type Row = {
  id?: string;
  week_start: string;
  article: string;
  row_index: number;
  quantity: number | null;
  stock_initial: number | null;
  entrees: number | null;
  sorties: number | null;
  updated_at?: string;
};

type Cell = { si: string; e: string; s: string };

const num = (v: string) => {
  if (v === "" || v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};
const disp = (v: any) => (v === null || v === undefined ? "" : String(v));
const hasValue = (v: any) => v !== "" && v !== null && v !== undefined && !isNaN(Number(v));
const fmtQty = (v: number) => String(Math.round(v * 100) / 100);

export function MaterielTracking({ weekStart }: { weekStart: string }) {
  const { can } = useAuth();
  const canEdit = can("edit_weekly");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<Record<string, Cell>>({});

  const editable = canEdit;
  const siEditable = editable;

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("weekly_tracking")
        .select("id, week_start, article, row_index, quantity, stock_initial, entrees, sorties, updated_at")
        .eq("fiche_type", MATERIEL_FICHE_TYPE)
        .order("week_start", { ascending: false });
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      toast.error("Erreur de chargement", { description: e?.message ?? String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const currentByArticle = useMemo(() => {
    const m = new Map<string, Row>();
    rows.filter((r) => r.week_start === weekStart).forEach((r) => m.set(r.article, r));
    return m;
  }, [rows, weekStart]);

  useEffect(() => {
    const next: Record<string, Cell> = {};
    MATERIEL_ARTICLES.forEach((a) => {
      const r = currentByArticle.get(a.name);
      next[a.name] = {
        si: r ? disp(r.stock_initial ?? r.quantity) : "",
        e: r ? disp(r.entrees) : "",
        s: r ? disp(r.sorties) : "",
      };
    });
    setLocal(next);
  }, [currentByArticle]);

  const historyWeeks = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.week_start !== weekStart) set.add(r.week_start);
    });
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [rows, weekStart]);

  const rowFor = (article: string, wk: string) => rows.find((r) => r.week_start === wk && r.article === article);

  const getWeekCell = (article: string, wk: string): Cell => {
    if (wk === weekStart) return local[article] ?? { si: "", e: "", s: "" };
    const r = rowFor(article, wk);
    return {
      si: r ? disp(r.stock_initial ?? r.quantity) : "",
      e: r ? disp(r.entrees) : "",
      s: r ? disp(r.sorties) : "",
    };
  };

  const getAutoSortie = (article: string, wk: string) => {
    const current = getWeekCell(article, wk);
    const next = getWeekCell(article, addWeeksIso(wk, 1));
    if (!hasValue(current.si) || !hasValue(next.si)) return null;
    return num(current.si) + num(current.e) - num(next.si);
  };

  const getEffectiveSortie = (article: string, wk: string, manual: string) => {
    const auto = getAutoSortie(article, wk);
    if (auto !== null && (!hasValue(manual) || Number(manual) === 0)) return auto;
    return num(manual);
  };

  const handleSave = async () => {
    if (!editable) return;
    setSaving(true);
    try {
      const payload = MATERIEL_ARTICLES.map((a, idx) => {
        const c = local[a.name] ?? { si: "", e: "", s: "" };
        const si = num(c.si);
        const e = num(c.e);
        const s = getEffectiveSortie(a.name, weekStart, c.s);
        return {
          fiche_type: MATERIEL_FICHE_TYPE,
          week_start: weekStart,
          day_of_week: "Lundi",
          row_index: idx,
          article: a.name,
          stock_initial: si,
          entrees: e,
          sorties: s,
          quantity: si + e - s,
        };
      });
      const { error } = await supabase
        .from("weekly_tracking")
        .upsert(payload, { onConflict: "fiche_type,week_start,day_of_week,row_index,article" });
      if (error) throw error;
      toast.success("Suivi matériel enregistré");
      await load();
    } catch (e: any) {
      toast.error("Erreur d'enregistrement", { description: e?.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Suivi matériel — semaine du {formatDateFR(weekStart)}</h3>
            <p className="text-xs text-muted-foreground">
              SI (lundi), Entrées et Sorties modifiables pour toutes les semaines. Restant = SI + E − S.
            </p>
          </div>
          {(editable || siEditable) && (
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              <th className="p-2 text-left w-10">#</th>
              <th className="p-2 text-left">Article</th>
              <th className="p-2 text-right w-24">SI (lundi)</th>
              <th className="p-2 text-right w-24 text-success">Entrées</th>
              <th className="p-2 text-right w-24 text-destructive">Sorties</th>
              <th className="p-2 text-right w-24">Restant</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">Chargement…</td>
              </tr>
            ) : (
              MATERIEL_ARTICLES.map((a, idx) => {
                const c = local[a.name] ?? { si: "", e: "", s: "" };
                const sortie = getEffectiveSortie(a.name, weekStart, c.s);
                const restant = num(c.si) + num(c.e) - sortie;
                return (
                  <tr key={a.name} className="border-t">
                    <td className="p-2 text-muted-foreground tabular-nums">{idx + 1}</td>
                    <td className="p-2">{a.name}</td>
                    <td className="p-2 text-right">
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="h-8 w-20 ml-auto text-right tabular-nums"
                        value={c.si}
                        onChange={(ev) => setLocal((p) => ({ ...p, [a.name]: { ...c, si: ev.target.value } }))}
                        disabled={!siEditable}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="h-8 w-20 ml-auto text-right tabular-nums bg-success/5"
                        value={c.e}
                        onChange={(ev) => setLocal((p) => ({ ...p, [a.name]: { ...c, e: ev.target.value } }))}
                        disabled={!editable}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="h-8 w-20 ml-auto text-right tabular-nums bg-destructive/5"
                        value={fmtQty(sortie)}
                        onChange={(ev) => setLocal((p) => ({ ...p, [a.name]: { ...c, s: ev.target.value } }))}
                        disabled={!editable}
                      />
                    </td>
                    <td className="p-2 text-right tabular-nums font-semibold">
                      {Math.round(restant * 100) / 100}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {historyWeeks.length > 0 && (
        <div className="bg-card rounded-lg border">
          <div className="px-4 py-2 border-b bg-muted/50">
            <h4 className="font-semibold text-sm">Historique — semaines précédentes</h4>
          </div>
          <div className="divide-y">
            {historyWeeks.map((wk) => {
              const wkRows = rows.filter((r) => r.week_start === wk);
              const byArt = new Map(wkRows.map((r) => [r.article, r] as const));
              return (
                <details key={wk} className="p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Semaine du {formatDateFR(wk)} — {wkRows.length} lignes
                  </summary>
                  <div className="mt-2 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-1.5 text-left">Article</th>
                          <th className="p-1.5 text-right w-16">SI</th>
                          <th className="p-1.5 text-right w-16 text-success">E</th>
                          <th className="p-1.5 text-right w-16 text-destructive">S</th>
                          <th className="p-1.5 text-right w-16">Restant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MATERIEL_ARTICLES.map((a) => {
                          const r = byArt.get(a.name);
                          const autoSortie = getAutoSortie(a.name, wk);
                          const sortie = autoSortie ?? r?.sorties ?? 0;
                          const restant = r
                            ? ((r.stock_initial ?? r.quantity ?? 0) + (r.entrees ?? 0) - sortie)
                            : 0;
                          return (
                            <tr key={a.name} className="border-t">
                              <td className="p-1.5">{a.name}</td>
                              <td className="p-1.5 text-right tabular-nums">{r?.stock_initial ?? "—"}</td>
                              <td className="p-1.5 text-right tabular-nums text-success">{r?.entrees ?? "—"}</td>
                              <td className="p-1.5 text-right tabular-nums text-destructive">{r ? fmtQty(sortie) : "—"}</td>
                              <td className="p-1.5 text-right tabular-nums font-semibold">
                                {r ? fmtQty(restant) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}