import { useState } from "react";
import { StockTable } from "@/components/StockTable";
import { MovementForm } from "@/components/MovementForm";
import { MovementHistory } from "@/components/MovementHistory";
import { InitialStockForm } from "@/components/InitialStockForm";
import { ProductHistory } from "@/components/ProductHistory";
import { RequisitionForm } from "@/components/RequisitionForm";
import { ExpiryAlerts, LotManager, StockOutAlerts, PendingAutocontrolAlerts } from "@/components/LotManagement";
import { AutocontrolManager } from "@/components/AutocontrolManager";
import { WeeklyTracking } from "@/components/WeeklyTracking";
import { FridgeTemperatureManager } from "@/components/FridgeTemperatureManager";
import { RecipeManager } from "@/components/RecipeManager";
import { CleaningManager } from "@/components/CleaningManager";
import { LayoutDashboard, History, PlusCircle, Database, FileText, BarChart3, ClipboardList, Boxes, ClipboardCheck, CalendarDays, ArrowRight, Thermometer, ChefHat, Sparkles } from "lucide-react";
import logo from "@/assets/logo.jpeg";
import { ENABLE_DASHBOARD_ORDER_TABLE } from "@/lib/featureFlags";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/auth/UserMenu";
import { UserManagement } from "@/components/auth/UserManagement";

type Tab = "dashboard" | "stock-initial" | "mouvements" | "historique" | "produit" | "requisition" | "lots" | "autocontrole" | "hebdo" | "temperatures" | "recettes" | "nettoyage";

const Index = () => {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showStock, setShowStock] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const { can, isAdmin } = useAuth();

  const refresh = () => setRefreshKey((k) => k + 1);

  const allTabs = [
    { id: "dashboard" as Tab, label: "Tableau de bord", icon: LayoutDashboard, perm: "view_dashboard" },
    { id: "stock-initial" as Tab, label: "Stock Initial", icon: Database, perm: "view_stock" },
    { id: "mouvements" as Tab, label: "Mouvements", icon: PlusCircle, perm: "edit_movements" },
    { id: "historique" as Tab, label: "Historique Mouvements", icon: History, perm: "view_movements" },
    { id: "produit" as Tab, label: "Stock Restant", icon: FileText, perm: "view_reports" },
    { id: "lots" as Tab, label: "Lots / DLC", icon: Boxes, perm: "view_lots" },
    { id: "requisition" as Tab, label: "Réquisition", icon: ClipboardList, perm: "view_requisitions" },
    { id: "autocontrole" as Tab, label: "Autocontrôle", icon: ClipboardCheck, perm: "view_autocontrol" },
    { id: "hebdo" as Tab, label: "Suivi hebdomadaire", icon: CalendarDays, perm: "view_weekly" },
    { id: "temperatures" as Tab, label: "Températures frigos", icon: Thermometer, perm: "view_temperatures" },
    { id: "recettes" as Tab, label: "Recettes", icon: ChefHat, perm: "view_recipes" },
    { id: "nettoyage" as Tab, label: "Nettoyage", icon: Sparkles, perm: "view_temperatures" },
  ];
  const tabs = allTabs.filter((t) => can(t.perm));

  // Ensure current tab is allowed
  if (tabs.length > 0 && !tabs.some((t) => t.id === tab)) {
    setTimeout(() => setTab(tabs[0].id), 0);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden">
            <img src={logo} alt="Oliveri Logo" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight">Gestion de Stock Maarif</h1>
            <p className="text-xs text-sidebar-foreground/60">Suivi des entrées, sorties et stock restant</p>
          </div>
          <UserMenu onOpenAdmin={() => setShowAdmin(true)} />
        </div>
      </header>

      {showAdmin && isAdmin ? (
        <main className="max-w-5xl mx-auto px-4 py-6">
          <UserManagement onBack={() => setShowAdmin(false)} />
        </main>
      ) : (
      <>
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

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6 overflow-x-hidden min-w-0">
        {tabs.length === 0 && (
          <div className="bg-card border rounded-xl p-8 text-center">
            <h2 className="text-lg font-semibold mb-2">Aucune permission</h2>
            <p className="text-sm text-muted-foreground">Votre compte n'a accès à aucune section. Contactez l'administrateur.</p>
          </div>
        )}
        {tab === "dashboard" && (<div key={refreshKey}>
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

            {/* Pending autocontrol fiches (avant les ruptures) */}
            <PendingAutocontrolAlerts onOpen={() => setTab("autocontrole")} />

            {/* Stock Alerts */}
            <StockOutAlerts />

            {/* Expiry Alerts */}
            <ExpiryAlerts />

            {/* Pro navigation buttons - access to all tables */}
            <div className="bg-card rounded-xl border shadow-sm p-4 mt-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Accès rapide</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {tabs.filter((t) => t.id !== "dashboard").map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setTab(b.id)}
                    className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all text-xs font-medium shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      <b.icon className="h-3.5 w-3.5" />
                      {b.label}
                    </span>
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>

            {ENABLE_DASHBOARD_ORDER_TABLE && (
            <div className="bg-card rounded-xl border shadow-sm p-4 mt-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                    <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                  </div>
                  Commande
                </h2>
                <button
                  onClick={() => setShowStock(!showStock)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {showStock ? "Masquer" : "Consulter"}
                </button>
              </div>
              {showStock && <StockTable variant="order" />}
            </div>
            )}


          </></div>
        )}

        {tab === "stock-initial" && <InitialStockForm key={refreshKey} onUpdated={refresh} />}

        {tab === "mouvements" && (
          <div key={refreshKey} className="max-w-xl mx-auto">
            <MovementForm onMovementAdded={refresh} />
          </div>
        )}

        {tab === "historique" && <MovementHistory key={refreshKey} onMovementDeleted={refresh} />}

        {tab === "produit" && <StockTable />}

        {tab === "requisition" && <RequisitionForm onUpdated={refresh} />}

        {tab === "lots" && <LotManager />}

        {tab === "autocontrole" && <AutocontrolManager />}

        {tab === "hebdo" && <WeeklyTracking />}

        {tab === "temperatures" && <FridgeTemperatureManager />}

        {tab === "recettes" && <RecipeManager />}

        {tab === "nettoyage" && <CleaningManager />}
      </main>
      </>
      )}
    </div>
  );
};

export default Index;
