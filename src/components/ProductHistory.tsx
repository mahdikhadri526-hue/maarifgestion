import { useState, useEffect } from "react";
import { Category, getProducts } from "@/lib/stockData";
import { useProductDailyHistory, useInitialStocks } from "@/hooks/useStockData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.jpeg";
import { formatDateFR } from "@/lib/utils";

type FilterMode = "all" | "day" | "month" | "period";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}
function currentMonthISO() {
  return new Date().toISOString().slice(0, 7);
}

function filterRows<T extends { date: string }>(
  rows: T[],
  mode: FilterMode,
  day: string,
  month: string,
  start: string,
  end: string,
): T[] {
  if (mode === "all") return rows;
  return rows.filter((r) => {
    const d = r.date.slice(0, 10);
    if (mode === "day") return day ? d === day : true;
    if (mode === "month") return month ? d.startsWith(month) : true;
    if (mode === "period") {
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    }
    return true;
  });
}

function AllProductsSummary({
  category,
  mode,
  day,
  month,
  start,
  end,
}: {
  category: Category;
  mode: FilterMode;
  day: string;
  month: string;
  start: string;
  end: string;
}) {
  const products = getProducts(category);
  const { data: initialStocks } = useInitialStocks();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    import("@/lib/stockData").then(async ({ getProductDailyHistory }) => {
      const results = await Promise.all(
        products.map(async (p) => {
          const h = await getProductDailyHistory(p.id);
          const filtered = filterRows(h, mode, day, month, start, end);
          const firstRow = filtered.length > 0 ? filtered[0] : null;
          const lastRow = filtered.length > 0 ? filtered[filtered.length - 1] : null;
          const baseInitial = (initialStocks as any)?.[p.id] ?? 0;
          let stockInitial = firstRow ? firstRow.stockInitial : baseInitial;
          let stockRestant = lastRow ? lastRow.stockRestant : baseInitial;
          if (filtered.length === 0) {
            // Aucun mouvement sur la période : reprendre le dernier stock connu avant la période
            const beforeRows = h.filter((r) => {
              const d = r.date.slice(0, 10);
              if (mode === "day") return d < day;
              if (mode === "month") return d < `${month}-01`;
              if (mode === "period") return start ? d < start : false;
              if (mode === "all") return false;
              return false;
            });
            const last = beforeRows[beforeRows.length - 1];
            if (last) {
              stockInitial = last.stockRestant;
              stockRestant = last.stockRestant;
            }
          }
          return {
            ...p,
            stockInitial,
            stockRestant,
            totalEntrees: filtered.reduce((s, r) => s + r.entrees, 0),
            totalSorties: filtered.reduce((s, r) => s + r.sorties, 0),
          };
        })
      );
      if (!cancelled) {
        setData(results);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [category, mode, day, month, start, end, initialStocks]);

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
            <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qté utilisée</th>
            <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Restant</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="p-3 text-sm font-medium">{p.name}</td>
              <td className="p-3 text-right font-mono text-sm text-primary">{p.stockInitial}</td>
              <td className="p-3 text-right font-mono text-sm text-success">{p.totalEntrees || "-"}</td>
              <td className="p-3 text-right font-mono text-sm text-destructive">{p.totalSorties || "-"}</td>
              <td className="p-3 text-right font-mono text-sm text-warning">{p.totalSorties || "-"}</td>
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

function SingleProductHistory({
  productId,
  mode,
  day,
  month,
  start,
  end,
}: {
  productId: string;
  mode: FilterMode;
  day: string;
  month: string;
  start: string;
  end: string;
}) {
  const { data: history, loading } = useProductDailyHistory(productId);
  const { data: initialStocks } = useInitialStocks();
  const products = getProducts();
  const product = products.find((p) => p.id === productId);

  if (loading) return <p className="text-center text-muted-foreground py-8">Chargement...</p>;

  const fullHistory = history || [];
  const rows = filterRows(fullHistory, mode, day, month, start, end);
  const totals = rows.reduce(
    (acc, r) => ({
      entrees: acc.entrees + (r.entrees || 0),
      sorties: acc.sorties + (r.sorties || 0),
    }),
    { entrees: 0, sorties: 0 }
  );
  const baseInitial = (initialStocks as any)?.[productId] ?? 0;
  let stockInitialPeriode = rows.length > 0 ? rows[0].stockInitial : baseInitial;
  let stockRestantFinal = rows.length > 0 ? rows[rows.length - 1].stockRestant : baseInitial;
  if (rows.length === 0) {
    const beforeRows = fullHistory.filter((r) => {
      const d = r.date.slice(0, 10);
      if (mode === "day") return d < day;
      if (mode === "month") return d < `${month}-01`;
      if (mode === "period") return start ? d < start : false;
      return false;
    });
    const last = beforeRows[beforeRows.length - 1];
    if (last) {
      stockInitialPeriode = last.stockRestant;
      stockRestantFinal = last.stockRestant;
    }
  }
  const quantiteUtilisee = totals.sorties;

  return (
    <div>
      {productId && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-muted/30 border-b text-xs">
          <div><div className="text-muted-foreground">Stock Initial</div><div className="font-mono font-semibold text-primary">{stockInitialPeriode}</div></div>
          <div><div className="text-muted-foreground">Entrées</div><div className="font-mono font-semibold text-success">{totals.entrees}</div></div>
          <div><div className="text-muted-foreground">Sorties</div><div className="font-mono font-semibold text-destructive">{totals.sorties}</div></div>
          <div><div className="text-muted-foreground">Quantité utilisée</div><div className="font-mono font-semibold text-warning">{quantiteUtilisee}</div></div>
          <div><div className="text-muted-foreground">Stock Restant</div><div className={`font-mono font-semibold ${stockRestantFinal < 0 ? "text-destructive" : ""}`}>{stockRestantFinal}</div></div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Initial</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entrées</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sorties</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qté utilisée</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Restant</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="p-3 text-sm font-mono">{formatDateFR(row.date)}</td>
                <td className="p-3 text-right font-mono text-sm">{row.stockInitial}</td>
                <td className="p-3 text-right font-mono text-sm text-success">{row.entrees || "-"}</td>
                <td className="p-3 text-right font-mono text-sm text-destructive">{row.sorties || "-"}</td>
                <td className="p-3 text-right font-mono text-sm text-warning">{row.sorties || "-"}</td>
                <td className={`p-3 text-right font-mono text-sm font-semibold ${row.stockRestant < 0 ? "text-destructive" : ""}`}>
                  {row.stockRestant}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {product ? `Aucun mouvement pour ${product.name} sur la période sélectionnée` : "Sélectionner un produit"}
          </p>
        )}
      </div>
    </div>
  );
}

export function ProductHistory() {
  const [category, setCategory] = useState<Category>("alimentaire");
  const [productId, setProductId] = useState("");
  const [mode, setMode] = useState<FilterMode>("month");
  const [day, setDay] = useState<string>(todayISO());
  const [month, setMonth] = useState<string>(currentMonthISO());
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>(todayISO());

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

        {productId && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={mode === "all" ? "default" : "outline"} onClick={() => setMode("all")}>Tout</Button>
              <Button size="sm" variant={mode === "day" ? "default" : "outline"} onClick={() => setMode("day")}>Jour</Button>
              <Button size="sm" variant={mode === "month" ? "default" : "outline"} onClick={() => setMode("month")}>Mois</Button>
              <Button size="sm" variant={mode === "period" ? "default" : "outline"} onClick={() => setMode("period")}>Période</Button>
            </div>
            {mode === "day" && (
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-full sm:w-48" />
            )}
            {mode === "month" && (
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full sm:w-48" />
            )}
            {mode === "period" && (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8">Du</span>
                  <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full sm:w-44" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8">Au</span>
                  <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full sm:w-44" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {productId === "all" && (
        <AllProductsSummary
          category={category}
          mode={mode}
          day={day}
          month={month}
          start={start}
          end={end}
        />
      )}
      {productId && productId !== "all" && (
        <SingleProductHistory
          productId={productId}
          mode={mode}
          day={day}
          month={month}
          start={start}
          end={end}
        />
      )}
      {!productId && (
        <p className="text-center text-muted-foreground py-8">Sélectionner un produit pour voir son historique</p>
      )}
    </div>
  );
}
