import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Combine, Send, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { requireCurrentPdvId } from "@/lib/pdvStore";
import { isProductActive } from "@/lib/stockData";
import { combineStockSources, loadCustomStockGroups, loadGroupSources, saveCustomStockGroup, type CustomStockGroup, type GroupSource } from "@/lib/customStockGroups";
import { stockReferenceQuantity } from "@/lib/stockReference";

export function CustomStockGroups({ start, end, mep, previous, references, showTotals, showRefs }: {
  start?: string; end?: string; mep: Record<string, number>; previous: Record<string, number>;
  references: Record<string, { conversion: string; unitRef: string }>; showTotals: boolean; showRefs: boolean;
}) {
  const { can } = useAuth();
  const editable = can("edit_stock");
  const [groups, setGroups] = useState<CustomStockGroup[]>([]);
  const [sources, setSources] = useState<GroupSource[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CustomStockGroup | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([loadCustomStockGroups(), loadGroupSources(start, end)])
      .then(([nextGroups, nextSources]) => { if (!cancelled) { setGroups(nextGroups); setSources(nextSources); } })
      .catch(() => { if (!cancelled) toast.error("Impossible de charger les regroupements"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [start, end]);
  const save = async (exported: boolean) => {
    if (!editable) return;
    setBusy(true);
    try {
      if (!exported && selected.length < 2) throw new Error("Sélectionnez au moins deux produits.");
      // Individual exports need no shared unit; each retains its own identity.
      if (!exported) combineStockSources(selected, sources);
      if (!exported && !name.trim()) throw new Error("Donnez un nom au regroupement.");
      const next = exported
        ? selected.map(id => ({ id: `stock-export:${requireCurrentPdvId()}:${id}`, pdv_id: requireCurrentPdvId(), name: sources.find(row => row.id === id)?.name ?? id, source_ids: [id], exported: true }))
        : [{ id: `stock-group:${crypto.randomUUID()}`, pdv_id: requireCurrentPdvId(), name: name.trim(), source_ids: [...new Set(selected)], exported: false }];
      for (const group of next) await saveCustomStockGroup(group);
      setGroups(await loadCustomStockGroups());
      setOpen(false); setSelected([]); setName("");
      toast.success(exported ? "Produits disponibles dans Recettes et Écarts ingrédients" : "Regroupement enregistré");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible"); }
    finally { setBusy(false); }
  };
  const exportGroup = async (group: CustomStockGroup) => {
    setBusy(true);
    try { await saveCustomStockGroup({ ...group, exported: true }); setGroups(await loadCustomStockGroups()); toast.success("Regroupement disponible dans Recettes et Écarts ingrédients"); }
    catch { toast.error("Export non enregistré"); }
    finally { setBusy(false); }
  };
  const totals = groups.filter(group => group.source_ids.length > 1 && group.source_ids.every(isProductActive)).map(group => {
    try { return { group, values: combineStockSources(group.source_ids, sources, mep, previous) }; }
    catch { return { group, values: null }; }
  });
  const fields: { label: string; key: "stockInitial" | "entrees" | "sorties" | "stockRestant" | "miseEnPlace" | "sortiesTotal" | "initialTotal" | "stockTotal" }[] = [
    { label: "Stock initial", key: "stockInitial" }, ...(showTotals ? [{ label: "Stock initial total", key: "initialTotal" as const }] : []),
    { label: "Entrées", key: "entrees" }, { label: "Sorties", key: "sorties" }, { label: "Stock restant", key: "stockRestant" },
    ...(showTotals ? [{ label: "Stock mise en place", key: "miseEnPlace" as const }, { label: "Sorties total", key: "sortiesTotal" as const }, { label: "Stock total", key: "stockTotal" as const }] : []),
  ];
  return <section className="border-t mt-4 py-4">
    <div className="flex flex-wrap items-center gap-2 px-4 mb-3">
      <h3 className="font-semibold mr-auto">Regroupements personnalisés</h3>
      {editable && <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Choisir des produits</Button>}
    </div>
    {loading ? <p className="px-4 text-sm text-muted-foreground">Chargement…</p> : <div className="overflow-x-auto">
      <table className="w-full text-sm"><thead className="bg-muted"><tr><th className="p-3 text-left">Produit</th><th className="p-3">Unité</th>{fields.map(field => <th key={field.key} className="p-3 text-right whitespace-nowrap">{field.label}</th>)}{showRefs && <th className="p-3 whitespace-nowrap">Sorties total Réf.</th>}<th className="p-3">Recettes / Écarts</th></tr></thead>
        <tbody>{totals.map(({ group, values }) => <tr key={group.id} className="border-b"><td className="p-3"><Button variant="link" className="p-0 h-auto text-left whitespace-normal" onClick={() => setDetail(group)}>{group.name}</Button></td><td className="p-3">{values?.unit ?? "Unités différentes"}</td>
          {fields.map(field => <td className="p-3 text-right font-mono" key={field.key}>{values?.[field.key] ?? "—"}</td>)}
          {showRefs && <td className="p-3 text-right font-mono">{values ? stockReferenceQuantity(values.sortiesTotal, references[group.id]?.conversion ?? "") ?? "—" : "—"} {references[group.id]?.unitRef}</td>}
          <td className="p-3">{group.exported ? <span className="text-success">Disponible</span> : editable && <Button size="sm" variant="outline" disabled={busy || !values} onClick={() => exportGroup(group)}><Send className="h-4 w-4 mr-1" /> Exporter</Button>}</td>
        </tr>)}</tbody></table>
    </div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Choisir des produits</DialogTitle></DialogHeader>
      <Input aria-label="Rechercher un produit à regrouper" placeholder="Rechercher un produit…" value={search} onChange={event => setSearch(event.target.value)} />
      <div className="max-h-64 overflow-y-auto space-y-2">{sources.filter(row => isProductActive(row.id) && row.name.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr"))).map(row => <label key={row.id} className="flex items-center gap-2 text-sm py-1"><Checkbox checked={selected.includes(row.id)} onCheckedChange={checked => setSelected(ids => checked ? [...ids, row.id] : ids.filter(id => id !== row.id))} /><span className="min-w-0 break-words flex-1">{row.name}</span><span className="text-muted-foreground">{row.unit}</span></label>)}</div>
      <Input aria-label="Nom du regroupement" placeholder="Nom du regroupement" value={name} onChange={event => setName(event.target.value)} />
      <div className="flex flex-wrap gap-2"><Button disabled={busy || selected.length < 2} onClick={() => save(false)}><Combine className="h-4 w-4 mr-1" /> Fusionner ({selected.length})</Button><Button variant="outline" disabled={busy || !selected.length} onClick={() => save(true)}><Send className="h-4 w-4 mr-1" /> Exporter vers Recettes / Écarts</Button></div>
    </DialogContent></Dialog>
    <Dialog open={!!detail} onOpenChange={value => { if (!value) setDetail(null); }}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Détail — {detail?.name}</DialogTitle></DialogHeader><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Source</th>{fields.map(field => <th key={field.key} className="p-2 whitespace-nowrap">{field.label}</th>)}</tr></thead><tbody>{detail?.source_ids.map(id => {
      try { const value = combineStockSources([id], sources, mep, previous); return <tr key={id} className="border-t"><td className="p-2">{value.rows[0].name}</td>{fields.map(field => <td className="p-2 text-right font-mono" key={field.key}>{value[field.key] ?? "—"}</td>)}</tr>; } catch { return <tr key={id}><td>{id} — indisponible</td></tr>; }
    })}</tbody></table></div></DialogContent></Dialog>
  </section>;
}