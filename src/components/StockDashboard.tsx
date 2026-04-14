import { useStockDashboard } from "@/hooks/useStockData";
import logo from "@/assets/logo.jpeg";

export function StockDashboard() {
  const { data, loading } = useStockDashboard();

  if (loading || !data) return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;

  const { levels, movements } = data;
  const totalProducts = levels.length;
  const totalEntrees = movements.filter(m => m.type === "entree").reduce((s, m) => s + m.quantity, 0);
  const totalSorties = movements.filter(m => m.type === "sortie").reduce((s, m) => s + m.quantity, 0);
  const lowStock = levels.filter(l => l.stockRestant < 0).length;

  const stats = [
    { label: "Produits", value: totalProducts, bg: "bg-primary/10", text: "text-primary" },
    { label: "Total Entrées", value: totalEntrees.toLocaleString(), bg: "bg-success/10", text: "text-success" },
    { label: "Total Sorties", value: totalSorties.toLocaleString(), bg: "bg-accent/10", text: "text-accent-foreground" },
    { label: "Stock Négatif", value: lowStock, bg: "bg-destructive/10", text: "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-xl border p-4 sm:p-5 ${stat.bg} backdrop-blur-sm animate-fade-in`}
        >
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
          <p className={`text-2xl sm:text-3xl font-bold font-mono mt-2 ${stat.text}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
