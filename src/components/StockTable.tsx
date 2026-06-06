import { useState, useEffect } from "react";
import {
  Category,
  UnitType,
  setProductUnit,
  getMovements,
  getGlaceAggregateForRange,
  getInitialStocks,
  getProductUnits,
  getProductUnitConfigs,
  movementPiecesToDisplay,
  roundStockQuantity,
  setInitialStock,
} from "@/lib/stockData";
import { isRequisitionProduct } from "@/lib/requisitionData";
import { useStockLevels } from "@/hooks/useStockData";
import { fetchAllRows } from "@/lib/supabasePaginate";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Save, History, Trash2, FileDown } from "lucide-react";
import { getOperators } from "@/lib/operators";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import logo from "@/assets/logo.jpeg";
import { useAuth } from "@/contexts/AuthContext";
import { ENABLE_ORDER_COLUMNS } from "@/lib/featureFlags";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { downloadStructuredPdf } from "@/lib/printExport";

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
  "Orange fruits", "Citron fruits", "POMME fruits", "POIRE fruits", "Ananas fruits", "Kiwi fruits",
];
const MACARON_ARTICLES = [
  "Mac.Chocolat P", "Mac.Pistache P", "Mac.Caramel P", "Mac.Cfé P", "Mac.Mng P", "Mac.Cit P",
  "Mac.Chocolat N", "Mac.Pistache N", "Mac.Caramel N", "Mac.Cfé N", "Mac.Mng N", "Mac.Cit N",
];
const MACARON_AGG_ID = "__macaron_agg__";
const GLACE_ARTICLES = [
  "Sicilienne vanille", "Sicilienne chocolat", "Sicilienne fraise", "Sicilienne mangue",
  "Nougat", "Praliné", "Vanille", "Chocolat", "Pistache", "Caramel", "Moka",
  "Parfait", "Fraise", "Framboise", "Orange", "Mangue", "Citron", "Pêche",
  "Banane", "Citron menthe", "Orange cannelle", "Réglisse",
  "Crème fraîche (mousse fouettée)",
];

const UNITS: UnitType[] = ["PIECE", "KILO", "LITRE", "PAQUET", "COLIS", "ROULEAU"];
const UNIT_LABELS: Record<UnitType, string> = { PIECE: "Pièce", KILO: "Kilo", LITRE: "Litre", PAQUET: "Paquet", COLIS: "Colis", ROULEAU: "Rouleau" };
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

type WeeklyTrackingOrderRecord = {
  article: string | null;
  sorties: number | string | null;
  entrees: number | string | null;
  stock_initial: number | string | null;
  day_of_week: string;
  week_start: string;
};

function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function trackingDate(weekStart: string, dayIdx: number) {
  const date = parseISODate(weekStart);
  // Les anciennes fiches ont parfois un week_start au dimanche : on les corrige
  // ici pour que Commande lise toujours les mêmes dates que le suivi hebdo.
  date.setDate(date.getDate() + dayIdx + (date.getDay() === 0 ? 1 : 0));
  return formatISODate(date);
}

