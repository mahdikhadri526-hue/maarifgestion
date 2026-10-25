import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db";
import { Category, getProducts, getProductCatalog, getProductPackOptions, getProductUnitConfigs, setProductUnitConfig, removeBaseProductPack, DEFAULT_UNIT_CONFIG, addProductPackOption, updateProductPackOption, deleteProductPackOption, type ProductPackOption, type ProductUnitConfig, getProductUnits, setProductUnit, type UnitType } from "@/lib/stockData";
import { loadProductCatalog, newCustomProductId, setProductActive } from "@/lib/productCatalog";
import { isProductActive } from "@/lib/stockData";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onChanged?: () => void;
  /** Catégorie sélectionnée dans l'écran parent (filtre initial du catalogue). */
  category?: Category | "all";
  /** Mode admin : seul le conditionnement est modifiable (nom, ajout et suppression masqués). */
  conditionnementOnly?: boolean;
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function ProductCatalogManager({ onChanged, category = "all", conditionnementOnly = false }: Props) {
  const { can, hasAdminRole } = useAuth();
  const canEdit = conditionnementOnly ? hasAdminRole : can("edit_products");
  const canDelete = can("delete_products");
  const canView = canEdit || canDelete || can("view_products");

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<Category | "all">(category);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { name: string; conditionnement: string }>>({});
  const [newProduct, setNewProduct] = useState<{ name: string; conditionnement: string; category: Category }>({
    name: "",
    conditionnement: "",
    category: category === "emballage" ? "emballage" : "alimentaire",
  });


  const [dirty, setDirty] = useState(false);

  // Conditionnements supplementaires (ex: « Paquet de 16 ») — mode admin uniquement.
  const [packs, setPacks] = useState<Record<string, ProductPackOption[]>>({});
  const [packsFor, setPacksFor] = useState<{ id: string; name: string } | null>(null);
  const [newPack, setNewPack] = useState<{ label: string; pieces: string }>({ label: "", pieces: "" });
  const [packDrafts, setPackDrafts] = useState<Record<string, { label: string; pieces: string }>>({});
  const [unitConfigs, setUnitConfigs] = useState<Record<string, ProductUnitConfig>>({});
  const [basePackDraft, setBasePackDraft] = useState<ProductUnitConfig>(DEFAULT_UNIT_CONFIG);
  const [productUnits, setProductUnits] = useState<Record<string, UnitType>>({});

  const changeUnit = async (unit: UnitType) => {
    if (!hasAdminRole || !packsFor) return;
    setBusy(true);
    try {
      await setProductUnit(packsFor.id, unit);
      setProductUnits(u => ({ ...u, [packsFor.id]: unit }));
      setDirty(true);
      toast.success("Unité enregistrée");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally { setBusy(false); }
  };

  const reloadPacks = useCallback(async () => {
    const [options, configs, units] = await Promise.all([getProductPackOptions(), getProductUnitConfigs(), getProductUnits()]);
    setProductUnits(units);
    setPacks(options);
    setUnitConfigs(configs);
  }, []);

  useEffect(() => {
    if (open && conditionnementOnly) void reloadPacks();
  }, [open, conditionnementOnly, reloadPacks]);

  const addPack = async () => {
    if (!packsFor || !hasAdminRole) return;
    const label = newPack.label.trim();
    const pieces = Number(newPack.pieces);
    if (!label || !pieces || pieces < 1) {
      toast.error("Nom et nombre de pièces obligatoires");
      return;
    }
    setBusy(true);
    try {
      await addProductPackOption(packsFor.id, label, pieces);
      setNewPack({ label: "", pieces: "" });
      await reloadPacks();
      setDirty(true);
      toast.success("Conditionnement ajouté");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'ajout");
    } finally {
      setBusy(false);
    }
  };

  const removePack = async (packId: string) => {
    if (!hasAdminRole) return;
    if (!confirm("Supprimer ce conditionnement ? Le produit et son historique seront conservés.")) return;
    setBusy(true);
    try {
      await deleteProductPackOption(packId);
      await reloadPacks();
      setDirty(true);
      toast.success("Conditionnement supprimé");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la suppression");
    } finally {
      setBusy(false);
    }
  };

  const savePack = async (pack: ProductPackOption) => {
    if (!hasAdminRole) return;
    const draft = packDrafts[pack.id] ?? { label: pack.label, pieces: String(pack.piecesPerUnit) };
    setBusy(true);
    try {
      await updateProductPackOption(pack.id, draft.label, Number(draft.pieces));
      await reloadPacks();
      setDirty(true);
      setPackDrafts(d => { const next = { ...d }; delete next[pack.id]; return next; });
      toast.success("Conditionnement enregistré");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally { setBusy(false); }
  };

  const saveBasePacks = async () => {
    if (!hasAdminRole || !packsFor) return;
    if (![basePackDraft.piecesPerCarton, basePackDraft.piecesPerPaquet].every(n => Number.isInteger(n) && n >= 1)) {
      toast.error("Le nombre de pièces doit être un entier supérieur ou égal à 1");
      return;
    }
    setBusy(true);
    try {
      await setProductUnitConfig(packsFor.id, basePackDraft);
      await reloadPacks();
      setDirty(true);
      toast.success("Conditionnements enregistrés");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally { setBusy(false); }
  };

  const removeBasePack = async (kind: "paquet" | "carton") => {
    if (!hasAdminRole || !packsFor) return;
    if (!confirm(`Supprimer le format ${kind} ? Le produit et son historique seront conservés.`)) return;
    setBusy(true);
    try {
      await removeBaseProductPack(packsFor.id, kind);
      setBasePackDraft(d => ({ ...d, [kind === "paquet" ? "paquetEnabled" : "cartonEnabled"]: false }));
      await reloadPacks();
      setDirty(true);
      toast.success("Conditionnement supprimé");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la suppression");
    } finally { setBusy(false); }
  };

  // Recharge le catalogue sans prévenir le parent : notifier pendant que la
  // boîte de dialogue est ouverte la ferme (re-render/remontage du parent).
  const refresh = useCallback(async () => {
    await loadProductCatalog();
    setTick((t) => t + 1);
    setDirty(true);
  }, []);

  useEffect(() => {
    if (open) {
      setFilterCat(category);
      setSearch("");
      void loadProductCatalog().then(() => setTick((t) => t + 1));
    } else if (dirty) {
      setDirty(false);
      onChanged?.();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const products = useMemo(() => {
    void tick;
    return getProducts().filter(
      (p) => p.category === "alimentaire" || p.category === "emballage",
    );
  }, [tick]);

  const q = normalize(search);
  const filtered = products.filter(
    (p) =>
      (filterCat === "all" || p.category === filterCat) &&
      (q === "" ||
        normalize(p.name).includes(q) ||
        normalize(p.conditionnement ?? "").includes(q)),
  );


  const draftOf = (id: string, name: string, cond: string) =>
    drafts[id] ?? { name, conditionnement: cond ?? "" };

  const changeActive = async (productId: string, active: boolean) => {
    if (!canEdit || conditionnementOnly) return;
    setBusy(true);
    try {
      await setProductActive(productId, active);
      await refresh();
      toast.success(active ? "Produit activé" : "Produit désactivé");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement du statut");
    } finally { setBusy(false); }
  };

  const setDraft = (id: string, patch: Partial<{ name: string; conditionnement: string }>, base: { name: string; conditionnement: string }) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? base), ...patch } }));

  const saveProduct = async (productId: string, category: Category, base: { name: string; conditionnement: string }, clearConditionnement = false) => {
    if (!canEdit) return;
    if (clearConditionnement && (!hasAdminRole || !confirm("Supprimer ce conditionnement ? Le produit et son historique seront conservés."))) return;
    const draft = drafts[productId] ?? base;
    const name = draft.name.trim();
    if (!name) {
      toast.error("Le nom du produit est obligatoire");
      return;
    }
    setBusy(true);
    try {
      const existing = getProductCatalog().find((r) => r.productId === productId);
      const payload = {
        product_id: productId,
        category,
        name,
        conditionnement: hasAdminRole ? (clearConditionnement ? "" : draft.conditionnement.trim()) : base.conditionnement,
        hidden: false,
      };
      const { error } = existing
        ? await supabase.from("product_catalog" as any).update(payload).eq("product_id", productId)
        : await supabase.from("product_catalog" as any).insert(payload as any);
      if (error) throw error;
      setDrafts((d) => {
        const copy = { ...d };
        delete copy[productId];
        return copy;
      });
      await refresh();
      toast.success("Produit enregistré");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (productId: string, category: Category, name: string) => {
    if (!canDelete) return;
    if (!confirm(`Supprimer le produit « ${name} » ?`)) return;
    setBusy(true);
    try {
      const existing = getProductCatalog().find((r) => r.productId === productId);
      const isCustom = productId.startsWith("cali-") || productId.startsWith("cemb-");
      if (isCustom && existing) {
        const { error } = await supabase.from("product_catalog" as any).delete().eq("product_id", productId);
        if (error) throw error;
      } else if (existing) {
        const { error } = await supabase
          .from("product_catalog" as any)
          .update({ hidden: true })
          .eq("product_id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("product_catalog" as any)
          .insert({ product_id: productId, category, name, conditionnement: "", hidden: true } as any);
        if (error) throw error;
      }
      await refresh();
      toast.success("Produit supprimé");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur lors de la suppression");
    } finally {
      setBusy(false);
    }
  };

  const addProduct = async () => {
    if (!canEdit) return;
    const name = newProduct.name.trim();
    if (!name) {
      toast.error("Le nom du produit est obligatoire");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("product_catalog" as any).insert({
        product_id: newCustomProductId(newProduct.category),
        category: newProduct.category,
        name,
        conditionnement: newProduct.conditionnement.trim(),
        hidden: false,
      } as any);
      if (error) throw error;
      setNewProduct({ name: "", conditionnement: "", category: newProduct.category });
      await refresh();
      toast.success("Produit ajouté");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur lors de l'ajout");
    } finally {
      setBusy(false);
    }
  };

  if (!canView) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Package className="h-4 w-4" />
          {conditionnementOnly ? "Conditionnements" : "Produits"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{conditionnementOnly ? "Conditionnements – Alimentaire & Emballage" : "Catalogue produits – Alimentaire & Emballage"}</DialogTitle>
        </DialogHeader>

        {canEdit && !conditionnementOnly && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Ajouter un produit</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Nom du produit"
                value={newProduct.name}
                onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
              />
              <Input
                placeholder="Conditionnement (ex: 20 KG)"
                value={newProduct.conditionnement}
                onChange={(e) => setNewProduct((p) => ({ ...p, conditionnement: e.target.value }))}
                className="sm:w-56"
              />
              <div className="flex rounded-md border overflow-hidden">
                {(["alimentaire", "emballage"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewProduct((p) => ({ ...p, category: c }))}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      newProduct.category === c ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {c === "alimentaire" ? "Alim." : "Emb."}
                  </button>
                ))}
              </div>
              <Button onClick={addProduct} disabled={busy} className="gap-2">
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex rounded-md border overflow-hidden self-start">
            {(["all", "alimentaire", "emballage"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilterCat(c)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterCat === c ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {c === "all" ? "Tout" : c === "alimentaire" ? "Alim." : "Emb."}
              </button>
            ))}
          </div>
        </div>


        <div className="max-h-[45vh] overflow-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase">Produit</th>
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase w-40">Conditionnement</th>
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase w-24">Catégorie</th>
                {!conditionnementOnly && <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase w-28">Statut</th>}
                <th className="p-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const base = { name: p.name, conditionnement: p.conditionnement ?? "" };
                const d = draftOf(p.id, base.name, base.conditionnement);
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="p-2">
                      <Input
                        value={d.name}
                        disabled={conditionnementOnly || !canEdit || busy}
                        onChange={(e) => setDraft(p.id, { name: e.target.value }, base)}
                        className="h-8"
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                      <Input
                        value={d.conditionnement}
                        disabled={!canEdit || !hasAdminRole || busy}
                        onChange={(e) => setDraft(p.id, { conditionnement: e.target.value }, base)}
                        className="h-8"
                      />
                      {hasAdminRole && canEdit && !!base.conditionnement && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" disabled={busy}
                          title="Supprimer le conditionnement" aria-label={`Supprimer le conditionnement de ${p.name}`}
                          onClick={() => saveProduct(p.id, p.category as Category, base, true)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      </div>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {p.category === "alimentaire" ? "Alim." : "Emb."}
                    </td>
                    {!conditionnementOnly && (
                      <td className="p-2">
                        <label className="flex items-center gap-2 text-xs whitespace-nowrap">
                          <Switch checked={isProductActive(p.id)} disabled={!canEdit || busy}
                            aria-label={`Actif : ${p.name}`}
                            onCheckedChange={active => void changeActive(p.id, active)} />
                          {isProductActive(p.id) ? "Actif" : "Inactif"}
                        </label>
                      </td>
                    )}
                    <td className="p-2">
                      <div className="flex gap-1 justify-end">
                        {canEdit && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={busy}
                            onClick={() => saveProduct(p.id, p.category as Category, base)}
                            title="Enregistrer"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        )}
                        {conditionnementOnly && canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={busy}
                            onClick={() => { setPacksFor({ id: p.id, name: p.name }); setNewPack({ label: "", pieces: "" }); setPackDrafts({}); setBasePackDraft(unitConfigs[p.id] ?? DEFAULT_UNIT_CONFIG); }}
                            title="Modifier les conditionnements"
                          >
                            Paquets ({(packs[p.id] ?? []).length})
                          </Button>
                        )}
                        {canDelete && !conditionnementOnly && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            disabled={busy}
                            onClick={() => removeProduct(p.id, p.category as Category, p.name)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={conditionnementOnly ? 4 : 5} className="p-4 text-center text-muted-foreground text-sm">
                    Aucun produit
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>

      {/* Sous-fenetre : conditionnements supplementaires d'un produit (ex: paquet de 16) */}
      <Dialog open={!!packsFor} onOpenChange={(o) => { if (!o) setPacksFor(null); }}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conditionnements — {packsFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 border-b pb-3">
            <span className="text-sm font-medium">Unité du produit :</span>
            {([["PIECE", "Pièce"], ["LITRE", "Litre"], ["KILO", "Kg"]] as const).map(([u, l]) => (
              <Button key={u} size="sm" disabled={busy || !hasAdminRole}
                variant={(packsFor ? productUnits[packsFor.id] ?? "PIECE" : "PIECE") === u ? "default" : "outline"}
                onClick={() => changeUnit(u)}>{l}</Button>
            ))}
            <label className="flex items-center gap-2 text-sm w-full pt-1">
              <Checkbox checked={basePackDraft.pieceHidden === true} disabled={busy || !hasAdminRole}
                onCheckedChange={async v => {
                  if (!packsFor) return;
                  const hidden = v === true;
                  setBasePackDraft(d => ({ ...d, pieceHidden: hidden }));
                  setBusy(true);
                  try { await setProductUnitConfig(packsFor.id, { pieceHidden: hidden }); await reloadPacks(); setDirty(true); toast.success(hidden ? "Unité masquée dans les saisies" : "Unité affichée dans les saisies"); }
                  catch (e: any) { toast.error(e?.message || "Erreur"); } finally { setBusy(false); }
                }} />
              Masquer pièce / kg / litre (produit seulement en paquet ou carton)
            </label>
          </div>
          <div className="space-y-3 border-b pb-4">
            {(["paquet", "carton"] as const).map(kind => {
              const enabledKey = kind === "paquet" ? "paquetEnabled" : "cartonEnabled";
              const piecesKey = kind === "paquet" ? "piecesPerPaquet" : "piecesPerCarton";
              const label = kind === "paquet" ? "Paquet" : "Carton";
              return (
                <div key={kind} className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 min-w-24 text-sm">
                    <Checkbox checked={basePackDraft[enabledKey]} disabled={busy || !hasAdminRole}
                      onCheckedChange={v => setBasePackDraft(d => ({ ...d, [enabledKey]: v === true }))} />
                    {label}
                  </label>
                  <Input type="number" min="1" step="1" aria-label={`Pièces par ${kind}`}
                    value={basePackDraft[piecesKey]} disabled={busy || !hasAdminRole}
                    onChange={e => setBasePackDraft(d => ({ ...d, [piecesKey]: Number(e.target.value) }))} className="w-24" />
                  <span className="text-xs text-muted-foreground">pièces</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" disabled={busy || !hasAdminRole || !basePackDraft[enabledKey]}
                    title={`Supprimer le format ${kind}`} aria-label={`Supprimer le format ${kind}`}
                    onClick={() => removeBasePack(kind)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button onClick={saveBasePacks} disabled={busy || !hasAdminRole} variant="outline" size="sm" className="gap-2">
              <Save className="h-4 w-4" /> Enregistrer paquet / carton
            </Button>
          </div>
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Ajouter un conditionnement</p>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Nom (ex: Paquet de 16)"
                value={newPack.label}
                onChange={(e) => setNewPack((v) => ({ ...v, label: e.target.value }))}
              />
              <Input
                type="number" min="1" placeholder="Pieces"
                value={newPack.pieces}
                onChange={(e) => setNewPack((v) => ({ ...v, pieces: e.target.value }))}
                className="w-24"
              />
              <Button onClick={addPack} disabled={busy || !hasAdminRole} className="gap-2">
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            </div>
          </div>
          <div className="max-h-[40vh] overflow-y-auto border rounded-md">
            <table className="w-full text-sm">
              <tbody>
                {(packs[packsFor?.id ?? ""] ?? []).map((pack) => (
                  <tr key={pack.id} className="border-b">
                    <td className="p-2"><Input aria-label={`Nom du format ${pack.label}`}
                      value={packDrafts[pack.id]?.label ?? pack.label} disabled={busy || !hasAdminRole}
                      onChange={e => setPackDrafts(d => ({ ...d, [pack.id]: { label: e.target.value, pieces: d[pack.id]?.pieces ?? String(pack.piecesPerUnit) } }))} /></td>
                    <td className="p-2 w-24"><Input type="number" min="1" aria-label={`Pièces du format ${pack.label}`}
                      value={packDrafts[pack.id]?.pieces ?? pack.piecesPerUnit} disabled={busy || !hasAdminRole}
                      onChange={e => setPackDrafts(d => ({ ...d, [pack.id]: { label: d[pack.id]?.label ?? pack.label, pieces: e.target.value } }))} /></td>
                    <td className="p-2 text-right">
                      <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy || !hasAdminRole}
                        onClick={() => savePack(pack)} title="Enregistrer le conditionnement" aria-label={`Enregistrer ${pack.label}`}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                        disabled={busy || !hasAdminRole}
                        onClick={() => removePack(pack.id)}
                        title="Supprimer le conditionnement" aria-label={`Supprimer ${pack.label}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(packs[packsFor?.id ?? ""] ?? []).length === 0 && (
                  <tr>
                    <td className="p-4 text-center text-muted-foreground text-sm">Aucun conditionnement</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
