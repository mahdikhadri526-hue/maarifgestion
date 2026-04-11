import { useState } from "react";
import { StockDashboard } from "@/components/StockDashboard";
import { StockTable } from "@/components/StockTable";
import { MovementForm } from "@/components/MovementForm";
import { MovementHistory } from "@/components/MovementHistory";
import { InitialStockForm } from "@/components/InitialStockForm";
import { ProductHistory } from "@/components/ProductHistory";
import { LayoutDashboard, History, PlusCircle, Database, FileText, Info } from "lucide-react";
import logo from "@/assets/logo.jpeg";

type Tab = "dashboard" | "stock-initial" | "mouvements" | "historique" | "produit";

const GuideCard = () => (
  <div className="bg-card rounded-lg border p-5 space-y-4 animate-fade-in">
    <h2 className="text-lg font-semibold flex items-center gap-2">
      <Info className="h-5 w-5 text-primary" />
      Comment utiliser l'application
    </h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[
        { step: "1", title: "Stock Initial", desc: "Définissez la quantité de départ de chaque produit dans l'onglet Stock Initial." },
        { step: "2", title: "Ajouter un mouvement", desc: "Dans l'onglet Mouvements, sélectionnez un produit, choisissez Entrée ou Sortie, et entrez la quantité." },
        { step: "3", title: "Consulter le stock", desc: "Le stock restant se calcule automatiquement : Stock Initial + Entrées − Sorties." },
        { step: "4", title: "Historique", desc: "Consultez et supprimez les mouvements dans Historique, ou suivez un produit jour par jour dans Par Produit." },
      ].map((item) => (
        <div key={item.step} className="flex gap-3 items-start">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            {item.step}
          </span>
          <div>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

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
  ];

  return (
    <div className="min-h-screen bg-background">
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
            <StockDashboard />
            <GuideCard />
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Stock Restant</h2>
                <button
                  onClick={() => setShowStock(!showStock)}
                  className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                >
                  {showStock ? "Masquer" : "Consulter le stock"}
                  <Package className="h-4 w-4" />
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
      </main>
    </div>
  );
};

export default Index;
