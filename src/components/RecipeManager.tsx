import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePaginate";
import { getProducts, type Category, type UnitType } from "@/lib/stockData";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ChefHat, Plus, Save, Search, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";

type FinishedProduct = {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string | null;
  active: boolean;
  notes: string | null;
};
type Recipe = {
  id: string;
  finished_product_id: string;
  version: number;
  yield_quantity: number;
  yield_unit: string;
  active: boolean;
};
type Ingredient = {
  id?: string;
  recipe_id: string;
  product_id: string;
  category: string;
  quantity: number;
  unit: string;
  notes: string | null;
};

const UNITS: UnitType[] = ["PIECE", "KILO", "LITRE", "PAQUET", "COLIS", "ROULEAU"];
const CAT_LABELS: Record<string, string> = {
  emporter: "Emporter",
  surplace: "Sur place",
  tartes: "Tartes",
  autres: "Autres",
};

function isCustom(productId: string) {
  return productId.startsWith("custom:");
}

export function RecipeManager() {
  const { can } = useAuth();
  const canEdit = can("edit_recipes");

  const stockProducts = useMemo(() => getProducts(), []);
  const stockMap = useMemo(() => {
    const m = new Map<string, { name: string; category: Category }>();
    stockProducts.forEach((p) => m.set(p.id, { name: p.name, category: p.category }));
    return m;
  }, [stockProducts]);

  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");

  // edit state
  const [editingProduct, setEditingProduct] = useState<FinishedProduct | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [editingIngs, setEditingIngs] = useState<Ingredient[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [fp, rc, ri] = await Promise.all([
        fetchAllRows<FinishedProduct>(() =>
          supabase.from("finished_products").select("*").order("name")
        ),
        fetchAllRows<Recipe>(() => supabase.from("recipes").select("*")),
        fetchAllRows<{ recipe_id: string }>(() =>
          supabase.from("recipe_ingredients").select("recipe_id")
        ),
      ]);
      setProducts(fp);
      setRecipes(rc);
      const recipeToProduct = new Map(rc.map((r) => [r.id, r.finished_product_id]));
      const c: Record<string, number> = {};
      ri.forEach((row) => {
        const pid = recipeToProduct.get(row.recipe_id);
        if (pid) c[pid] = (c[pid] ?? 0) + 1;
      });
      setCounts(c);
    } catch (e: any) {
      toast.error("Erreur de chargement", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openProduct = async (p: FinishedProduct) => {
    setSelectedId(p.id);
    setEditingProduct({ ...p });
    const recipe = recipes.find((r) => r.finished_product_id === p.id) ?? null;
    if (!recipe) {
      // create one on the fly
      const { data, error } = await supabase
        .from("recipes")
        .insert({ finished_product_id: p.id, version: 1, yield_quantity: 1, yield_unit: "PIECE", active: true })
        .select()
        .single();
      if (error) {
        toast.error("Recette introuvable", { description: error.message });
        return;
      }
      setRecipes((prev) => [...prev, data as Recipe]);
      setEditingRecipe(data as Recipe);
      setEditingIngs([]);
    } else {
      setEditingRecipe({ ...recipe });
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("*")
        .eq("recipe_id", recipe.id);
      if (error) toast.error("Erreur", { description: error.message });
      setEditingIngs((data ?? []) as Ingredient[]);
    }
    setDirty(false);
  };

  const closeDetail = () => {
    if (dirty && !confirm("Modifications non enregistrées. Quitter ?")) return;
    setSelectedId(null);
    setEditingProduct(null);
    setEditingRecipe(null);
    setEditingIngs([]);
    setDirty(false);
  };

  const updateIng = (idx: number, patch: Partial<Ingredient>) => {
    setEditingIngs((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    setDirty(true);
  };

  const removeIng = (idx: number) => {
    setEditingIngs((arr) => arr.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const addIng = () => {
    if (!editingRecipe) return;
    setEditingIngs((arr) => [
      ...arr,
      {
        recipe_id: editingRecipe.id,
        product_id: stockProducts[0]?.id ?? "custom:nouveau",
        category: stockProducts[0]?.category ?? "alimentaire",
        quantity: 1,
        unit: "PIECE",
        notes: null,
      },
    ]);
    setDirty(true);
  };

  const remapToStock = (idx: number, stockId: string) => {
    const info = stockMap.get(stockId);
    if (!info) return;
    updateIng(idx, { product_id: stockId, category: info.category, notes: null });
  };

  const save = async () => {
    if (!editingProduct || !editingRecipe) return;
    // validate
    for (const ing of editingIngs) {
      if (!ing.quantity || ing.quantity <= 0) {
        toast.error("Quantité invalide", { description: "Chaque ingrédient doit avoir une quantité > 0" });
        return;
      }
    }
    if (!editingProduct.name.trim()) {
      toast.error("Le nom du produit est obligatoire");
      return;
    }
    setSaving(true);
    try {
      // update finished_product
      const { error: e1 } = await supabase
        .from("finished_products")
        .update({
          name: editingProduct.name.trim(),
          category: editingProduct.category,
          unit: editingProduct.unit,
          active: editingProduct.active,
          notes: editingProduct.notes,
        })
        .eq("id", editingProduct.id);
      if (e1) throw e1;
      // update recipe
      const { error: e2 } = await supabase
        .from("recipes")
        .update({
          yield_quantity: editingRecipe.yield_quantity,
          yield_unit: editingRecipe.yield_unit,
          active: editingRecipe.active,
        })
        .eq("id", editingRecipe.id);
      if (e2) throw e2;
      // replace ingredients
      const { error: eDel } = await supabase
        .from("recipe_ingredients")
        .delete()
        .eq("recipe_id", editingRecipe.id);
      if (eDel) throw eDel;
      if (editingIngs.length > 0) {
        const rows = editingIngs.map((i) => ({
          recipe_id: editingRecipe.id,
          product_id: i.product_id,
          category: i.category,
          quantity: Number(i.quantity),
          unit: i.unit,
          notes: i.notes,
        }));
        const { error: eIns } = await supabase.from("recipe_ingredients").insert(rows);
        if (eIns) throw eIns;
      }
      toast.success("Recette enregistrée");
      setDirty(false);
      // refresh local data
      setProducts((arr) =>
        arr.map((p) => (p.id === editingProduct.id ? { ...p, ...editingProduct } : p))
      );
      setCounts((c) => ({ ...c, [editingProduct.id]: editingIngs.length }));
    } catch (e: any) {
      toast.error("Erreur d'enregistrement", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (filterCat !== "all" && (p.category ?? "") !== filterCat) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, filterCat]);

  // ===== DETAIL VIEW =====
  if (selectedId && editingProduct && editingRecipe) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={closeDetail}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          {dirty && <Badge variant="secondary">Modifications non enregistrées</Badge>}
        </div>

        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Fiche recette</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nom du produit fini</Label>
              <Input
                value={editingProduct.name}
                disabled={!canEdit}
                maxLength={120}
                onChange={(e) => {
                  setEditingProduct({ ...editingProduct, name: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Catégorie</Label>
              <Select
                value={editingProduct.category ?? "autres"}
                disabled={!canEdit}
                onValueChange={(v) => {
                  setEditingProduct({ ...editingProduct, category: v });
                  setDirty(true);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CAT_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Rendement (par unité de production)</Label>
              <Input
                type="number"
                min={0.01}
                step="any"
                disabled={!canEdit}
                value={editingRecipe.yield_quantity}
                onChange={(e) => {
                  setEditingRecipe({ ...editingRecipe, yield_quantity: Number(e.target.value) || 0 });
                  setDirty(true);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Unité de production</Label>
              <Select
                value={editingRecipe.yield_unit}
                disabled={!canEdit}
                onValueChange={(v) => {
                  setEditingRecipe({ ...editingRecipe, yield_unit: v });
                  setDirty(true);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold">Ingrédients ({editingIngs.length})</h3>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={addIng}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter
              </Button>
            )}
          </div>

          {editingIngs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun ingrédient. Cliquez sur « Ajouter » pour commencer.
            </p>
          )}

          <div className="space-y-2">
            {editingIngs.map((ing, idx) => {
              const custom = isCustom(ing.product_id);
              const stockInfo = stockMap.get(ing.product_id);
              const displayName = custom
                ? (ing.notes || ing.product_id.replace(/^custom:/, "").replace(/-/g, " "))
                : (stockInfo?.name ?? ing.product_id);
              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 space-y-2 ${custom ? "bg-amber-50 border-amber-200" : "bg-card"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {custom ? (
                        <>
                          <div className="text-sm font-medium break-words">{displayName}</div>
                          <div className="text-[11px] text-amber-700 mt-0.5">
                            Non lié au stock — sélectionnez un produit ci-dessous pour le déduire automatiquement
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-medium break-words">{displayName}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {stockInfo?.category === "alimentaire" ? "Alimentaire" : "Emballage"}
                          </div>
                        </>
                      )}
                    </div>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeIng(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Quantité</Label>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        disabled={!canEdit}
                        value={ing.quantity}
                        onChange={(e) => updateIng(idx, { quantity: Number(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Unité</Label>
                      <Select
                        value={ing.unit}
                        disabled={!canEdit}
                        onValueChange={(v) => updateIng(idx, { unit: v })}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {canEdit && (
                    <div>
                      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        {custom ? "Mapper vers un produit du stock" : "Changer le produit"}
                      </Label>
                      <Select
                        value={custom ? "" : ing.product_id}
                        onValueChange={(v) => remapToStock(idx, v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="— Choisir un produit du stock —" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {stockProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} {p.conditionnement && <span className="text-muted-foreground text-xs">({p.conditionnement})</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {canEdit && (
          <div className="sticky bottom-2 z-10">
            <Button onClick={save} disabled={saving || !dirty} className="w-full shadow-lg" size="lg">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Enregistrement…" : "Enregistrer la recette"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Recettes des produits finis</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Sélectionnez un produit fini pour modifier la quantité de chaque ingrédient.
        </p>

        <div className="grid sm:grid-cols-2 gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit fini…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {Object.entries(CAT_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-8">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">Aucun produit trouvé.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => openProduct(p)}
              className="text-left bg-card hover:bg-accent transition-colors rounded-lg border p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{p.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {CAT_LABELS[p.category ?? "autres"] ?? "Autres"}
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {counts[p.id] ?? 0} ing.
              </Badge>
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground pt-2">
        {filtered.length} / {products.length} produit{products.length > 1 ? "s" : ""}
      </p>
    </div>
  );
}