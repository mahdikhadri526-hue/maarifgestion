import { useState } from "react";
import { StockDashboard } from "@/components/StockDashboard";
import { StockTable } from "@/components/StockTable";
import { MovementForm } from "@/components/MovementForm";
import { MovementHistory } from "@/components/MovementHistory";
import { InitialStockForm } from "@/components/InitialStockForm";
import { ProductHistory } from "@/components/ProductHistory";
import { RequisitionForm } from "@/components/RequisitionForm";
import { ExpiryAlerts, LotManager } from "@/components/LotManagement";
import { LayoutDashboard, History, PlusCircle, Database, FileText, TrendingUp, TrendingDown, Package, BarChart3, ClipboardList, Boxes } from "lucide-react";
import logo from "@/assets/logo.jpeg";

type Tab = "dashboard" | "stock-initial" | "mouvements" | "historique" | "produit" | "requisition" | "lots";

const Index = () => {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showStock, setShowStock] = useState(false);

  const refresh = () => setRefreshKey((k) => k + 1);

  const tabs = [
    { id: "dashboard" as Tab, label: "Tableau de bord", icon: LayoutDashboard },
    { id: "stock-initial" as Tab, label: "Stock Initial", icon: Database },
    { id: "mouvements" as Tab, label: "Mouvements", icon: PlusCircle },
    { id: "historique" as Tab, label: "Historique", icon: History },
    { id: "produit" as Tab, label: "Par Produit", icon: FileText },
    { id: "requisition" as Tab, label: "Réquisition", icon: ClipboardList },
    { id: "lots" as Tab, label: "Lots / DLC", icon: Boxes },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden">
            <img src={logo} alt="Oliveri Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">K.MAHDI — Gestion de Stock</h1>
            <p className="text-xs text-sidebar-foreground/60">Suivi des entrées, sorties et stock restant</p>
          </div>
        </div>
      </header>

      <nav className="bg-card border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6" key={refreshKey}>
        {tab === "dashboard" && (
          <>
            {/* Hero Section */}
            <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl border p-6 sm:p-8 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative flex items-center gap-5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-lg border-2 border-primary/20 flex-shrink-0">
                  <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                    Bienvenue sur votre espace de gestion
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gérez vos stocks alimentaires et emballages en toute simplicité
                  </p>
                </div>
              </div>
            </div>

            {/* Expiry Alerts */}
            <ExpiryAlerts />

            <StockDashboard />

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Nouvelle entrée", icon: TrendingUp, color: "text-success", action: () => setTab("mouvements") },
                { label: "Nouvelle sortie", icon: TrendingDown, color: "text-destructive", action: () => setTab("mouvements") },
                { label: "Stock initial", icon: Package, color: "text-primary", action: () => setTab("stock-initial") },
                { label: "Lots / DLC", icon: Boxes, color: "text-accent-foreground", action: () => setTab("lots") },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="bg-card rounded-xl border p-4 flex flex-col items-center gap-2 hover:bg-muted/50 hover:shadow-md transition-all group"
                >
                  <item.icon className={`h-6 w-6 ${item.color} group-hover:scale-110 transition-transform`} />
                  <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                    <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                  </div>
                  Stock Restant
                </h2>
                <button
                  onClick={() => setShowStock(!showStock)}
                  className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                >
                  {showStock ? "Masquer" : "Consulter le stock"}
                </button>
              </div>
              {showStock && <StockTable />}
            </div>
          </>
        )}

        {tab === "stock-initial" && <InitialStockForm onUpdated={refresh} />}

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

        {tab === "historique" && <MovementHistory onMovementDeleted={refresh} />}

        {tab === "produit" && <ProductHistory />}

        {tab === "requisition" && <RequisitionForm onUpdated={refresh} />}

        {tab === "lots" && <LotManager />}
      </main>
    </div>
  );
};

export default Index;
