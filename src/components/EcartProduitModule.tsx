import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Boxes, Loader2, Package, Plus, Save, Scale, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateFR } from "@/lib/utils";
import { eachDate, monthRange, shiftDate } from "@/lib/ecartRatio";
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

type View = "initial" | "entrees" | "ventes" | "final" | "ecarts";
type Mode = "jour" | "mois" | "periode";

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

  const [view, setView] = useState<View>("ecarts");
  const [mode, setMode] = useState<Mode>("jour");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [history, setHistory] = useState<Map<string, ProduitDay>>(new Map());
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

  const range = useMemo(() => {
    if (view !== "ecarts" || mode === "jour") return { start: date, end: date };
    if (mode === "mois") return monthRange(month);
    return { start, end };
  }, [view, mode, date, month, start, end]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hist, arts] = await Promise.all([fetchProduitDays(product, shiftDate(range.start, -60), range.end), fetchArticles()]);
      setHistory(hist);
      setArticles(arts.filter((a) => a.product === product));
      setDay(hist.get(date) ?? emptyDay());
      setPrev(lastFinal(hist, date));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [product, date, range.start, range.end]);

  useEffect(() => {
    load();
  }, [load]);

  const siAuto = hasFinal(prev);

  /** Stock unique (sans séparation Salle/Emporter) : lecture = somme des deux zones, écriture sur EMP seul. */
  const partValue = (d: ProduitDay | undefined, part: Part): number | null => {
    if (!d) return null;
    const a = d[part].EMP;
    const b = d[part].SP;
    if (a === null && b === null) return null;
    return (a ?? 0) + (b ?? 0);
  };

  const setPart = (part: Part, raw: string) =>
    setDay((d) => ({ ...d, [part]: { EMP: raw === "" ? null : Number(raw.replace(",", ".")), SP: null } }));

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

  const rows = eachDate(range.start, range.end)
    .filter((d) => history.has(d))
    .map((d) => ({ date: d, ...computeProduitDay(product, history.get(d) ?? emptyDay(), lastFinal(history, d), articles) }));
  const sum = rows.reduce((acc, row) => ({
    conso: acc.conso + row.conso, ventes: acc.ventes + row.ventes, ecart: acc.ecart + row.ecart,
  }), { conso: 0, ventes: 0, ecart: 0 });

  const numInput = (value: number | null, onChange: (v: string) => void, label: string, disabled = false) => (
    <Input type="number" inputMode="decimal" step="any" aria-label={label}
      className="h-auto w-24 rounded px-1.5 py-1 text-right bg-background"
      value={value === 0 || value === null ? "" : value} disabled={!canEdit || disabled}
      onChange={(e) => onChange(e.target.value)} />
  );

  const stat = (label: string, value: number, strong = false) => (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${strong ? "font-bold" : "font-medium"} ${strong && value < 0 ? "text-destructive" : ""}`}>
        {fmt(value)} {cfg.calcUnit}
      </span>
    </div>
  );

  const stockTable = (part: Part, title: string) => {
    const locked = part === "SI" && siAuto;
    const value = locked ? partValue(prev, "SF") : partValue(day, part);
    return (
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/50"><h3 className="font-semibold text-sm">{title}</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead className="bg-muted/30"><tr>
              <th className="px-2 py-1.5 text-left">Article</th>
              <th className="px-2 py-1.5 text-right">{cfg.inputUnit === "kg" ? "Kilogrammes" : "Bouteilles"}</th>
            </tr></thead>
            <tbody><tr className="border-t">
              <td className="px-2 py-1 whitespace-nowrap font-medium">{cfg.label}</td>
              <td className="px-1 py-1"><div className="flex justify-end">
                {numInput(value, (v) => setPart(part, v), `${title} (${cfg.inputUnit})`, locked)}
              </div></td>
            </tr><tr className="border-t bg-muted/40 font-semibold">
              <td className="px-2 py-2">TOTAL</td><td className="px-2 py-2 text-right tabular-nums">{fmt(value ?? 0)} {cfg.inputUnit}</td>
            </tr></tbody>
          </table>
        </div>
      </div>
    );
  };

  const salesTable = (zone: typeof ZONES[number]) => {
    const list = articles.filter((a) => a.zone === zone.key);
    const totalQty = list.reduce((n, a) => n + (day.VENTES[a.id] ?? 0), 0);
    const total = list.reduce((n, a) => n + (day.VENTES[a.id] ?? 0) * a.dose, 0);
    return (
      <div key={zone.key} className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/50"><h3 className="font-semibold text-sm">Ventes {zone.label}</h3></div>
        <div className="overflow-x-auto"><table className="w-full text-xs sm:text-sm border-collapse">
          <thead className="bg-muted/30"><tr>
            <th className="px-2 py-1.5 text-left">Article</th>
            <th className="px-2 py-1.5 text-right">{product === "CAFE" ? "Grammage (g)" : "Dose (bouteilles)"}</th>
            <th className="px-2 py-1.5 text-right">Quantité</th>
            <th className="px-2 py-1.5 text-right">Total ({cfg.calcUnit})</th>
            {canEdit && <th className="px-2 py-1.5"><span className="sr-only">Actions</span></th>}
          </tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="px-3 py-8 text-center text-muted-foreground">Aucun article.</td></tr>}
            {list.map((a) => <tr key={a.id} className="border-t">
              <td className="px-2 py-1 whitespace-nowrap font-medium">{a.name}</td>
              <td className="px-1 py-1"><Input type="number" step="any" defaultValue={a.dose} disabled={!canEdit}
                aria-label={`Dose ${a.name} ${zone.label}`} className="h-auto w-24 rounded px-1.5 py-1 text-right bg-background"
                onBlur={(e) => changeDose(a, e.target.value)} /></td>
              <td className="px-1 py-1">{numInput(day.VENTES[a.id] ?? null, (v) =>
                setDay((d) => ({ ...d, VENTES: { ...d.VENTES, [a.id]: v === "" ? 0 : Number(v.replace(",", ".")) } })),
                `Quantité ${a.name} ${zone.label}`)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{fmt((day.VENTES[a.id] ?? 0) * a.dose)}</td>
              {canEdit && <td className="px-1 py-1"><Button size="icon" variant="ghost" title={`Supprimer ${a.name}`}
                aria-label={`Supprimer ${a.name}`} className="h-8 w-8 text-destructive" onClick={() => removeArticle(a)}><Trash2 className="h-4 w-4" /></Button></td>}
            </tr>)}
            <tr className="border-t bg-muted/40 font-semibold">
              <td className="px-2 py-2">TOTAL</td><td /><td className="px-2 py-2 text-right tabular-nums">{fmt(totalQty)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmt(total)} {cfg.calcUnit}</td>{canEdit && <td />}
            </tr>
            {canEdit && <tr className="border-t">
              <td className="px-2 py-2"><Input placeholder="Nouvel article" aria-label={`Nouvel article ${zone.label}`} value={newArt[zone.key].name}
                onChange={(e) => setNewArt((s) => ({ ...s, [zone.key]: { ...s[zone.key], name: e.target.value } }))} className="h-8 min-w-32" /></td>
              <td className="px-1 py-2"><Input type="number" step="any" placeholder="Dose" aria-label={`Nouvelle dose ${zone.label}`} value={newArt[zone.key].dose}
                onChange={(e) => setNewArt((s) => ({ ...s, [zone.key]: { ...s[zone.key], dose: e.target.value } }))} className="h-8 w-24 text-right" /></td>
              <td colSpan={3} className="px-2 py-2 text-right"><Button size="sm" variant="outline" className="gap-1" onClick={() => createArticle(zone.key)}><Plus className="h-4 w-4" /> Ajouter</Button></td>
            </tr>}
          </tbody>
        </table></div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-xl p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /> Calcul des écarts — {cfg.label}</h2>
        <div className="flex flex-wrap gap-2">
          {([
            ["initial", "Stock initial", Boxes], ["entrees", "Entrées", Package], ["ventes", "Ventes", ShoppingCart],
            ["final", "Stock final", Boxes], ["ecarts", "Écarts", Scale],
          ] as const).map(([id, label, Icon]) => <Button key={id} variant={view === id ? "default" : "outline"}
            onClick={() => setView(id)} className="gap-2 px-3 py-2 rounded-lg text-sm"><Icon className="h-4 w-4" />{label}</Button>)}
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          {view === "ecarts" && <div><label className="block text-xs text-muted-foreground mb-1" htmlFor="ecart-mode">Période</label>
            <select id="ecart-mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="border rounded-lg px-2 py-1.5 text-sm bg-background">
              <option value="jour">Jour</option><option value="mois">Mois</option><option value="periode">Période</option>
            </select></div>}
          {(view !== "ecarts" || mode === "jour") && <div><label htmlFor="ecart-date" className="block text-xs text-muted-foreground mb-1">Date</label>
            <Input id="ecart-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-auto w-auto rounded-lg px-2 py-1.5" /></div>}
          {view === "ecarts" && mode === "mois" && <div><label htmlFor="ecart-month" className="block text-xs text-muted-foreground mb-1">Mois</label>
            <Input id="ecart-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-auto w-auto rounded-lg px-2 py-1.5" /></div>}
          {view === "ecarts" && mode === "periode" && <>
            <div><label htmlFor="ecart-start" className="block text-xs text-muted-foreground mb-1">Du</label><Input id="ecart-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-auto w-auto rounded-lg px-2 py-1.5" /></div>
            <div><label htmlFor="ecart-end" className="block text-xs text-muted-foreground mb-1">Au</label><Input id="ecart-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-auto w-auto rounded-lg px-2 py-1.5" /></div>
          </>}
          {view !== "ecarts" && canEdit && <Button onClick={save} disabled={saving || loading} className="ml-auto gap-2 rounded-lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
          </Button>}
        </div>
      </div>
      {loading ? <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
        : view === "ventes" ? <div className="grid gap-4 lg:grid-cols-2">{ZONES.map(salesTable)}</div>
        : view === "initial" || view === "entrees" || view === "final" ? <div className="space-y-4">
          {stockTable(
            view === "initial" ? "SI" : view === "entrees" ? "ENTREE" : "SF",
            view === "initial" ? "Stock initial" : view === "entrees" ? "Entrées" : "Stock final",
          )}
          <div className="bg-card border rounded-xl p-4 shadow-sm text-sm">
            {stat(`Total ${view === "initial" ? "stock initial" : view === "entrees" ? "entrées" : "stock final"} (${cfg.calcUnit})`,
              (partValue(view === "initial" && siAuto ? prev : day, view === "initial" ? (siAuto ? "SF" : "SI") : view === "entrees" ? "ENTREE" : "SF") ?? 0) * cfg.factor, true)}
          </div>
        </div> : <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">{[
            { label: "Consommation", value: sum.conso }, { label: "Ventes", value: sum.ventes }, { label: "Écart", value: sum.ecart, strong: true },
          ].map((b) => <div key={b.label} className="bg-card border rounded-xl p-4 shadow-sm text-sm"><h3 className="font-semibold mb-2">{b.label}</h3>{stat(`${b.label} (${cfg.calcUnit})`, b.value, b.strong)}</div>)}</div>
          <div className="bg-card border rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-xs sm:text-sm border-collapse min-w-[400px]">
              <thead className="bg-muted/60"><tr>
                <th className="sticky left-0 z-10 bg-muted/60 px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-right">Consommation ({cfg.calcUnit})</th><th className="px-2 py-2 text-right">Ventes ({cfg.calcUnit})</th><th className="px-2 py-2 text-right">Écart ({cfg.calcUnit})</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Aucune saisie sur la période.</td></tr>}
                {rows.map((r) => <tr key={r.date} className="border-t">
                  <td className="sticky left-0 z-10 bg-card px-2 py-1 whitespace-nowrap">{formatDateFR(r.date)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(r.conso)}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.ventes)}</td>
                  <td className={`px-2 py-1 text-right tabular-nums font-bold ${r.ecart < 0 ? "text-destructive" : ""}`}>{fmt(r.ecart)}</td>
                </tr>)}
                {rows.length > 0 && <tr className="border-t bg-muted/40 font-semibold"><td className="sticky left-0 z-10 bg-muted/40 px-2 py-2">Total</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(sum.conso)}</td><td className="px-2 py-2 text-right tabular-nums">{fmt(sum.ventes)}</td><td className="px-2 py-2 text-right tabular-nums">{fmt(sum.ecart)}</td>
                </tr>}
              </tbody>
            </table>
          </div>
        </div>}
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
