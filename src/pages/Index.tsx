import { lazy, Suspense, useEffect, useState } from "react";
import { loadProductCatalog } from "@/lib/productCatalog";
import { ExpiryAlerts, StockOutAlerts, LowStockAlerts, PendingAutocontrolAlerts } from "@/components/LotManagement";
// Lazy-loaded heavy tab modules — réduit le bundle initial et accélère le premier affichage.
const StockTable = lazy(() => import("@/components/StockTable").then((m) => ({ default: m.StockTable })));
const MovementForm = lazy(() => import("@/components/MovementForm").then((m) => ({ default: m.MovementForm })));
const MovementHistory = lazy(() => import("@/components/MovementHistory").then((m) => ({ default: m.MovementHistory })));
const InitialStockForm = lazy(() => import("@/components/InitialStockForm").then((m) => ({ default: m.InitialStockForm })));
const RequisitionForm = lazy(() => import("@/components/RequisitionForm").then((m) => ({ default: m.RequisitionForm })));
const LotManager = lazy(() => import("@/components/LotManagement").then((m) => ({ default: m.LotManager })));
const AutocontrolManager = lazy(() => import("@/components/AutocontrolManager").then((m) => ({ default: m.AutocontrolManager })));
const WeeklyTracking = lazy(() => import("@/components/WeeklyTracking").then((m) => ({ default: m.WeeklyTracking })));
const FridgeTemperatureManager = lazy(() => import("@/components/FridgeTemperatureManager").then((m) => ({ default: m.FridgeTemperatureManager })));
const RecipeManager = lazy(() => import("@/components/RecipeManager").then((m) => ({ default: m.RecipeManager })));
const CleaningManager = lazy(() => import("@/components/CleaningManager").then((m) => ({ default: m.CleaningManager })));
const GlaceStuffControl = lazy(() => import("@/components/GlaceStuffControl").then((m) => ({ default: m.GlaceStuffControl })));
const InventoryModule = lazy(() => import("@/components/inventory/InventoryModule").then((m) => ({ default: m.InventoryModule })));
const EcartModule = lazy(() => import("@/components/EcartModule").then((m) => ({ default: m.EcartModule })));
const PepModule = lazy(() => import("@/components/pep/PepModule").then((m) => ({ default: m.PepModule })));
const TechModule = lazy(() => import("@/components/tech/TechModule").then((m) => ({ default: m.TechModule })));
const UserManagement = lazy(() => import("@/components/auth/UserManagement").then((m) => ({ default: m.UserManagement })));
const AnomalyCenter = lazy(() => import("@/components/anomalies/AnomalyCenter").then((m) => ({ default: m.AnomalyCenter })));
import { LayoutDashboard, History, PlusCircle, Database, FileText, BarChart3, ClipboardList, Boxes, ClipboardCheck, CalendarDays, ArrowRight, Thermometer, ChefHat, Sparkles, PackageCheck, Snowflake, Scale, CalendarClock, Wrench } from "lucide-react";
import { PepTodayCard } from "@/components/pep/PepTodayCard";
import { TechAlertsCard } from "@/components/tech/TechAlertsCard";
import { isTechEnabled } from "@/lib/techFeature";
import logo from "@/assets/logo.jpeg";
import { ENABLE_DASHBOARD_ORDER_TABLE } from "@/lib/featureFlags";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/auth/UserMenu";

type Tab = "dashboard" | "stock-initial" | "mouvements" | "historique" | "produit" | "requisition" | "lots" | "autocontrole" | "stuffs-glace" | "hebdo" | "temperatures" | "recettes" | "nettoyage" | "inventaire" | "ecarts" | "pep" | "tech";

const Index = () => {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showStock, setShowStock] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAnomalies, setShowAnomalies] = useState(false);

  // Charge le catalogue produits personnalisé (ajouts / modifications / suppressions)
  useEffect(() => {
    void loadProductCatalog().then(() => setRefreshKey((k) => k + 1));
  }, []);
  const { can, isAdmin, isRegionalAdmin, user } = useAuth();
  const TECH_ENABLED = isTechEnabled(user?.email);

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
    { id: "stuffs-glace" as Tab, label: "Contrôle STUFFS de glace", icon: Snowflake, perm: "view_autocontrol" },
    { id: "hebdo" as Tab, label: "Suivi hebdomadaire", icon: CalendarDays, perm: "view_weekly" },
    { id: "temperatures" as Tab, label: "Températures frigos", icon: Thermometer, perm: "view_temperatures" },
    { id: "nettoyage" as Tab, label: "Nettoyage", icon: Sparkles, perm: "view_cleaning" },
    { id: "ecarts" as Tab, label: "Calcul des écarts", icon: Scale, perm: "view_ecarts" },
    { id: "pep" as Tab, label: "Agenda PEP", icon: CalendarClock, perm: "view_pep" },
    { id: "tech" as Tab, label: "Suivi Technique", icon: Wrench, perm: "view_tech" },
  ];
  const tabs = allTabs.filter((t) => can(t.perm) && (t.id !== "tech" || TECH_ENABLED));

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
          <UserMenu
            onOpenAdmin={() => { setShowAnomalies(false); setShowAdmin(true); }}
            onOpenAnomalies={() => { setShowAdmin(false); setShowAnomalies(true); }}
          />
        </div>
      </header>

      {showAnomalies && (isAdmin || isRegionalAdmin) ? (
        <main className="max-w-5xl mx-auto px-4 py-6">
          <Suspense fallback={<TabFallback />}>
            <AnomalyCenter onBack={() => setShowAnomalies(false)} />
          </Suspense>
        </main>
      ) : showAdmin && (isAdmin || isRegionalAdmin) ? (
        <main className="max-w-5xl mx-auto px-4 py-6">
          <Suspense fallback={<TabFallback />}>
            <UserManagement onBack={() => setShowAdmin(false)} />
          </Suspense>
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

            {/* Agenda PEP — uniquement les tâches du jour */}
            {can("view_pep") && <PepTodayCard onOpen={() => setTab("pep")} />}

            {/* Suivi Technique — signalements, retards, refus manager */}
            {TECH_ENABLED && can("view_tech") && <TechAlertsCard onOpen={() => setTab("tech")} />}

            {/* Stock Alerts */}
            <StockOutAlerts />

            {/* Stock minimum atteint */}
            <LowStockAlerts />

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
              {showStock && (
                <Suspense fallback={<TabFallback />}>
                  <StockTable variant="order" />
                </Suspense>
              )}
            </div>
            )}


          </></div>
        )}

        {tab !== "dashboard" && (
          <Suspense fallback={<TabFallback />}>
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
            {tab === "stuffs-glace" && <GlaceStuffControl />}
            {tab === "hebdo" && <WeeklyTracking />}
            {tab === "temperatures" && <FridgeTemperatureManager />}
            {tab === "recettes" && <RecipeManager />}
            {tab === "nettoyage" && <CleaningManager />}
            {tab === "inventaire" && <InventoryModule />}
            {tab === "ecarts" && <EcartModule />}
            {tab === "pep" && <PepModule />}
            {TECH_ENABLED && tab === "tech" && <TechModule />}
          </Suspense>
        )}
      </main>
      </>
      )}
    </div>
  );
};

export default Index;

function TabFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
      Chargement…
    </div>
  );
}
