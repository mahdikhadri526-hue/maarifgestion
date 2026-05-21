import { useState, useEffect } from "react";
import {
  Category,
  UnitType,
  setProductUnit,
  getMovements,
  getInitialStocks,
  getProductUnits,
  getProductUnitConfigs,
  movementPiecesToDisplay,
  roundStockQuantity,
} from "@/lib/stockData";
import { isRequisitionProduct } from "@/lib/requisitionData";
import { useStockLevels } from "@/hooks/useStockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.jpeg";
import { useAuth } from "@/contexts/AuthContext";
import { ENABLE_ORDER_COLUMNS } from "@/lib/featureFlags";
import { supabase } from "@/integrations/supabase/client";

const TARTE_ARTICLES = [
  "Tarte 6", "Tarte 8", "Tarte 10", "Tte Sp.", "Tte.Sp 8", "Tte Mac.", "Tte Sor.",
  "Tche Sor.", "Tche Mac.", "Tche Nap.", "Bûche", "Bûche Sp.", "N.F", "Demis",
  "Maria Louisa", "Maria mangue", "Maria framboise", "M.Loulou", "Chanty.Fruit confits", "Panachés",
  "Mac.Chocolat P", "Mac.Pistache P", "Mac.Caramel P", "Mac.Cfé P", "Mac.Mng P", "Mac.Cit P",
  "Mac.Chocolat N", "Mac.Pistache N", "Mac.Caramel N", "Mac.Cfé N", "Mac.Mng N", "Mac.Cit N",
  "Chantilly,F,C", "Cho.Logo", "PJA", "Cho.Blnc", "Amd.Crml", "Sirop.Blc", "Sirop.Crml",
  "Merg.trt", "Merg.Pt KG", "Merg.Pt SCH", "Merg.Glacé", "Org.Confit", "Biscuit",
  "Bigarreaux", "Cake Chocolat", "Cake.citron", "Pain Savoi", "Brownies.G", "Brownies.Top",
  "Amandes.Top", "Noix.Top", "Tulipes", "Cornet", "Gaufrette",
  "Orange", "Citron", "POMME", "POIRE", "Ananas",
];
const GLACE_ARTICLES = [
  "Sicilienne vanille", "Sicilienne chocolat", "Sicilienne fraise", "Sicilienne mangue",
  "Nougat", "Praliné", "Vanille", "Chocolat", "Pistache", "Caramel", "Moka",
  "Parfait", "Fraise", "Framboise", "Orange", "Mangue", "Citron", "Pêche",
  "Banane", "Citron menthe", "Orange cannelle", "Réglisse",
  "Crème fraîche (mousse fouettée)",
];

const UNITS: UnitType[] = ["PIECE", "KILO", "LITRE", "PAQUET", "COLIS", "ROULEAU"];
const UNIT_LABELS: Record<UnitType, string> = { PIECE: "Pièce", KILO: "Kilo", LITRE: "Litre", PAQUET: "Paquet", COLIS: "Colis", ROULEAU: "Rouleau" };

type FilterMode = "all" | "day" | "month" | "period";
const todayISO = () => new Date().toISOString().split("T")[0];
const currentMonthISO = () => new Date().toISOString().slice(0, 7);

