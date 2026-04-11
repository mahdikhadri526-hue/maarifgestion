import { useState } from "react";
import { Category, getProducts, getProductDailyHistory } from "@/lib/stockData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";
import logo from "@/assets/logo.jpeg";

export function ProductHistory() {
  const [category, setCategory] = useState<Category>("alimentaire");
  const [productId, setProductId] = useState("");

  const products = getProducts(category);
  const history = productId === "all"
    ? []
    : productId
    ? getProductDailyHistory(productId)
    : [];
  const product = products.find((p) => p.id === productId);

  // For "all" mode, show a summary table of all products
  const allProductsData = productId === "all"
    ? products.map((p) => {
        const h = getProductDailyHistory(p.id);
        const lastRow = h.length > 0 ? h[h.length - 1] : null;
        return {
          ...p,
          stockRestant: lastRow ? lastRow.stockRestant : 0,
          totalEntrees: h.reduce((s, r) => s + r.entrees, 0),
          totalSorties: h.reduce((s, r) => s + r.sorties, 0),
        };
      })
    : [];

  return (
    <div className="bg-card rounded-lg border animate-fade-in">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          Historique par Produit
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={category} onValueChange={(v) => { setCategory(v as Category); setProductId(""); }}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alimentaire">Alimentaire</SelectItem>
              <SelectItem value="emballage">Emballage</SelectItem>
            </SelectContent>
          </Select>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Sélectionner un produit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📋 Tous les produits</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {productId === "all" && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entrées</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sorties</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Restant</th>
              </tr>
            </thead>
            <tbody>
              {allProductsData.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-sm font-medium">{p.name}</td>
                  <td className="p-3 text-right font-mono text-sm text-success">{p.totalEntrees || "-"}</td>
                  <td className="p-3 text-right font-mono text-sm text-destructive">{p.totalSorties || "-"}</td>
                  <td className={`p-3 text-right font-mono text-sm font-semibold ${p.stockRestant < 0 ? "text-destructive" : ""}`}>
                    {p.stockRestant}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {productId && productId !== "all" && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Initial</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entrées</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sorties</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Restant</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.date} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-sm font-mono">{new Date(row.date).toLocaleDateString("fr-FR")}</td>
                  <td className="p-3 text-right font-mono text-sm">{row.stockInitial}</td>
                  <td className="p-3 text-right font-mono text-sm text-success">{row.entrees || "-"}</td>
                  <td className="p-3 text-right font-mono text-sm text-destructive">{row.sorties || "-"}</td>
                  <td className={`p-3 text-right font-mono text-sm font-semibold ${row.stockRestant < 0 ? "text-destructive" : ""}`}>
                    {row.stockRestant}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {product ? `Aucun mouvement pour ${product.name}` : "Sélectionner un produit"}
            </p>
          )}
        </div>
      )}

      {!productId && (
        <p className="text-center text-muted-foreground py-8">Sélectionner un produit pour voir son historique</p>
      )}
    </div>
  );
}