function numericValue(value: unknown) {
  if (value === "" || value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildWeeklyOrderRows(
  records: WeeklyTrackingOrderRecord[],
  articles: readonly string[],
  isInSelectedPeriod: (date: string) => boolean,
) {
  type DayBucket = { si: number | null; entrees: number; explicitSorties: number };
  const articleSet = new Set(articles);
  const byArticle = new Map<string, Map<string, DayBucket>>();
  const ensureBucket = (article: string, date: string) => {
    if (!byArticle.has(article)) byArticle.set(article, new Map());
    const days = byArticle.get(article)!;
    if (!days.has(date)) days.set(date, { si: null, entrees: 0, explicitSorties: 0 });
    return days.get(date)!;
  };

  records.forEach((r) => {
    const article = (r.article ?? "").trim();
    if (!articleSet.has(article)) return;
    const dayIdx = DAYS.indexOf(r.day_of_week as typeof DAYS[number]);
    if (dayIdx < 0 || !r.week_start) return;
    const bucket = ensureBucket(article, trackingDate(r.week_start, dayIdx));
    if (r.stock_initial !== "" && r.stock_initial != null) bucket.si = numericValue(r.stock_initial);
    bucket.entrees += numericValue(r.entrees);
    if (r.sorties !== "" && r.sorties != null) bucket.explicitSorties += numericValue(r.sorties);
  });

  const totals: Record<string, number> = {};
  const latestStock: Record<string, number> = {};
  articles.forEach((article) => {
    totals[article] = 0;
    latestStock[article] = 0;
  });

  byArticle.forEach((days, article) => {
    const entries = Array.from(days.entries()).sort(([a], [b]) => a.localeCompare(b));
    const closedDates = new Set<string>();
    let prevSI: number | null = null;
    let spanStart: string | null = null;
    let pendingEntries = 0;

    for (const [date, bucket] of entries) {
      if (bucket.si != null) {
        if (prevSI != null && spanStart) {
          const sortie = Math.max(0, prevSI + pendingEntries - bucket.si);
          if (isInSelectedPeriod(spanStart)) totals[article] += sortie;
          for (let d = parseISODate(spanStart); formatISODate(d) < date; d.setDate(d.getDate() + 1)) {
            closedDates.add(formatISODate(d));
          }
        }
        prevSI = bucket.si;
        spanStart = date;
        pendingEntries = bucket.entrees;
        latestStock[article] = bucket.si;
      } else {
        pendingEntries += bucket.entrees;
      }
    }

    entries.forEach(([date, bucket]) => {
      if (bucket.explicitSorties > 0 && !closedDates.has(date) && isInSelectedPeriod(date)) {
        totals[article] += bucket.explicitSorties;
      }
    });

    if (prevSI != null) {
      const openExplicit = entries.reduce((sum, [date, bucket]) => (
        !closedDates.has(date) && bucket.explicitSorties > 0 ? sum + bucket.explicitSorties : sum
      ), 0);
      latestStock[article] = Math.max(0, prevSI + pendingEntries - openExplicit);
    }
  });

  return articles.map((article) => ({
    article,
    sorties: roundStockQuantity(totals[article] ?? 0),
    stockActuel: roundStockQuantity(latestStock[article] ?? 0),
  }));
}

function buildWeeklyAggregateTotals(
  records: WeeklyTrackingOrderRecord[],
  articles: readonly string[],
  isInSelectedPeriod: (date: string) => boolean,
  matchAll: boolean,
) {
  type DayBucket = { si: number | null; entrees: number; explicitSorties: number };
  const articleSet = new Set(articles);
  const byArticle = new Map<string, Map<string, DayBucket>>();
  const ensureBucket = (article: string, date: string) => {
    if (!byArticle.has(article)) byArticle.set(article, new Map());
    const days = byArticle.get(article)!;
    if (!days.has(date)) days.set(date, { si: null, entrees: 0, explicitSorties: 0 });
    return days.get(date)!;
  };
  records.forEach((r) => {
    const article = (r.article ?? "").trim();
    if (!articleSet.has(article)) return;
    const dayIdx = DAYS.indexOf(r.day_of_week as typeof DAYS[number]);
    if (dayIdx < 0 || !r.week_start) return;
    const bucket = ensureBucket(article, trackingDate(r.week_start, dayIdx));
    if (r.stock_initial !== "" && r.stock_initial != null) bucket.si = numericValue(r.stock_initial);
    bucket.entrees += numericValue(r.entrees);
    if (r.sorties !== "" && r.sorties != null) bucket.explicitSorties += numericValue(r.sorties);
  });

  let aggStockInitial = 0;
  let aggEntrees = 0;
  let aggSorties = 0;
  let aggRestant = 0;

  articles.forEach((article) => {
    const days = byArticle.get(article);
    if (!days) return;
    const entries = Array.from(days.entries()).sort(([a], [b]) => a.localeCompare(b));
    const closedDates = new Set<string>();
    let prevSI: number | null = null;
    let spanStart: string | null = null;
    let pendingEntries = 0;
    let totalSortiesArt = 0;
    let latestStock = 0;
    let stockInitialPeriod: number | null = null;
    let lastSIBeforePeriod = 0;
    let entreesPeriodArt = 0;

    for (const [date, bucket] of entries) {
      if (bucket.si != null) {
        if (prevSI != null && spanStart) {
          const sortie = Math.max(0, prevSI + pendingEntries - bucket.si);
          if (isInSelectedPeriod(spanStart)) totalSortiesArt += sortie;
          for (let d = parseISODate(spanStart); formatISODate(d) < date; d.setDate(d.getDate() + 1)) {
            closedDates.add(formatISODate(d));
          }
        }
        prevSI = bucket.si;
        spanStart = date;
        pendingEntries = bucket.entrees;
        latestStock = bucket.si;
        if (isInSelectedPeriod(date)) {
          if (stockInitialPeriod === null) stockInitialPeriod = bucket.si;
        } else {
          lastSIBeforePeriod = bucket.si;
        }
      } else {
        pendingEntries += bucket.entrees;
      }
      if (isInSelectedPeriod(date)) entreesPeriodArt += bucket.entrees;
    }

    entries.forEach(([date, bucket]) => {
      if (bucket.explicitSorties > 0 && !closedDates.has(date) && isInSelectedPeriod(date)) {
        totalSortiesArt += bucket.explicitSorties;
      }
    });

    if (prevSI != null) {
      const openExplicit = entries.reduce((sum, [date, bucket]) => (
        !closedDates.has(date) && bucket.explicitSorties > 0 ? sum + bucket.explicitSorties : sum
      ), 0);
      latestStock = Math.max(0, prevSI + pendingEntries - openExplicit);
    }

    if (stockInitialPeriod === null) stockInitialPeriod = lastSIBeforePeriod;
    aggStockInitial += stockInitialPeriod;
    aggEntrees += entreesPeriodArt;
    aggSorties += totalSortiesArt;
    aggRestant += matchAll ? latestStock : (stockInitialPeriod + entreesPeriodArt - totalSortiesArt);
  });

  return {
    stockInitial: roundStockQuantity(aggStockInitial),
    entrees: roundStockQuantity(aggEntrees),
    sorties: roundStockQuantity(aggSorties),
    stockRestant: roundStockQuantity(aggRestant),
  };
}

type FilterMode = "all" | "day" | "month" | "period";
const todayISO = () => new Date().toISOString().split("T")[0];
const currentMonthISO = () => new Date().toISOString().slice(0, 7);
const monthEndISO = (month: string) => {
  if (!month) return "";
  const [year, monthNumber] = month.split("-").map(Number);
  return formatISODate(new Date(year, monthNumber, 0));
};

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
  const [macaronAgg, setMacaronAgg] = useState<{ stockInitial: number; entrees: number; sorties: number; stockRestant: number } | null>(null);
  const { can } = useAuth();
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  const canEditStock = can("edit_stock");

  // Conversion + Unité Réf. par produit (persistées en local, sans impacter la base)
  const REF_STORAGE_KEY = "stock_ref_conversions_v1";
  type RefRow = { conversion: string; unitRef: string };
  const [refMap, setRefMap] = useState<Record<string, RefRow>>(() => {
    try {
      const raw = localStorage.getItem(REF_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const updateRef = (productId: string, patch: Partial<RefRow>) => {
    setRefMap((prev) => {
      const next = { ...prev, [productId]: { conversion: "", unitRef: "", ...prev[productId], ...patch } };
      try { localStorage.setItem(REF_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const saveStockEdit = async (level: typeof filtered[number]) => {
    const newRestant = Number(editingValue);
    if (!Number.isFinite(newRestant)) {
      toast.error("Valeur invalide");
      setEditingStock(null);
      return;
    }
    const diff = newRestant - level.stockRestant;
    if (diff === 0) {
      setEditingStock(null);
      return;
    }
    try {
      const newInitial = roundStockQuantity(level.stockInitial + diff);
      await setInitialStock(level.productId, newInitial);
      toast.success(`Stock ajusté (initial ${level.stockInitial} → ${newInitial})`);
      setEditingStock(null);
      refresh();
    } catch {
      toast.error("Erreur lors de l'ajustement");
    }
  };

  const isWeeklyCat = category === "tarte" || category === "glace";
  const stockCategory = category === "alimentaire" || category === "emballage" ? category : undefined;
  const { data: levels, loading, refresh } = useStockLevels(stockCategory);
  const NESPRESSO_IDS = ["ali-29", "ali-30", "ali-31", "ali-32"];
  const NESPRESSO_AGG_ID = "__nespresso_agg__";
  const baseLevels = isWeeklyCat ? [] : (levels || []);
  const nespressoSources = baseLevels.filter((l) => NESPRESSO_IDS.includes(l.productId));
  let withAgg = baseLevels;
  if ((category === "all" || category === "alimentaire") && nespressoSources.length > 0) {
    const agg = {
      productId: NESPRESSO_AGG_ID,
      productName: "NESPRESSO (Total)",
      conditionnement: "",
      unit: nespressoSources[0].unit,
      category: "alimentaire" as Category,
      stockInitial: roundStockQuantity(nespressoSources.reduce((s, l) => s + l.stockInitial, 0)),
      totalEntrees: roundStockQuantity(nespressoSources.reduce((s, l) => s + l.totalEntrees, 0)),
      totalSorties: roundStockQuantity(nespressoSources.reduce((s, l) => s + l.totalSorties, 0)),
      stockRestant: roundStockQuantity(nespressoSources.reduce((s, l) => s + l.stockRestant, 0)),
    };
    withAgg = [...baseLevels, agg];
  }
  if (variant === "stock" && category === "all" && macaronAgg) {
    withAgg = [...withAgg, {
      productId: MACARON_AGG_ID,
      productName: "MACARON (tous parfums)",
      conditionnement: "",
      unit: "PIECE" as UnitType,
      category: "alimentaire" as Category,
      stockInitial: macaronAgg.stockInitial,
      totalEntrees: macaronAgg.entrees,
      totalSorties: macaronAgg.sorties,
      stockRestant: macaronAgg.stockRestant,
    }];
  }
  const filtered = withAgg.filter((l) =>
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
      try {
        const data = await fetchAllRows<WeeklyTrackingOrderRecord>(() =>
          supabase
            .from("weekly_tracking")
            .select("article, sorties, entrees, stock_initial, day_of_week, week_start")
            .eq("fiche_type", "Mouvement glaces & tartes"),
        );
        if (cancelled) return;
        const list = category === "tarte" ? TARTE_ARTICLES : GLACE_ARTICLES;
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
        setWeeklyRows(buildWeeklyOrderRows(data || [], list, isInSelectedPeriod));
      } catch (error) {
        if (!cancelled) {
          toast.error("Erreur de chargement des sorties");
          setWeeklyRows([]);
        }
      } finally {
        if (!cancelled) setWeeklyLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [variant, category, isWeeklyCat, mode, day, month, start, end]);

  // Load weekly_tracking data for MACARON aggregate row in Stock Restant
  useEffect(() => {
    if (variant !== "stock" || category !== "all") {
      setMacaronAgg(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAllRows<WeeklyTrackingOrderRecord>(() =>
          supabase
            .from("weekly_tracking")
            .select("article, sorties, entrees, stock_initial, day_of_week, week_start")
            .eq("fiche_type", "Mouvement glaces & tartes")
            .in("article", MACARON_ARTICLES as unknown as string[]),
        );
        if (cancelled) return;
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
        const totals = buildWeeklyAggregateTotals(
          data || [],
          MACARON_ARTICLES,
          isInSelectedPeriod,
          mode === "all",
        );
        setMacaronAgg(totals);
      } catch {
        if (!cancelled) setMacaronAgg(null);
      }
    })();
    return () => { cancelled = true; };
  }, [variant, category, mode, day, month, start, end]);

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
        const dq = movementPiecesToDisplay(m.quantity, unit, cfg, m.productId);
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
      const glaceLevel = levels.find((lvl) => lvl.productName === "GLACE" && lvl.category === "alimentaire");
      if (glaceLevel) {
        const rangeStart = mode === "day" ? day : mode === "month" ? `${month}-01` : mode === "period" ? start : undefined;
        const rangeEnd = mode === "day" ? day : mode === "month" ? monthEndISO(month) : mode === "period" ? end : undefined;
        const glaceAgg = await getGlaceAggregateForRange(rangeStart || undefined, rangeEnd || undefined);
        results[glaceLevel.productId] = {
          stockInitial: roundStockQuantity(glaceAgg.stockInitial),
          entrees: roundStockQuantity(glaceAgg.entrees),
          sorties: roundStockQuantity(glaceAgg.sorties),
          stockRestant: roundStockQuantity(glaceAgg.stockRestant),
        };
      }
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
    if (level.productId === NESPRESSO_AGG_ID) {
      const sum = NESPRESSO_IDS.reduce(
        (acc, id) => {
          const t = periodTotals[id];
          if (!t) return acc;
          return {
            stockInitial: acc.stockInitial + t.stockInitial,
            entrees: acc.entrees + t.entrees,
            sorties: acc.sorties + t.sorties,
            stockRestant: acc.stockRestant + t.stockRestant,
          };
        },
        { stockInitial: 0, entrees: 0, sorties: 0, stockRestant: 0 },
      );
      return {
        stockInitial: roundStockQuantity(sum.stockInitial),
        entrees: roundStockQuantity(sum.entrees),
        sorties: roundStockQuantity(sum.sorties),
        stockRestant: roundStockQuantity(sum.stockRestant),
      };
    }
    if (level.productId === MACARON_AGG_ID) {
      return {
        stockInitial: level.stockInitial,
        entrees: level.totalEntrees,
        sorties: level.totalSorties,
        stockRestant: level.stockRestant,
      };
    }
    return periodTotals[level.productId] ?? { stockInitial: 0, entrees: 0, sorties: 0, stockRestant: 0 };
  };

  // ===== Historique des commandes (variant === "order") =====
  type SavedOrder = {
    id: string;
    order_date: string;
    category: string;
    performed_by: string | null;
    notes: string | null;
    items: { name: string; quantity: number }[];
    total_items: number;
    created_at: string;
  };
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savePerformedBy, setSavePerformedBy] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  // Overrides manuels de "Qté à commander" (clé = productId ou nom d'article pour glace/tarte)
  const [orderQtyOverrides, setOrderQtyOverrides] = useState<Record<string, string>>({});
  const setOverride = (key: string, value: string) => {
    setOrderQtyOverrides((prev) => ({ ...prev, [key]: value }));
  };
  // Livraison en cours par article (clé = nom d'article pour weekly, productId sinon)
  const [livraisonOverrides, setLivraisonOverrides] = useState<Record<string, string>>({});
  const setLivraison = (key: string, value: string) => {
    setLivraisonOverrides((prev) => ({ ...prev, [key]: value }));
  };
  // Dialogue "Choisir une commande" — applique une commande enregistrée à toutes les lignes
  const [pickOrderOpen, setPickOrderOpen] = useState(false);
  const applyOrderAsLivraison = (o: SavedOrder) => {
    const next: Record<string, string> = { ...livraisonOverrides };
    for (const it of o.items || []) {
      const nm = (it.name || "").trim().toLowerCase();
      if (!nm) continue;
      if (isWeeklyCat) {
        // clé = nom d'article (recherche insensible à la casse dans la liste affichée)
        const match = weeklyRows.find((r) => r.article.trim().toLowerCase() === nm);
        if (match) next[match.article] = String(it.quantity);
      } else {
        const match = filtered.find((l) => l.productName.trim().toLowerCase() === nm);
        if (match) next[match.productId] = String(it.quantity);
      }
    }
    setLivraisonOverrides(next);
    setPickOrderOpen(false);
    toast.success(`Livraison appliquée depuis la commande du ${o.order_date}`);
  };

  const loadSavedOrders = async () => {
    const { data, error } = await supabase
      .from("saved_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("Erreur de chargement de l'historique");
      return;
    }
    setSavedOrders((data || []) as any);
  };

  useEffect(() => {
    if (variant !== "order") return;
    loadSavedOrders();
    const ch = supabase
      .channel("saved_orders_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "saved_orders" }, () => loadSavedOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [variant]);

  const buildOrderItems = (): { name: string; quantity: number }[] => {
    if (isWeeklyCat) {
      return weeklyRows
        .map((r) => {
          const liv = Number(livraisonOverrides[r.article] || 0) || 0;
          const def = category === "glace"
            ? Math.max(0, r.sorties - r.stockActuel - liv)
            : Math.max(0, r.sorties - r.stockActuel);
          const ov = orderQtyOverrides[r.article];
          const qty = ov !== undefined && ov !== "" ? Number(ov) : def;
          return { name: r.article, quantity: isNaN(qty) ? 0 : qty };
        })
        .filter((x) => x.quantity > 0);
    }
    return filtered
      .map((level) => {
        const v = getRowValues(level);
        const def = Math.max(0, v.sorties - level.stockRestant);
        const ov = orderQtyOverrides[level.productId];
        const qty = ov !== undefined && ov !== "" ? Number(ov) : def;
        return { name: level.productName, quantity: qty };
      })
      .filter((x) => x.quantity > 0);
  };

  const handleSaveOrder = async () => {
    if (!savePerformedBy.trim()) {
      toast.error("Prénom obligatoire");
      return;
    }
    const items = buildOrderItems();
    if (items.length === 0) {
      toast.error("Aucun produit à commander");
      return;
    }
    setSavingOrder(true);
    const total = items.reduce((a, b) => a + b.quantity, 0);
    const { error } = await supabase.from("saved_orders").insert({
      order_date: new Date().toISOString().slice(0, 10),
      category: String(category),
      performed_by: savePerformedBy.trim(),
      notes: saveNotes.trim() || null,
      items: items as any,
      total_items: total,
    });
    setSavingOrder(false);
    if (error) {
      toast.error("Erreur lors de l'enregistrement");
      return;
    }
    toast.success("Commande enregistrée");
    setSaveOpen(false);
    setSaveNotes("");
    loadSavedOrders();
  };

  const deleteSavedOrder = async (id: string) => {
    if (!confirm("Supprimer cette commande de l'historique ?")) return;
    const { error } = await supabase.from("saved_orders").delete().eq("id", id);
    if (error) { toast.error("Suppression impossible"); return; }
    toast.success("Commande supprimée");
    loadSavedOrders();
  };

  const exportOrderPdf = (
    items: { name: string; quantity: number }[],
    meta: { date: string; category: string; performedBy?: string | null; notes?: string | null },
  ) => {
    if (!items.length) { toast.error("Aucun produit à exporter"); return; }
    downloadStructuredPdf({
      filename: `commande-${meta.category}-${meta.date}.pdf`,
      title: "Bon de commande",
      subtitle: `${meta.category.toUpperCase()} — ${meta.date}`,
      orientation: "portrait",
      singlePage: true,
      meta: [
        meta.performedBy ? `Effectué par : ${meta.performedBy}` : "",
        meta.notes ? `Notes : ${meta.notes}` : "",
      ].filter(Boolean),
      sections: [
        {
          title: "Articles à commander",
          columns: [
            { header: "Article", dataKey: "name", halign: "left" },
            { header: "Qté", dataKey: "qty", halign: "center", width: 18 },
            { header: "Lot 1", dataKey: "lot", halign: "left", width: 38 },
            { header: "Lot 2", dataKey: "lot2", halign: "left", width: 38 },
            { header: "Lot 3", dataKey: "lot3", halign: "left", width: 38 },
          ],
          rows: items.map((it) => ({ name: it.name, qty: it.quantity, lot: " ", lot2: " ", lot3: " " })),
        },
      ],
    });
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
          {variant === "order" && (
            <div className="flex flex-wrap gap-2 mt-1">
              <Button size="sm" variant="default" onClick={() => setSaveOpen(true)}>
                <Save className="h-4 w-4 mr-1" /> Enregistrer la commande
              </Button>
              <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}>
                <History className="h-4 w-4 mr-1" /> Historique ({savedOrders.length})
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPickOrderOpen(true)}>
                Livraison en cours
              </Button>
            </div>
          )}
        </div>
      </div>
      {(loading || periodLoading || weeklyLoading) ? (
        <p className="text-center text-muted-foreground py-8">Chargement...</p>
      ) : isWeeklyCat ? (
        <div className="bg-card rounded-lg border overflow-x-auto max-w-full">
          <table className="weekly-sticky-table text-sm" style={{ borderCollapse: "separate", borderSpacing: 0, width: "max-content", minWidth: "100%", overflow: "visible" }}>
            <thead className="bg-muted sticky top-0 z-30">
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider weekly-sticky-column weekly-sticky-head bg-muted border-r w-[140px] min-w-[140px]" style={{ position: "sticky", left: 0, zIndex: 45 }}>Article</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sorties période</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock actuel</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Livraison en cours</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qté à commander</th>
              </tr>
            </thead>
            <tbody>
              {weeklyRows
                .filter((r) => r.article.toLowerCase().includes(search.toLowerCase()))
                .map((r, rowI) => (
                  <tr key={r.article} className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", rowI % 2 === 1 && "bg-muted/30")}>
                    <td className="p-3 text-sm font-medium weekly-sticky-column border-r bg-card w-[140px] min-w-[140px]" style={{ position: "sticky", left: 0, zIndex: 25 }}>{r.article}</td>
                    <td className="p-3 text-right font-mono text-sm text-accent-foreground">{r.sorties}</td>
                    <td className="p-3 text-right font-mono text-sm">{r.stockActuel}</td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min="0"
                        value={livraisonOverrides[r.article] ?? ""}
                        onChange={(e) => setLivraison(r.article, e.target.value)}
                        className="w-20 text-right bg-background border rounded px-2 py-1 text-sm font-mono"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min="0"
                        value={orderQtyOverrides[r.article] ?? String(
                          category === "glace"
                            ? Math.max(0, r.sorties - r.stockActuel - (Number(livraisonOverrides[r.article] || 0) || 0))
                            : Math.max(0, r.sorties - r.stockActuel)
                        )}
                        onChange={(e) => setOverride(r.article, e.target.value)}
                        className="w-20 text-right bg-background border rounded px-2 py-1 text-sm font-mono font-semibold text-warning"
                      />
                    </td>
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
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Livraison en cours</th>
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
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min="0"
                        value={livraisonOverrides[level.productId] ?? ""}
                        onChange={(e) => setLivraison(level.productId, e.target.value)}
                        className="w-20 text-right bg-background border rounded px-2 py-1 text-sm font-mono"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min="0"
                        value={orderQtyOverrides[level.productId] ?? String(aCommander)}
                        onChange={(e) => setOverride(level.productId, e.target.value)}
                        className="w-20 text-right bg-background border rounded px-2 py-1 text-sm font-mono font-semibold text-warning"
                      />
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
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unité</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversion</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider bg-cyan-50/60 text-cyan-800 border-b border-cyan-200">Unité Réf.</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Catégorie</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entrées</th>
                <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider bg-emerald-50/60 text-emerald-800 border-b border-emerald-200">Entrées Réf.</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sorties</th>
                <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider bg-amber-50/60 text-amber-800 border-b border-amber-200">Sorties Réf.</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock</th>
                <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider bg-indigo-50/60 text-indigo-800 border-b border-indigo-200">Stock Réf.</th>
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
                        if (level.productId === NESPRESSO_AGG_ID || level.productId === MACARON_AGG_ID) return;
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
                  <td className="p-3 text-right">
                    <input
                      type="number"
                      step="any"
                      value={refMap[level.productId]?.conversion ?? ""}
                      onChange={(e) => updateRef(level.productId, { conversion: e.target.value })}
                      placeholder="—"
                      className="w-20 text-right bg-background border rounded px-2 py-1 text-xs font-mono"
                    />
                  </td>
                  <td className="p-3">
                    <select
                      value={refMap[level.productId]?.unitRef ?? ""}
                      onChange={(e) => updateRef(level.productId, { unitRef: e.target.value })}
                      className="w-24 bg-background border rounded px-2 py-1 text-xs"
                    >
                      <option value="">—</option>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="L">L</option>
                      <option value="ml">ml</option>
                      <option value="pièce">pièce</option>
                      <option value="paquet">paquet</option>
                      <option value="carton">carton</option>
                      <option value="bac">bac</option>
                      <option value="boîte">boîte</option>
                      <option value="sachet">sachet</option>
                      <option value="bouteille">bouteille</option>
                      <option value="rouleau">rouleau</option>
                    </select>
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
                  <td className="p-3 text-right font-mono text-sm text-success">{v.entrees}</td>
                  <td className="p-3 text-right font-mono text-sm text-success">
                    {(() => {
                      const conv = parseFloat(refMap[level.productId]?.conversion ?? "");
                      if (!Number.isFinite(conv) || conv === 0) return <span className="text-muted-foreground">—</span>;
                      const val = v.entrees * conv;
                      const display = Number.isInteger(val) ? val : Math.round(val * 100) / 100;
                      return <>{display}{refMap[level.productId]?.unitRef ? <span className="text-[10px] text-muted-foreground ml-1">{refMap[level.productId]?.unitRef}</span> : null}</>;
                    })()}
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-accent-foreground">{v.sorties}</td>
                  <td className="p-3 text-right font-mono text-sm text-accent-foreground">
                    {(() => {
                      const conv = parseFloat(refMap[level.productId]?.conversion ?? "");
                      if (!Number.isFinite(conv) || conv === 0) return <span className="text-muted-foreground">—</span>;
                      const val = v.sorties * conv;
                      const display = Number.isInteger(val) ? val : Math.round(val * 100) / 100;
                      return <>{display}{refMap[level.productId]?.unitRef ? <span className="text-[10px] text-muted-foreground ml-1">{refMap[level.productId]?.unitRef}</span> : null}</>;
                    })()}
                  </td>
                  <td className={`p-3 text-right font-mono text-sm font-semibold ${
                    v.stockRestant < 0 ? "text-destructive" : v.stockRestant === 0 ? "text-muted-foreground" : ""
                  }`}>
                    {mode === "all" && canEditStock && editingStock === level.productId ? (
                      <input
                        type="number"
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => saveStockEdit(level)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveStockEdit(level);
                          if (e.key === "Escape") setEditingStock(null);
                        }}
                        className="w-20 text-right bg-background border rounded px-2 py-1 text-sm"
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={mode !== "all" || !canEditStock || level.productId === NESPRESSO_AGG_ID || level.productId === MACARON_AGG_ID}
                        onClick={() => {
                          if (level.productId === NESPRESSO_AGG_ID || level.productId === MACARON_AGG_ID) return;
                          setEditingStock(level.productId);
                          setEditingValue(String(v.stockRestant));
                        }}
                        className={mode === "all" && canEditStock && level.productId !== NESPRESSO_AGG_ID && level.productId !== MACARON_AGG_ID ? "hover:underline cursor-pointer" : "cursor-default"}
                        title={mode === "all" && canEditStock ? "Cliquer pour ajuster le stock (corrigera le stock initial)" : undefined}
                      >
                        {v.stockRestant}
                      </button>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono text-sm font-semibold">
                    {(() => {
                      const conv = parseFloat(refMap[level.productId]?.conversion ?? "");
                      if (!Number.isFinite(conv) || conv === 0) return <span className="text-muted-foreground">—</span>;
                      const val = v.stockRestant * conv;
                      const display = Number.isInteger(val) ? val : Math.round(val * 100) / 100;
                      return <>{display}{refMap[level.productId]?.unitRef ? <span className="text-[10px] text-muted-foreground ml-1">{refMap[level.productId]?.unitRef}</span> : null}</>;
                    })()}
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

      {variant === "order" && (
        <>
          <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Enregistrer la commande</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {buildOrderItems().length} article(s) à commander seront enregistrés avec la date du jour.
                </p>
                <div>
                  <label className="text-xs font-medium">Effectué par *</label>
                  <select
                    value={savePerformedBy}
                    onChange={(e) => setSavePerformedBy(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Choisir...</option>
                    {getOperators().map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>
                <div className="max-h-48 overflow-auto border rounded-md p-2 text-xs">
                  {buildOrderItems().map((it) => (
                    <div key={it.name} className="flex justify-between py-0.5">
                      <span>{it.name}</span>
                      <span className="font-mono font-semibold">{it.quantity}</span>
                    </div>
                  ))}
                  {buildOrderItems().length === 0 && (
                    <p className="text-muted-foreground text-center py-2">Aucun produit à commander</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveOpen(false)}>Annuler</Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    exportOrderPdf(buildOrderItems(), {
                      date: new Date().toISOString().slice(0, 10),
                      category: String(category),
                      performedBy: savePerformedBy.trim() || null,
                    })
                  }
                >
                  <FileDown className="h-4 w-4 mr-1" /> PDF
                </Button>
                <Button onClick={handleSaveOrder} disabled={savingOrder}>
                  {savingOrder ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Historique des commandes</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {savedOrders.length === 0 && (
                  <p className="text-center text-muted-foreground py-6 text-sm">Aucune commande enregistrée</p>
                )}
                {savedOrders.map((o) => (
                  <div key={o.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-semibold text-sm">
                          {o.order_date} — <span className="capitalize">{o.category}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Par {o.performed_by || "—"} · {o.total_items} unité(s) · {new Date(o.created_at).toLocaleString("fr-FR")}
                        </div>
                        
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => deleteSavedOrder(o.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex justify-end mb-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          exportOrderPdf(o.items || [], {
                            date: o.order_date,
                            category: o.category,
                            performedBy: o.performed_by,
                          })
                        }
                      >
                        <FileDown className="h-4 w-4 mr-1" /> Exporter PDF
                      </Button>
                    </div>
                    <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-0.5 max-h-40 overflow-auto">
                      {(o.items || []).map((it, i) => (
                        <div key={i} className="flex justify-between border-b last:border-0 py-0.5">
                          <span>{it.name}</span>
                          <span className="font-mono font-semibold">{it.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={pickOrderOpen} onOpenChange={setPickOrderOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Livraison en cours</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {savedOrders.length === 0 && (
                  <p className="text-center text-muted-foreground py-6 text-sm">Aucune commande enregistrée</p>
                )}
                {savedOrders.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => applyOrderAsLivraison(o)}
                    className="w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-semibold text-sm">
                      {o.order_date} — <span className="capitalize">{o.category}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Par {o.performed_by || "—"} · {o.total_items} unité(s) · {(o.items || []).length} article(s)
                    </div>
                    <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-0.5 max-h-32 overflow-auto">
                      {(o.items || []).map((it, i) => (
                        <div key={i} className="flex justify-between border-b last:border-0 py-0.5">
                          <span className="truncate">{it.name}</span>
                          <span className="font-mono font-semibold">{it.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}