export function StockTable({ variant = "stock" }: { variant?: "stock" | "order" } = {}) {
  const [category, setCategory] = useState<Category | "all" | "tarte" | "glace">(variant === "order" ? "alimentaire" : "all");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<FilterMode>(variant === "order" ? "month" : "all");
  const [day, setDay] = useState<string>(todayISO());
  const [month, setMonth] = useState<string>(currentMonthISO());
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>(todayISO());
  const [periodTotals, setPeriodTotals] = useState<Record<string, { stockInitial: number; entrees: number; sorties: number; stockRestant: number }>>({});
  const [periodLoading, setPeriodLoading] = useState(false);
  const [weeklyRows, setWeeklyRows] = useState<Array<{ article: string; sorties: number; stockActuel: number }>>([]);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const { can } = useAuth();

  const isWeeklyCat = category === "tarte" || category === "glace";
  const stockCategory = category === "alimentaire" || category === "emballage" ? category : undefined;
  const { data: levels, loading, refresh } = useStockLevels(stockCategory);
  const filtered = (isWeeklyCat ? [] : (levels || [])).filter((l) =>
    l.productName.toLowerCase().includes(search.toLowerCase())
  );

  // Load weekly_tracking data for Tarte/Glace categories
  useEffect(() => {
    if (variant !== "order" || !isWeeklyCat) {
      setWeeklyRows([]);
      return;
    }
    let cancelled = false;
    setWeeklyLoading(true);
    (async () => {
      let q = supabase
        .from("weekly_tracking")
        .select("article, sorties, entrees, stock_initial, day_of_week, week_start, fiche_type, row_index")
        .eq("fiche_type", "Mouvement glaces & tartes")
        .range(0, 5000);
      const { data } = await q;
      if (cancelled) return;
      const list = category === "tarte" ? TARTE_ARTICLES : GLACE_ARTICLES;
      const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
      const isoDate = (base: string, offset: number) => {
        const [y, m, d] = base.split("-").map(Number);
        const date = new Date(y, (m || 1) - 1, d || 1);
        date.setDate(date.getDate() + offset);
        const yy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yy}-${mm}-${dd}`;
      };
      const isInSelectedPeriod = (date: string) => {
        if (mode === "day") return day ? date === day : true;
        if (mode === "month") return month ? date.startsWith(month) : true;
        if (mode === "period") {
          if (start && date < start) return false;
          if (end && date > end) return false;
          return true;
        }
        return true;
      };
      const num = (v: any) => {
        if (v === "" || v == null) return 0;
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      };
      // Group rows by week + article
      type Cell = { stock_initial: number | null; entrees: number; sorties: number | null };
      const map = new Map<string, Map<string, Map<number, Cell>>>(); // week -> article -> dayIdx -> cell
      (data || []).forEach((r: any) => {
        const article = r.article;
        if (!article || !list.includes(article)) return;
        const dayIdx = DAYS.indexOf(r.day_of_week);
        if (dayIdx < 0) return;
        if (!map.has(r.week_start)) map.set(r.week_start, new Map());
        const wm = map.get(r.week_start)!;
        if (!wm.has(article)) wm.set(article, new Map());
        const am = wm.get(article)!;
        const cur = am.get(dayIdx) ?? { stock_initial: null, entrees: 0, sorties: null };
        if (r.stock_initial != null) cur.stock_initial = num(r.stock_initial);
        cur.entrees += num(r.entrees);
        if (r.sorties != null) cur.sorties = (cur.sorties ?? 0) + num(r.sorties);
        am.set(dayIdx, cur);
      });
      const totals: Record<string, number> = {};
      list.forEach((a) => (totals[a] = 0));
      // Même calcul que le Suivi hebdo, y compris Dimanche -> Lundi suivant.
      const getCell = (week: string, article: string, d: number) => map.get(week)?.get(article)?.get(d);
      const getSortie = (week: string, article: string, d: number) => {
        const cell = getCell(week, article, d);
        if (!cell) return 0;
        if (d >= DAYS.length - 1) {
          const nextMonday = getCell(isoDate(week, 7), article, 0);
          if (cell.stock_initial != null && nextMonday?.stock_initial != null) {
            return Math.max(0, cell.stock_initial + cell.entrees - nextMonday.stock_initial);
          }
          return cell.sorties != null ? Math.max(0, cell.sorties) : 0;
        }
        const next = getCell(week, article, d + 1);
        if (cell.stock_initial != null && next?.stock_initial != null) {
          return Math.max(0, cell.stock_initial + cell.entrees - next.stock_initial);
        }
        return 0;
      };
      const latestStock: Record<string, { date: string; value: number }> = {};
      const weekKeys = Array.from(map.keys()).sort();
      for (const week of weekKeys) {
        const wm = map.get(week)!;
        wm.forEach((am, article) => {
          let runningStock: number | null = null;
          for (let d = 0; d < DAYS.length; d++) {
            const cell = am.get(d);
            if (!cell) continue;
            const date = isoDate(week, d);
            const sortie = getSortie(week, article, d);
            if (isInSelectedPeriod(date)) totals[article] += sortie;
            if (cell.stock_initial != null) runningStock = cell.stock_initial;
            if (runningStock != null) runningStock = Math.max(0, runningStock + cell.entrees - sortie);
            const currentStock = runningStock ?? cell.stock_initial;
            if (currentStock != null) {
              const cur = latestStock[article];
              if (!cur || date >= cur.date) latestStock[article] = { date, value: currentStock };
            }
          }
        });
      }
      setWeeklyRows(list.map((article) => ({
        article,
        sorties: totals[article],
        stockActuel: latestStock[article]?.value ?? 0,
      })));
      setWeeklyLoading(false);
    })();
    return () => { cancelled = true; };
  }, [variant, category, isWeeklyCat, mode, day, month, start, end]);

  // Recalcule les totaux par produit selon le filtre période
  useEffect(() => {
    if (mode === "all" || !levels || isWeeklyCat) {
      setPeriodTotals({});
      return;
    }
    let cancelled = false;
    setPeriodLoading(true);
    (async () => {
      const matchDate = (d: string) => {
        const dd = d.slice(0, 10);
        if (mode === "day") return day ? dd === day : true;
        if (mode === "month") return month ? dd.startsWith(month) : true;
        if (mode === "period") {
          if (start && dd < start) return false;
          if (end && dd > end) return false;
          return true;
        }
        return true;
      };
      const isBefore = (d: string) => {
        const dd = d.slice(0, 10);
        if (mode === "day") return dd < day;
        if (mode === "month") return dd < `${month}-01`;
        if (mode === "period") return start ? dd < start : false;
        return false;
      };
      // Fetch global data ONCE instead of per-product (avoids N+1 round-trips)
      const [allMovements, initialStocks, units, configs] = await Promise.all([
        getMovements(),
        getInitialStocks(),
        getProductUnits(),
        getProductUnitConfigs(),
      ]);
      // Group movements by productId -> date -> { entrees, sorties }
      const byProduct: Record<string, Record<string, { entrees: number; sorties: number }>> = {};
      const productIds = new Set<string>();
      levels.forEach((l) => productIds.add(l.productId));
      allMovements.forEach((m) => {
        if (!productIds.has(m.productId)) return;
        const unit = units[m.productId] || "PIECE";
        const cfg = configs[m.productId];
        const dq = movementPiecesToDisplay(m.quantity, unit, cfg);
        const d = m.date.split("T")[0];
        if (!byProduct[m.productId]) byProduct[m.productId] = {};
        const bd = byProduct[m.productId];
        if (!bd[d]) bd[d] = { entrees: 0, sorties: 0 };
        if (m.type === "entree") bd[d].entrees += dq;
        else bd[d].sorties += dq;
      });
      const results: Record<string, { stockInitial: number; entrees: number; sorties: number; stockRestant: number }> = {};
      levels.forEach((lvl) => {
        const initial = initialStocks[lvl.productId] || 0;
        const byDate = byProduct[lvl.productId] || {};
        const dates = Object.keys(byDate).sort();
        let cumul = initial;
        let stockInitialPeriod: number | null = null;
        let stockRestantPeriod = initial;
        let entreesPeriod = 0;
        let sortiesPeriod = 0;
        let lastBeforeRestant = initial;
        for (const date of dates) {
          const stockInitialDay = cumul;
          const { entrees, sorties } = byDate[date];
          cumul = stockInitialDay + entrees - sorties;
          if (matchDate(date)) {
            if (stockInitialPeriod === null) stockInitialPeriod = stockInitialDay;
            entreesPeriod += entrees;
            sortiesPeriod += sorties;
            stockRestantPeriod = cumul;
          } else if (isBefore(date)) {
            lastBeforeRestant = cumul;
          }
        }
        if (stockInitialPeriod === null) {
          stockInitialPeriod = lastBeforeRestant;
          stockRestantPeriod = lastBeforeRestant;
        }
        results[lvl.productId] = {
          stockInitial: roundStockQuantity(stockInitialPeriod),
          entrees: roundStockQuantity(entreesPeriod),
          sorties: roundStockQuantity(sortiesPeriod),
          stockRestant: roundStockQuantity(stockRestantPeriod),
        };
      });
      if (!cancelled) {
        setPeriodTotals(results);
        setPeriodLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, day, month, start, end, levels, variant, isWeeklyCat]);

  const cycleUnit = async (productId: string, currentUnit: UnitType) => {
    const nextIndex = (UNITS.indexOf(currentUnit) + 1) % UNITS.length;
    const nextUnit = UNITS[nextIndex];
    try {
      await setProductUnit(productId, nextUnit);
      refresh();
      toast.success(`Unité changée en ${UNIT_LABELS[nextUnit]}`);
    } catch {
      toast.error("Erreur lors du changement d'unité");
    }
  };

  const getRowValues = (level: typeof filtered[number]) => {
    if (mode === "all") {
      return {
        stockInitial: level.stockInitial,
        entrees: level.totalEntrees,
        sorties: level.totalSorties,
        stockRestant: level.stockRestant,
      };
    }
    return periodTotals[level.productId] ?? { stockInitial: 0, entrees: 0, sorties: 0, stockRestant: 0 };
  };

  return (
    <div className="bg-card rounded-lg border animate-fade-in">
      <div className="p-4 border-b">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              <img src={logo} alt="Logo" className="w-full h-full object-cover" />
            </div>
            {variant === "order" ? "Commande" : "Stock Restant"}
          </h2>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <div className="flex rounded-md border overflow-hidden">
              {(variant === "order"
                ? (["alimentaire", "emballage", "tarte", "glace"] as const)
                : (["all", "alimentaire", "emballage"] as const)
              ).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat as any)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {cat === "all" ? "Tout" : cat === "alimentaire" ? "Alimentaire" : cat === "emballage" ? "Emballage" : cat === "tarte" ? "Tartes" : "Glaces"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filtres par date */}
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {variant !== "order" && (
              <Button size="sm" variant={mode === "all" ? "default" : "outline"} onClick={() => setMode("all")}>Tout</Button>
            )}
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
      </div>
      {(loading || periodLoading || weeklyLoading) ? (
        <p className="text-center text-muted-foreground py-8">Chargement...</p>
      ) : isWeeklyCat ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Article</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sorties période</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock actuel</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qté à commander</th>
              </tr>
            </thead>
            <tbody>
              {weeklyRows
                .filter((r) => r.article.toLowerCase().includes(search.toLowerCase()))
                .map((r) => (
                  <tr key={r.article} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-sm font-medium">{r.article}</td>
                    <td className="p-3 text-right font-mono text-sm text-accent-foreground">{r.sorties}</td>
                    <td className="p-3 text-right font-mono text-sm">{r.stockActuel}</td>
                    <td className="p-3 text-right font-mono text-sm font-semibold text-warning">{Math.max(0, r.sorties - r.stockActuel)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {weeklyRows.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Aucune donnée</p>
          )}
        </div>
      ) : variant === "order" ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sorties période</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock actuel</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qté à commander</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((level) => {
                const v = getRowValues(level);
                const stockActuel = level.stockRestant;
                const aCommander = Math.max(0, v.sorties - stockActuel);
                return (
                  <tr key={level.productId} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                    isRequisitionProduct(level.productId) ? "bg-amber-50 dark:bg-amber-950/20" : ""
                  }`}>
                    <td className="p-3 text-sm font-medium flex items-center gap-1.5">
                      {isRequisitionProduct(level.productId) && <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />}
                      {level.productName}
                    </td>
                    <td className="p-3 text-right font-mono text-sm text-accent-foreground">{v.sorties}</td>
                    <td className="p-3 text-right font-mono text-sm">{stockActuel}</td>
                    <td className="p-3 text-right font-mono text-sm font-semibold text-warning">{aCommander}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Aucun produit trouvé</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unité</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Catégorie</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Initial</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entrées</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sorties</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((level) => {
                const v = getRowValues(level);
                return (
                <tr key={level.productId} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                  isRequisitionProduct(level.productId) ? "bg-amber-50 dark:bg-amber-950/20" : ""
                }`}>
                  <td className="p-3 text-sm font-medium flex items-center gap-1.5">
                    {isRequisitionProduct(level.productId) && <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />}
                    {level.productName}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => {
                        if (can("edit_stock")) {
                          cycleUnit(level.productId, level.unit);
                        } else {
                          toast.error("Opération non autorisée");
                        }
                      }}
                      className="cursor-pointer text-xs px-2 py-1 rounded-md border font-medium transition-colors hover:bg-muted select-none"
                      title="Cliquer pour changer l'unité"
                    >
                      {UNIT_LABELS[level.unit] || "Pièce"}
                    </button>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      level.category === "alimentaire"
                        ? "bg-primary/10 text-primary"
                        : "bg-accent/10 text-accent-foreground"
                    }`}>
                      {level.category === "alimentaire" ? "Alimentaire" : "Emballage"}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-primary">{v.stockInitial}</td>
                  <td className="p-3 text-right font-mono text-sm text-success">{v.entrees}</td>
                  <td className="p-3 text-right font-mono text-sm text-accent-foreground">{v.sorties}</td>
                  <td className={`p-3 text-right font-mono text-sm font-semibold ${
                    v.stockRestant < 0 ? "text-destructive" : v.stockRestant === 0 ? "text-muted-foreground" : ""
                  }`}>
                    {v.stockRestant}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Aucun produit trouvé</p>
          )}
        </div>
      )}
      <PinPromptDialog
        open={!!pendingUnit}
        onOpenChange={(open) => !open && setPendingUnit(null)}
        title="Changer l'unité"
        description="Entrez le code à 4 chiffres pour autoriser le changement d'unité."
        onConfirm={() => {
          if (pendingUnit) {
            const { productId, currentUnit } = pendingUnit;
            setPendingUnit(null);
            cycleUnit(productId, currentUnit);
          }
        }}
      />
    </div>
  );
}