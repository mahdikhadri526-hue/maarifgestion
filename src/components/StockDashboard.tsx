import { Package, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { getStockLevels, getMovements } from "@/lib/stockData";

export function StockDashboard() {
  const levels = getStockLevels();
  const movements = getMovements();
  
  const totalProducts = levels.length;
  const totalEntrees = movements.filter(m => m.type === "entree").reduce((s, m) => s + m.quantity, 0);
  const totalSorties = movements.filter(m => m.type === "sortie").reduce((s, m) => s + m.quantity, 0);
  const lowStock = levels.filter(l => l.stockRestant < 0).length;

  const stats = [
    { label: "Produits", value: totalProducts, icon: Package, color: "text-primary" },
    { label: "Total Entrées", value: totalEntrees.toLocaleString(), icon: TrendingUp, color: "text-success" },
    { label: "Total Sorties", value: totalSorties.toLocaleString(), icon: TrendingDown, color: "text-accent" },
    { label: "Stock Négatif", value: lowStock, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card rounded-lg border p-5 animate-fade-in"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
          </div>
          <p className="text-2xl font-bold font-mono">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
