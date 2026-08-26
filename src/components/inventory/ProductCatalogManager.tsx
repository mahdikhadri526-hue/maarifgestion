import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db";
import { Category, getProducts, getProductCatalog } from "@/lib/stockData";
import { loadProductCatalog, newCustomProductId } from "@/lib/productCatalog";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onChanged?: () => void;
  /** Catégorie sélectionnée dans l'écran parent (filtre initial du catalogue). */
  category?: Category | "all";
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function ProductCatalogManager({ onChanged, category = "all" }: Props) {
  const { can } = useAuth();
  const canEdit = can("edit_products");
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

  const setDraft = (id: string, patch: Partial<{ name: string; conditionnement: string }>, base: { name: string; conditionnement: string }) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? base), ...patch } }));

  const saveProduct = async (productId: string, category: Category, base: { name: string; conditionnement: string }) => {
    if (!canEdit) return;
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
        conditionnement: draft.conditionnement.trim(),
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
          Produits
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Catalogue produits – Alimentaire & Emballage</DialogTitle>
        </DialogHeader>

        {canEdit && (
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


        <div className="max-h-[45vh] overflow-y-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase">Produit</th>
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase w-40">Conditionnement</th>
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase w-24">Catégorie</th>
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
                        disabled={!canEdit || busy}
                        onChange={(e) => setDraft(p.id, { name: e.target.value }, base)}
                        className="h-8"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={d.conditionnement}
                        disabled={!canEdit || busy}
                        onChange={(e) => setDraft(p.id, { conditionnement: e.target.value }, base)}
                        className="h-8"
                      />
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {p.category === "alimentaire" ? "Alim." : "Emb."}
                    </td>
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
                        {canDelete && (
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
                  <td colSpan={4} className="p-4 text-center text-muted-foreground text-sm">
                    Aucun produit
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
