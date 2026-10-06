import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateFR } from "@/lib/utils";
import { shiftDate } from "@/lib/ecartRatio";
import {
  PRODUITS,
  addArticle,
  computeProduitDay,
  deleteArticle,
  emptyDay,
  fetchArticles,
  fetchProduitDays,
  hasFinal,
  lastFinal,
  saveProduitDay,
  updateArticle,
  type Part,
  type ProduitDay,
  type ProduitKey,
  type SaleArticle,
  type Zone,
} from "@/lib/ecartProduit";

const today = () => new Date().toISOString().slice(0, 10);
const ZONES: { key: Zone; label: string }[] = [
  { key: "EMP", label: "Emporter" },
  { key: "SP", label: "Salle / Surplace" },
];
const fmt = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(v);

export function EcartProduitModule({ product }: { product: ProduitKey }) {
  const { can, isAdmin, isRegionalAdmin } = useAuth();
  const canEdit = can("edit_ecarts") || isAdmin || isRegionalAdmin;
  const cfg = PRODUITS[product];

  const [date, setDate] = useState(today());
  const [day, setDay] = useState<ProduitDay>(emptyDay());
  const [prev, setPrev] = useState<ProduitDay | undefined>();
  const [articles, setArticles] = useState<SaleArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newArt, setNewArt] = useState<Record<Zone, { name: string; dose: string }>>({
    EMP: { name: "", dose: "" },
    SP: { name: "", dose: "" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hist, arts] = await Promise.all([fetchProduitDays(product, shiftDate(date, -60), date), fetchArticles()]);
      setArticles(arts.filter((a) => a.product === product));
      setDay(hist.get(date) ?? emptyDay());
      setPrev(lastFinal(hist, date));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [product, date]);

  useEffect(() => {
    load();
  }, [load]);

  const result = useMemo(() => computeProduitDay(product, day, prev, articles), [product, day, prev, articles]);
  const siAuto = hasFinal(prev);

  const setPart = (part: Part, zone: Zone, raw: string) =>
    setDay((d) => ({ ...d, [part]: { ...d[part], [zone]: raw === "" ? null : Number(raw.replace(",", ".")) } }));

  const save = async () => {
    setSaving(true);
    try {
      await saveProduitDay(product, date, day);
      toast.success("Enregistré");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const createArticle = async (zone: Zone) => {
    const a = newArt[zone];
    const dose = Number(a.dose.replace(",", "."));
    if (!a.name.trim() || !Number.isFinite(dose) || dose <= 0) {
      toast.error("Nom et dose obligatoires");
      return;
    }
    try {
      await addArticle({ product, zone, name: a.name.trim(), dose, sort_order: articles.length });
      setNewArt((s) => ({ ...s, [zone]: { name: "", dose: "" } }));
      setArticles((await fetchArticles()).filter((x) => x.product === product));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeArticle = async (a: SaleArticle) => {
    if (!confirm(`Supprimer l'article « ${a.name} » ?`)) return;
    try {
      await deleteArticle(a.id);
      setArticles((s) => s.filter((x) => x.id !== a.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const changeDose = async (a: SaleArticle, raw: string) => {
    const dose = Number(raw.replace(",", "."));
    if (!Number.isFinite(dose) || dose === a.dose) return;
    try {
      await updateArticle(a.id, { dose });
      setArticles((s) => s.map((x) => (x.id === a.id ? { ...x, dose } : x)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const numInput = (value: number | null, onChange: (v: string) => void, disabled = false) => (
    <Input
      type="number"
      inputMode="decimal"
      step="any"
      className="h-8 w-28 text-right"
      value={value ?? ""}
      disabled={!canEdit || disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-44" />
        </div>
        {canEdit && (
          <Button onClick={save} disabled={saving || loading} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              ["Stock initial", result.si],
              ["Entrées", result.entrees],
              ["Stock final", result.sf],
              ["Consommation", result.conso],
              ["Ventes", result.ventes],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-md border bg-card p-3">
                <div className="text-xs text-muted-foreground">{l}</div>
                <div className="text-lg font-semibold">{fmt(v as number)} {cfg.calcUnit}</div>
              </div>
            ))}
          </div>
          <div className={`rounded-md border p-3 ${result.ecart < 0 ? "border-destructive bg-destructive/10" : "bg-primary/5"}`}>
            <div className="text-xs text-muted-foreground">Écart {cfg.label} du {formatDateFR(date)} (Ventes − Consommation)</div>
            <div className={`text-2xl font-bold ${result.ecart < 0 ? "text-destructive" : "text-primary"}`}>
              {fmt(result.ecart)} {cfg.calcUnit}
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Saisie ({cfg.inputUnit})</th>
                  {ZONES.map((z) => <th key={z.key} className="text-right p-2">{z.label}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="p-2">Stock initial {siAuto && <span className="text-xs text-muted-foreground">(stock final de la veille)</span>}</td>
                  {ZONES.map((z) => (
                    <td key={z.key} className="p-2 text-right">
                      <div className="flex justify-end">
                        {numInput(siAuto ? prev!.SF[z.key] : day.SI[z.key], (v) => setPart("SI", z.key, v), siAuto)}
                      </div>
                    </td>
                  ))}
                </tr>
                {(["ENTREE", "SF"] as Part[]).map((p) => (
                  <tr key={p} className="border-t">
                    <td className="p-2">{p === "ENTREE" ? "Entrées" : "Stock final"}</td>
                    {ZONES.map((z) => (
                      <td key={z.key} className="p-2">
                        <div className="flex justify-end">{numInput(day[p][z.key], (v) => setPart(p, z.key, v))}</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {product === "CAFE" && (
              <p className="p-2 text-xs text-muted-foreground">Le café se saisit en kg ; il est converti automatiquement en grammes pour le calcul.</p>
            )}
          </div>

          {ZONES.map((z) => {
            const list = articles.filter((a) => a.zone === z.key);
            return (
              <div key={z.key} className="rounded-md border overflow-x-auto">
                <div className="p-2 font-medium bg-muted/50">Ventes {z.label}</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-left p-2">Article</th>
                      <th className="text-right p-2">Dose ({cfg.doseUnit})</th>
                      <th className="text-right p-2">Qté vendue</th>
                      <th className="text-right p-2">Total ({cfg.calcUnit})</th>
                      {canEdit && <th className="p-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {list.length === 0 && (
                      <tr><td colSpan={5} className="p-2 text-xs text-muted-foreground">Aucun article — ajoutez-en ci-dessous.</td></tr>
                    )}
                    {list.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="p-2">{a.name}</td>
                        <td className="p-2">
                          <div className="flex justify-end">
                            <Input
                              type="number"
                              step="any"
                              defaultValue={a.dose}
                              disabled={!canEdit}
                              className="h-8 w-24 text-right"
                              onBlur={(e) => changeDose(a, e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex justify-end">
                            {numInput(day.VENTES[a.id] ?? null, (v) =>
                              setDay((d) => ({ ...d, VENTES: { ...d.VENTES, [a.id]: v === "" ? 0 : Number(v) } })),
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-right">{fmt((day.VENTES[a.id] ?? 0) * a.dose)}</td>
                        {canEdit && (
                          <td className="p-2 text-right">
                            <button onClick={() => removeArticle(a)} className="text-destructive p-1" title="Supprimer">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {canEdit && (
                      <tr className="border-t bg-muted/20">
                        <td className="p-2">
                          <Input
                            placeholder="Nouvel article"
                            value={newArt[z.key].name}
                            onChange={(e) => setNewArt((s) => ({ ...s, [z.key]: { ...s[z.key], name: e.target.value } }))}
                            className="h-8"
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex justify-end">
                            <Input
                              type="number"
                              step="any"
                              placeholder="Dose"
                              value={newArt[z.key].dose}
                              onChange={(e) => setNewArt((s) => ({ ...s, [z.key]: { ...s[z.key], dose: e.target.value } }))}
                              className="h-8 w-24 text-right"
                            />
                          </div>
                        </td>
                        <td colSpan={3} className="p-2 text-right">
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => createArticle(z.key)}>
                            <Plus className="h-4 w-4" /> Ajouter
                          </Button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export function EcartHub({ glace }: { glace: React.ReactNode }) {
  const [tab, setTab] = useState<"GLACE" | ProduitKey>("GLACE");
  const tabs: { key: "GLACE" | ProduitKey; label: string }[] = [
    { key: "GLACE", label: "Glace" },
    { key: "CAFE", label: "Café Dubois" },
    { key: "SIDIALI", label: "Sidi Ali" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "default" : "outline"} onClick={() => setTab(t.key)}>
            Écart {t.label}
          </Button>
        ))}
      </div>
      {tab === "GLACE" ? glace : <EcartProduitModule key={tab} product={tab} />}
    </div>
  );
}
