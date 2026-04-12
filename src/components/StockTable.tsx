import { useState } from "react";
import { Category, getStockLevels } from "@/lib/stockData";
import { isRequisitionProduct } from "@/lib/requisitionData";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import logo from "@/assets/logo.jpeg";

export function StockTable() {
  const [category, setCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");

  const levels = getStockLevels(category === "all" ? undefined : category);
  const filtered = levels.filter((l) =>
    l.productName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-card rounded-lg border animate-fade-in">
      <div className="p-4 border-b">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              <img src={logo} alt="Logo" className="w-full h-full object-cover" />
            </div>
            Stock Restant
          </h2>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <div className="flex rounded-md border overflow-hidden">
              {(["all", "alimentaire", "emballage"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {cat === "all" ? "Tout" : cat === "alimentaire" ? "Alimentaire" : "Emballage"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Catégorie</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entrées</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sorties</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((level) => (
              <tr key={level.productId} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                isRequisitionProduct(level.productId) ? "bg-amber-50 dark:bg-amber-950/20" : ""
              }`}>
                <td className="p-3 text-sm font-medium flex items-center gap-1.5">
                  {isRequisitionProduct(level.productId) && <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />}
                  {level.productName}
                </td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    level.category === "alimentaire"
                      ? "bg-primary/10 text-primary"
                      : "bg-accent/10 text-accent-foreground"
                  }`}>
                    {level.category === "alimentaire" ? "Alimentaire" : "Emballage"}
                  </span>
                </td>
                <td className="p-3 text-right font-mono text-sm text-success">{level.totalEntrees}</td>
                <td className="p-3 text-right font-mono text-sm text-accent-foreground">{level.totalSorties}</td>
                <td className={`p-3 text-right font-mono text-sm font-semibold ${
                  level.stockRestant < 0 ? "text-destructive" : level.stockRestant === 0 ? "text-muted-foreground" : ""
                }`}>
                  {level.stockRestant}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Aucun produit trouvé</p>
        )}
      </div>
    </div>
  );
}
