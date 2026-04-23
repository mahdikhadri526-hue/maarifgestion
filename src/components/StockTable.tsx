import { useState, useEffect } from "react";
import { Category, UnitType, setProductUnit, getProductDailyHistory } from "@/lib/stockData";
import { isRequisitionProduct } from "@/lib/requisitionData";
import { useStockLevels } from "@/hooks/useStockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.jpeg";
import { PinPromptDialog } from "./PinPromptDialog";

const UNITS: UnitType[] = ["PIECE", "KILO", "LITRE", "PAQUET", "COLIS", "ROULEAU"];
const UNIT_LABELS: Record<UnitType, string> = { PIECE: "Pièce", KILO: "Kilo", LITRE: "Litre", PAQUET: "Paquet", COLIS: "Colis", ROULEAU: "Rouleau" };

type FilterMode = "all" | "day" | "month" | "period";
const todayISO = () => new Date().toISOString().split("T")[0];
const currentMonthISO = () => new Date().toISOString().slice(0, 7);

export function StockTable({ variant = "stock" }: { variant?: "stock" | "order" } = {}) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [pendingUnit, setPendingUnit] = useState<{ productId: string; currentUnit: UnitType } | null>(null);
  const [mode, setMode] = useState<FilterMode>("all");
  const [day, setDay] = useState<string>(todayISO());
  const [month, setMonth] = useState<string>(currentMonthISO());
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>(todayISO());
  const [periodTotals, setPeriodTotals] = useState<Record<string, { stockInitial: number; entrees: number; sorties: number; stockRestant: number }>>({});
  const [periodLoading, setPeriodLoading] = useState(false);

  const { data: levels, loading, refresh } = useStockLevels(category === "all" ? undefined : category);
  const filtered = (levels || []).filter((l) =>
    l.productName.toLowerCase().includes(search.toLowerCase())
  );

  // Recalcule les totaux par produit selon le filtre période
  useEffect(() => {
    if (variant !== "order" || mode === "all" || !levels) {
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
      const results: Record<string, { stockInitial: number; entrees: number; sorties: number; stockRestant: number }> = {};
      await Promise.all(
        levels.map(async (lvl) => {
          const h = await getProductDailyHistory(lvl.productId);
          const inPeriod = h.filter((r) => matchDate(r.date));
          let stockInitial = 0;
          let stockRestant = 0;
          if (inPeriod.length > 0) {
            stockInitial = inPeriod[0].stockInitial;
            stockRestant = inPeriod[inPeriod.length - 1].stockRestant;
          } else {
            const before = h.filter((r) => isBefore(r.date));
            const last = before[before.length - 1];
            stockInitial = last ? last.stockRestant : (h[0]?.stockInitial ?? 0);
            stockRestant = stockInitial;
          }
          results[lvl.productId] = {
            stockInitial,
            entrees: inPeriod.reduce((s, r) => s + r.entrees, 0),
            sorties: inPeriod.reduce((s, r) => s + r.sorties, 0),
            stockRestant,
          };
        })
      );
      if (!cancelled) {
        setPeriodTotals(results);
        setPeriodLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, day, month, start, end, levels, variant]);

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
    if (variant !== "order" || mode === "all") {
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
            {variant === "order" ? "Qté à commander" : "Stock Restant"}
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
              {(["all", "alimentaire", "emballage"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {cat === "all" ? "Tout" : cat === "alimentaire" ? "Alimentaire" : "Emballage"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filtres par date - uniquement pour la variante "order" */}
        {variant === "order" && (
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
      {loading || periodLoading ? (
        <p className="text-center text-muted-foreground py-8">Chargement...</p>
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
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock actuel</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qté à commander</th>
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
                      onClick={() => setPendingUnit({ productId: level.productId, currentUnit: level.unit })}
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
                  <td className="p-3 text-right font-mono text-sm text-muted-foreground">
                    {level.stockRestant}
                  </td>
                  <td className="p-3 text-right font-mono text-sm font-semibold text-warning">
                    {mode === "all" ? "-" : Math.max(0, v.sorties - level.stockRestant)}
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