import { useState, useEffect } from "react";
import { Category, getProducts, setInitialStock } from "@/lib/stockData";
import { useInitialStocks } from "@/hooks/useStockData";
import { addLotEntry } from "@/lib/lotData";
import { Input } from "@/components/ui/input";
import { Search, Save, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.jpeg";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onUpdated: () => void;
}

export function InitialStockForm({ onUpdated }: Props) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [stocks, setStocks] = useState<Record<string, string>>({});
  const [lotNumbers, setLotNumbers] = useState<Record<string, string>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const { can } = useAuth();
  const { data: savedStocks, loading } = useInitialStocks();

  useEffect(() => {
    if (savedStocks) {
      const result: Record<string, string> = {};
      Object.entries(savedStocks).forEach(([k, v]) => { result[k] = String(v); });
      setStocks(result);
    }
  }, [savedStocks]);

  const products = getProducts(category === "all" ? undefined : category);
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (productId: string, productCategory: Category) => {
    const val = Number(stocks[productId] || 0);
    if (isNaN(val) || val < 0) {
      toast.error("Quantité invalide");
      return;
    }

    const isAlim = productCategory === "alimentaire";
    const lot = lotNumbers[productId]?.trim() || "";
    const dlc = expiryDates[productId] || "";

    if (isAlim && val > 0 && (!lot || !dlc)) {
      toast.error("Veuillez saisir le N° de lot et la DLC");
      return;
    }

    await setInitialStock(productId, val);

    if (isAlim && val > 0 && lot && dlc) {
      try {
        await addLotEntry({
          productId,
          lotNumber: lot,
          expiryDate: dlc,
          quantity: val,
          entryDate: new Date().toISOString().split("T")[0],
        });
      } catch (err) {
        console.error(err);
        toast.error("Stock enregistré mais erreur lors de la création du lot");
        return;
      }
      setLotNumbers((s) => ({ ...s, [productId]: "" }));
      setExpiryDates((s) => ({ ...s, [productId]: "" }));
    }

    toast.success("Stock initial mis à jour");
    onUpdated();
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;

  return (
    <div className="bg-card rounded-lg border animate-fade-in">
      <div className="p-4 border-b">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              <img src={logo} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Stock Initial</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Définir le stock de départ pour chaque produit</p>
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-48" />
            </div>
            <div className="flex rounded-md border overflow-hidden">
              {(["all", "alimentaire", "emballage"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === cat ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {cat === "all" ? "Tout" : cat === "alimentaire" ? "Alim." : "Emb."}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Catégorie</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">Stock Initial</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">N° Lot (Alim.)</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">DLC (Alim.)</th>
              <th className="p-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isAlim = p.category === "alimentaire";
              const isUnlocked = unlockedIds.has(p.id);
              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-sm font-medium">{p.name}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isAlim ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent-foreground"
                    }`}>
                      {isAlim ? "Alim." : "Emb."}
                    </span>
                  </td>
                  <td className="p-3">
                    <Input
                      type="number" min="0"
                      value={stocks[p.id] || ""}
                      onChange={(e) => setStocks((s) => ({ ...s, [p.id]: e.target.value }))}
                      className="font-mono text-right w-24 ml-auto"
                      placeholder="0"
                      disabled={!isUnlocked}
                    />
                  </td>
                  <td className="p-3">
                    {isAlim ? (
                      <Input
                        type="text"
                        value={lotNumbers[p.id] || ""}
                        onChange={(e) => setLotNumbers((s) => ({ ...s, [p.id]: e.target.value }))}
                        className="text-xs w-32"
                        placeholder="LOT-..."
                        disabled={!isUnlocked}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {isAlim ? (
                      <Input
                        type="date"
                        value={expiryDates[p.id] || ""}
                        onChange={(e) => setExpiryDates((s) => ({ ...s, [p.id]: e.target.value }))}
                        className="text-xs w-36"
                        disabled={!isUnlocked}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {isUnlocked ? (
                        <>
                          <button
                            onClick={() => handleSave(p.id, p.category)}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-primary"
                            title="Enregistrer"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setUnlockedIds((s) => { const n = new Set(s); n.delete(p.id); return n; })}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                            title="Verrouiller"
                          >
                            <Unlock className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                      <button
                        onClick={() => {
                          if (can("edit_stock")) {
                            setUnlockedIds((s) => new Set(s).add(p.id));
                          } else {
                            toast.error("Opération non autorisée");
                          }
                        }}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Déverrouiller pour modifier"
                      >
                        <Lock className="h-4 w-4" />
                      </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
