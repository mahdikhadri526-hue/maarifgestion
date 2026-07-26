import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateFR } from "@/lib/utils";

// Liste par défaut des matériels, dans l'ordre du fichier source.
// Les quantités par défaut ne servent qu'au pré-remplissage initial et
// sont ignorées si une valeur a déjà été saisie pour la semaine.
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

type Row = {
  id?: string;
  week_start: string;
  article: string;
  row_index: number;
  quantity: number | null;
  visa_operateur?: string | null;
  updated_at?: string;
};

export function MaterielTracking({ weekStart }: { weekStart: string }) {
  const { can } = useAuth();
  const canEdit = can("edit_weekly");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<Record<string, string>>({});

  const todayIso = fmt(new Date());
  const weekEnd = sundayIso(weekStart);
  const isCurrentWeek = todayIso >= weekStart && todayIso <= weekEnd;
  const editable = canEdit && isCurrentWeek;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("weekly_tracking")
          .select("id, week_start, article, row_index, quantity, visa_operateur, updated_at")
          .eq("fiche_type", MATERIEL_FICHE_TYPE)
          .order("week_start", { ascending: false });
        if (error) throw error;
        setRows((data as any) || []);
      } catch (e: any) {
        toast.error("Erreur de chargement", { description: e?.message ?? String(e) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const currentByArticle = useMemo(() => {
    const m = new Map<string, Row>();
    rows.filter((r) => r.week_start === weekStart).forEach((r) => m.set(r.article, r));
    return m;
  }, [rows, weekStart]);

  useEffect(() => {
    const next: Record<string, string> = {};
    MATERIEL_ARTICLES.forEach((a) => {
      const existing = currentByArticle.get(a.name);
      if (existing && existing.quantity !== null && existing.quantity !== undefined) {
        next[a.name] = String(existing.quantity);
      } else {
        next[a.name] = "";
      }
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

  const handleSave = async () => {
    if (!editable) return;
    setSaving(true);
    try {
      const payload = MATERIEL_ARTICLES.map((a, idx) => {
        const raw = local[a.name];
        const qty = raw === "" || raw == null ? 0 : Number(raw);
        return {
          fiche_type: MATERIEL_FICHE_TYPE,
          week_start: weekStart,
          day_of_week: "Dimanche",
          row_index: idx,
          article: a.name,
          quantity: isNaN(qty) ? 0 : qty,
        };
      });
      const { error } = await supabase
        .from("weekly_tracking")
        .upsert(payload, { onConflict: "fiche_type,week_start,day_of_week,row_index,article" });
      if (error) throw error;
      toast.success("Suivi matériel enregistré");
      // refresh
      const { data } = await supabase
        .from("weekly_tracking")
        .select("id, week_start, article, row_index, quantity, visa_operateur, updated_at")
        .eq("fiche_type", MATERIEL_FICHE_TYPE)
        .order("week_start", { ascending: false });
      setRows((data as any) || []);
    } catch (e: any) {
      toast.error("Erreur d'enregistrement", { description: e?.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border p-4 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Suivi matériel — dimanche {formatDateFR(weekEnd)}</h3>
            <p className="text-xs text-muted-foreground">
              Comptage hebdomadaire (chaque dimanche). {editable ? "Semaine en cours modifiable." : "Semaine passée — lecture seule."}
            </p>
          </div>
          {editable && (
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
              <th className="p-2 text-left w-12">#</th>
              <th className="p-2 text-left">Article</th>
              <th className="p-2 text-right w-32">Quantité</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="p-6 text-center text-muted-foreground">Chargement…</td>
              </tr>
            ) : (
              MATERIEL_ARTICLES.map((a, idx) => (
                <tr key={a.name} className="border-t">
                  <td className="p-2 text-muted-foreground tabular-nums">{idx + 1}</td>
                  <td className="p-2">{a.name}</td>
                  <td className="p-2 text-right">
                    <Input
                      type="number"
                      inputMode="decimal"
                      className="h-8 w-24 ml-auto text-right tabular-nums"
                      value={local[a.name] ?? ""}
                      onChange={(e) => setLocal((prev) => ({ ...prev, [a.name]: e.target.value }))}
                      disabled={!editable}
                    />
                  </td>
                </tr>
              ))
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
              const byArt = new Map(wkRows.map((r) => [r.article, r.quantity ?? 0] as const));
              return (
                <details key={wk} className="p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Dimanche {formatDateFR(sundayIso(wk))} — {wkRows.length} lignes
                  </summary>
                  <div className="mt-2 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-1.5 text-left">Article</th>
                          <th className="p-1.5 text-right w-24">Quantité</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MATERIEL_ARTICLES.map((a) => (
                          <tr key={a.name} className="border-t">
                            <td className="p-1.5">{a.name}</td>
                            <td className="p-1.5 text-right tabular-nums">
                              {byArt.has(a.name) ? byArt.get(a.name) : "—"}
                            </td>
                          </tr>
                        ))}
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