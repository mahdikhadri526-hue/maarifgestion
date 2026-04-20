import { useState } from "react";
import { Category, getProducts } from "@/lib/stockData";
import { useProductDailyHistory } from "@/hooks/useStockData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";
import logo from "@/assets/logo.jpeg";

function AllProductsSummary({ category }: { category: Category }) {
  const products = getProducts(category);
  // For "all" mode we show each product's summary using individual hooks isn't practical,
  // so we'll fetch inline
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    setLoaded(true);
    setLoading(true);
    import("@/lib/stockData").then(async ({ getProductDailyHistory }) => {
      const results = await Promise.all(
        products.map(async (p) => {
          const h = await getProductDailyHistory(p.id);
          const lastRow = h.length > 0 ? h[h.length - 1] : null;
          const firstRow = h.length > 0 ? h[0] : null;
          return {
            ...p,
            stockRestant: lastRow ? lastRow.stockRestant : 0,
            stockInitial: firstRow ? firstRow.stockInitial : 0,
            totalEntrees: h.reduce((s, r) => s + r.entrees, 0),
            totalSorties: h.reduce((s, r) => s + r.sorties, 0),
          };
        })
      );
      setData(results);
      setLoading(false);
    });
  }

  if (loading) return <p className="text-center text-muted-foreground py-8">Chargement...</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
            <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Initial</th>
            <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entrées</th>
            <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sorties</th>
            <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Restant</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="p-3 text-sm font-medium">{p.name}</td>
              <td className="p-3 text-right font-mono text-sm text-primary">{p.stockInitial || "-"}</td>
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
  );
}

function SingleProductHistory({ productId }: { productId: string }) {
  const { data: history, loading } = useProductDailyHistory(productId);
  const products = getProducts();
  const product = products.find((p) => p.id === productId);

  if (loading) return <p className="text-center text-muted-foreground py-8">Chargement...</p>;

  return (
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
          {(history || []).map((row) => (
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
      {(!history || history.length === 0) && (
        <p className="text-center text-muted-foreground py-8">
          {product ? `Aucun mouvement pour ${product.name}` : "Sélectionner un produit"}
        </p>
      )}
    </div>
  );
}

export function ProductHistory() {
  const [category, setCategory] = useState<Category>("alimentaire");
  const [productId, setProductId] = useState("");

  const products = getProducts(category);

  return (
    <div className="bg-card rounded-lg border animate-fade-in">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          Stock Restant
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={category} onValueChange={(v) => { setCategory(v as Category); setProductId(""); }}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alimentaire">Alimentaire</SelectItem>
              <SelectItem value="emballage">Emballage</SelectItem>
            </SelectContent>
          </Select>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📋 Tous les produits</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {productId === "all" && <AllProductsSummary category={category} />}
      {productId && productId !== "all" && <SingleProductHistory productId={productId} />}
      {!productId && (
        <p className="text-center text-muted-foreground py-8">Sélectionner un produit pour voir son historique</p>
      )}
    </div>
  );
}
