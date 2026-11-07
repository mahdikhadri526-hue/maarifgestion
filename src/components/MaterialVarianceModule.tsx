import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, RefreshCw, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { computeMaterialVariance } from "@/lib/materialVariance";
import { loadMaterialAnalysis, saveMaterialSales } from "@/lib/materialVarianceData";
import { isProductActive } from "@/lib/stockData";
import { formatISODate } from "@/lib/stockWeeklyAggregates";

const categoryLabels: Record<string, string> = { surplace: "Sur place", emporter: "Emporter", tartes: "Tartes", autres: "Autres", alimentaire: "Alimentaire", emballage: "Emballage" };
const number = (value: number | null) => value === null ? "—" : value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });

export function MaterialVarianceModule() {
  const { pdvId, pdv, can } = useAuth();
  const today = formatISODate(new Date());
  const [start, setStart] = useState(`${today.slice(0, 7)}-01`);
  const [end, setEnd] = useState(today);
  const [period, setPeriod] = useState({ start: `${today.slice(0, 7)}-01`, end: today });
  const [data, setData] = useState<Awaited<ReturnType<typeof loadMaterialAnalysis>> | null>(null);
  const [sales, setSales] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState("sales");
  const canEdit = can("edit_ecarts");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setData(null); setSales({}); setDirty(false);
    loadMaterialAnalysis(period.start, period.end).then(result => {
      if (cancelled) return;
      setData(result); setSales(result.sales);
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Chargement impossible.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period, pdvId, revision]);

  const result = useMemo(() => data ? computeMaterialVariance(data.recipes, data.ingredients, sales, data.actuals).filter(row => isProductActive(row.id.split(":")[0])) : [], [data, sales]);
  const products = useMemo(() => data?.products.filter(product => product.active && (category === "all" || product.category === category) && product.name.toLowerCase().includes(search.toLowerCase())) ?? [], [data, category, search]);
  const rows = result.filter(row => (category === "all" || row.category === category) && row.name.toLowerCase().includes(search.toLowerCase()));
  const recipeIds = new Set(data?.recipes.map(recipe => recipe.finished_product_id));
  const unavailable = result.filter(row => row.issue).length;

  const changePeriod = () => {
    if (!start || !end || start > end) { toast.error("Choisissez une période valide."); return; }
    if (dirty && !window.confirm("Les ventes ne sont pas enregistrées. Changer de période ?")) return;
    setPeriod({ start, end });
  };
  const save = async () => {
    setSaving(true);
    try { await saveMaterialSales(period.start, period.end, sales); setDirty(false); toast.success("Ventes enregistrées"); }
    catch (reason) { toast.error("Enregistrement impossible", { description: reason instanceof Error ? reason.message : "Réessayez." }); }
    finally { setSaving(false); }
  };

  return <div className="space-y-5 min-w-0">
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1 min-w-0"><Label htmlFor="materials-start">Du</Label><Input id="materials-start" type="date" className="w-40 max-w-full" value={start} onChange={event => setStart(event.target.value)} /></div>
      <div className="space-y-1 min-w-0"><Label htmlFor="materials-end">Au</Label><Input id="materials-end" type="date" className="w-40 max-w-full" value={end} onChange={event => setEnd(event.target.value)} /></div>
      <Button onClick={changePeriod} disabled={loading || saving}>Appliquer</Button>
      <Button variant="outline" size="icon" title="Actualiser" aria-label="Actualiser l’analyse" disabled={loading || saving} onClick={() => { if (!dirty || window.confirm("Actualiser sans enregistrer les ventes ?")) setRevision(value => value + 1); }}><RefreshCw className="h-4 w-4" /></Button>
      <span className="text-sm text-muted-foreground sm:ml-auto">{pdv?.name}</span>
    </div>
    {loading ? <p role="status" className="py-10 text-center text-muted-foreground">Chargement de l’analyse…</p> : error ? <p role="alert" className="text-destructive">{error}</p> : data && <Tabs value={view} onValueChange={value => { setView(value); setCategory("all"); setSearch(""); }}>
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <TabsList><TabsTrigger value="sales">Ventes</TabsTrigger><TabsTrigger value="analysis">Écarts matières</TabsTrigger></TabsList>
        {canEdit && <Button onClick={save} disabled={saving || !dirty}><Save className="h-4 w-4 mr-2" />{saving ? "Enregistrement…" : "Enregistrer les ventes"}</Button>}
      </div>
      <div className="flex flex-wrap gap-3 my-4">
        <div className="relative flex-1 min-w-[160px]"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Rechercher un produit ou ingrédient" placeholder="Rechercher" value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div>
        <Select value={category} onValueChange={setCategory}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes les catégories</SelectItem>{(view === "sales" ? ["surplace", "emporter", "tartes", "autres"] : ["alimentaire", "emballage"]).map(key => <SelectItem key={key} value={key}>{categoryLabels[key]}</SelectItem>)}</SelectContent></Select>
      </div>
      <TabsContent value="sales">
        <div className="overflow-x-auto border rounded-lg"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="p-3 text-left">Produit</th><th className="p-3 text-left">Catégorie</th><th className="p-3 text-right">Quantité vendue</th></tr></thead><tbody>{products.map(product => <tr key={product.id} className="border-t even:bg-muted/30"><td className="p-3 min-w-36 font-medium">{product.name}{!recipeIds.has(product.id) && <span className="block text-xs text-destructive">Recette active manquante</span>}</td><td className="p-3 whitespace-nowrap text-muted-foreground">{categoryLabels[product.category ?? "autres"] ?? product.category}</td><td className="p-3"><Input aria-label={`Quantité vendue ${product.name} ${product.category}`} type="number" inputMode="decimal" min={0} step="any" className="w-28 ml-auto text-right tabular-nums" disabled={!canEdit || saving} value={sales[product.id] ?? ""} placeholder="0" onChange={event => { const quantity = Number(event.target.value); if (Number.isFinite(quantity) && quantity >= 0) { setSales(previous => ({ ...previous, [product.id]: quantity })); setDirty(true); } }} /></td></tr>)}</tbody></table>{!products.length && <p className="py-8 text-center text-muted-foreground">Aucun produit</p>}</div>
      </TabsContent>
      <TabsContent value="analysis" className="space-y-3">
        <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><span>{result.length} ingrédients · {Object.values(sales).reduce((sum, qty) => sum + qty, 0)} ventes{dirty ? " · Non enregistrées" : ""}</span><span>Écart = Réelle − Théorique</span></div>
        {unavailable > 0 && <p className="flex items-start gap-2 text-sm text-warning"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{unavailable} ingrédients : comparaison indisponible (liaison au stock ou unités à vérifier).</p>}
        <div className="overflow-x-auto border rounded-lg"><table className="w-full text-sm min-w-[760px]"><thead className="bg-muted"><tr><th className="sticky left-0 z-10 bg-muted p-3 text-left w-48">Produit / Ingrédient</th><th className="p-3 text-left">Catégorie</th><th className="p-3 text-right">Utilisation réelle</th><th className="p-3 text-right">Utilisation théorique</th><th className="p-3 text-right">Écart</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t even:bg-muted/30"><td className="sticky left-0 bg-card z-10 p-3 font-medium max-w-48 break-words">{row.name}{row.issue && <span className="block text-xs text-warning font-normal">{row.issue}</span>}</td><td className="p-3 text-muted-foreground">{categoryLabels[row.category] ?? row.category}</td><td className="p-3 text-right tabular-nums whitespace-nowrap">{number(row.actual)} <span className="text-xs text-muted-foreground">{row.actualUnit}</span></td><td className="p-3 text-right tabular-nums whitespace-nowrap">{number(row.theoretical)} <span className="text-xs text-muted-foreground">{row.unit}</span></td><td className={`p-3 text-right tabular-nums font-semibold whitespace-nowrap ${row.variance !== null && row.variance > 0 ? "text-destructive" : row.variance !== null && row.variance < 0 ? "text-success" : "text-muted-foreground"}`}>{row.variance !== null && row.variance > 0 ? "+" : ""}{number(row.variance)} {row.variance !== null && <span className="text-xs">{row.actualUnit}</span>}</td></tr>)}</tbody></table>{!rows.length && <p className="py-8 text-center text-muted-foreground">Aucun ingrédient</p>}</div>
      </TabsContent>
    </Tabs>}
  </div>;
}