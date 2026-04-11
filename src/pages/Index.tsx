import { useState } from "react";
import { StockDashboard } from "@/components/StockDashboard";
import { StockTable } from "@/components/StockTable";
import { MovementForm } from "@/components/MovementForm";
import { MovementHistory } from "@/components/MovementHistory";
import { Package, LayoutDashboard, History, PlusCircle } from "lucide-react";

type Tab = "dashboard" | "mouvements" | "historique";

const Index = () => {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  const tabs = [
    { id: "dashboard" as Tab, label: "Tableau de bord", icon: LayoutDashboard },
    { id: "mouvements" as Tab, label: "Mouvements", icon: PlusCircle },
    { id: "historique" as Tab, label: "Historique", icon: History },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="bg-sidebar-primary p-2 rounded-lg">
            <Package className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">K.MAHDI — Gestion de Stock</h1>
            <p className="text-xs text-sidebar-foreground/60">Suivi des entrées, sorties et stock restant</p>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-card border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6" key={refreshKey}>
        {tab === "dashboard" && (
          <>
            <StockDashboard />
            <StockTable />
          </>
        )}

        {tab === "mouvements" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <MovementForm onMovementAdded={refresh} />
            </div>
            <div className="lg:col-span-2">
              <StockTable />
            </div>
          </div>
        )}

        {tab === "historique" && <MovementHistory />}
      </main>
    </div>
  );
};

export default Index;
