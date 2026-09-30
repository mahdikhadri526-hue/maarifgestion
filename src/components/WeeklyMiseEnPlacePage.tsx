// Page dédiée à la saisie hebdomadaire de la mise en place.
// Indépendante du tableau « Stock restant » : elle ne modifie aucun filtre
// ni aucune donnée de ce tableau ; seules les saisies de mise en place
// (table mise_en_place_weekly) sont enregistrées ici.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db";
import { cached } from "@/lib/requestCache";
import { fetchAllRows } from "@/lib/supabasePaginate";
import { useStockLevels } from "@/hooks/useStockData";
import {
  getMovements, getInitialStocks, roundStockQuantity,
  getGlaceAggregateForRange, getToppingsDailyHistory,
} from "@/lib/stockData";
import {
  MACARON_ARTICLES, MACARON_AGG_ID, SIROP_AGG_ID, CHANTILLY_AGG_ID, AMANDES_AGG_ID,
  NESPRESSO_AGG_ID_CONST, NUTELLA_NESTLE_AGG_ID, THE_AROMATISE_AGG_ID,
  SIROP_CHOCOLAT_ALI_ID, NUTELLA_ALI_ID, NESTLE_CARAMEL_ALI_ID,
  SIROP_CARAMEL_WEEKLY_ARTICLE, CHANTILLY_WEEKLY_ARTICLE, AMANDES_WEEKLY_ARTICLE,
  DAYS, buildWeeklyAggregateTotals, formatISODate, trackingDate,
  type WeeklyTrackingOrderRecord,
} from "@/lib/stockWeeklyAggregates";
import { weekStartOf } from "@/lib/miseEnPlaceData";
import { getWeeklyMep, setWeeklyMep } from "@/lib/weeklyMiseEnPlaceData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarDays, Search } from "lucide-react";
import { toast } from "sonner";

const NESPRESSO_IDS = ["ali-29", "ali-30", "ali-31", "ali-32"];

function shiftWeek(week: string, deltaWeeks: number): string {
  const [y, m, d] = week.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaWeeks * 7);
  return weekStartOf(date);
}

function weekToDate(week: string): Date {
  const [y, m, d] = week.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function weekEndISO(week: string): string {
  const monday = weekToDate(week);
  return formatISODate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6));
}

function formatWeekLabel(week: string): string {
  const start = weekToDate(week);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const fmt = (dt: Date) =>
    `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
  return `Semaine du ${fmt(start)} au ${fmt(end)}`;
}

type MepRow = { id: string; name: string };

export function WeeklyMiseEnPlacePage() {
  const { data: levels, loading: levelsLoading } = useStockLevels();
  const [week, setWeek] = useState(() => weekStartOf(new Date()));
  const [values, setValues] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [mepLoading, setMepLoading] = useState(false);
  const [restants, setRestants] = useState<Record<string, number>>({});
  const [restantsLoading, setRestantsLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const weekEnd = weekEndISO(week);
  const isCurrentWeek = week === weekStartOf(new Date());

  // ===== Saisies de la semaine choisie (table dédiée mise_en_place_weekly) =====
  useEffect(() => {
    let cancelled = false;
    setMepLoading(true);
    getWeeklyMep(week)
      .then((r) => {
        if (cancelled) return;
        setValues(r.values);
        setSaved(r.saved);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e?.message || "Chargement impossible");
      })
      .finally(() => {
        if (!cancelled) setMepLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [week]);

  const save = async (productId: string, value: number) => {
    const prev = values[productId];
    setValues((p) => ({ ...p, [productId]: value }));
    try {
      await setWeeklyMep(productId, value, week);
      setSaved((p) => ({ ...p, [productId]: true }));
    } catch (e: any) {
      setValues((p) => ({ ...p, [productId]: prev ?? 0 }));
      toast.error(e?.message || "Enregistrement impossible");
    }
  };

  // ===== Stock restant à la fin de la semaine choisie =====
  // Reproduit exactement les valeurs du tableau Stock restant : pour la
  // semaine en cours, les valeurs sont identiques au mode « Tout » ; pour une
  // semaine passée, le cumul s'arrête à la fin de cette semaine.
  useEffect(() => {
    if (!levels || levelsLoading) return;
    let cancelled = false;
    setRestantsLoading(true);
    (async () => {
      try {
        const [allMovements, initialStocks] = await Promise.all([getMovements(), getInitialStocks()]);
        const productIds = new Set(levels.map((l) => l.productId));
        const byProduct: Record<string, Record<string, { e: number; s: number }>> = {};
        allMovements.forEach((m) => {
          if (!productIds.has(m.productId)) return;
          const d = m.date.slice(0, 10);
          if (d > weekEnd) return;
          const bd = (byProduct[m.productId] ||= {});
          const cell = (bd[d] ||= { e: 0, s: 0 });
          if (m.type === "entree") cell.e += m.quantity;
          else cell.s += m.quantity;
        });
        const restantById: Record<string, number> = {};
        levels.forEach((lvl) => {
          const initial = initialStocks[lvl.productId] || 0;
          const byDate = byProduct[lvl.productId] || {};
          let cumul = initial;
          for (const date of Object.keys(byDate).sort()) {
            cumul += byDate[date].e - byDate[date].s;
          }
          restantById[lvl.productId] = roundStockQuantity(cumul);
        });

        // Produit calculé « Glace » : stock restant à la fin de la semaine.
        const glaceLevel = levels.find((lvl) => lvl.productName === "GLACE" && lvl.category === "alimentaire");
        if (glaceLevel) {
          const glaceAgg = await getGlaceAggregateForRange(undefined, weekEnd);
          restantById[glaceLevel.productId] = roundStockQuantity(glaceAgg.stockRestant);
        }
        // Produit calculé « TOPPINGS » : dernier stock connu à la fin de la semaine.
        const toppingsLevel = levels.find((lvl) => lvl.productName === "TOPPINGS" && lvl.category === "alimentaire");
        if (toppingsLevel) {
          const rows = await getToppingsDailyHistory();
          let restant: number | null = null;
          for (const row of rows) {
            if (row.date.slice(0, 10) <= weekEnd) restant = row.stockRestant;
            else break;
          }
          restantById[toppingsLevel.productId] = roundStockQuantity(restant ?? rows[0]?.stockInitial ?? 0);
        }

        // Agrégats hebdo (Suivi Hebdo) : Macaron, Sirop, Chantilly, Amandes.
        const extraArticles = [SIROP_CARAMEL_WEEKLY_ARTICLE, CHANTILLY_WEEKLY_ARTICLE, AMANDES_WEEKLY_ARTICLE];
        const data = await cached(
          `mep_weekly_aggs_all`,
          ["weekly_tracking"],
          () =>
            fetchAllRows<WeeklyTrackingOrderRecord>(() => {
              const q = supabase
                .from("weekly_tracking")
                .select("article, sorties, entrees, stock_initial, day_of_week, week_start")
                .eq("fiche_type", "Mouvement glaces & tartes")
                .in("article", [...MACARON_ARTICLES, ...extraArticles] as unknown as string[]);
              return q;
            }),
        );
        const bounded = (data || []).filter((r) => {
          const dayIdx = DAYS.indexOf(r.day_of_week as (typeof DAYS)[number]);
          if (dayIdx < 0 || !r.week_start) return false;
          return trackingDate(r.week_start, dayIdx) <= weekEnd;
        });
        const stockAtWeekEnd = (articles: readonly string[]) =>
          buildWeeklyAggregateTotals(bounded, articles, () => true, true).stockRestant;
        restantById[MACARON_AGG_ID] = stockAtWeekEnd(MACARON_ARTICLES);
        restantById[SIROP_AGG_ID] = roundStockQuantity(
          (restantById[SIROP_CHOCOLAT_ALI_ID] ?? 0) + stockAtWeekEnd([SIROP_CARAMEL_WEEKLY_ARTICLE]),
        );
        restantById[CHANTILLY_AGG_ID] = stockAtWeekEnd([CHANTILLY_WEEKLY_ARTICLE]);
        restantById[AMANDES_AGG_ID] = stockAtWeekEnd([AMANDES_WEEKLY_ARTICLE]);

        if (!cancelled) setRestants(restantById);
      } catch (e) {
        if (!cancelled) toast.error("Erreur de chargement du stock");
      } finally {
        if (!cancelled) setRestantsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [levels, levelsLoading, weekEnd]);

  // ===== Lignes (produits de base + agrégats, même ordre que Stock restant) =====
  const rows = useMemo<MepRow[]>(() => {
    if (!levels) return [];
    const restantOf = (id: string, fallback = 0) => (restants[id] ?? fallback);
    const list: MepRow[] = levels
      .filter((l) => l.productName)
      .map((l) => ({ id: l.productId, name: l.productName }));

    const nespressoSources = levels.filter((l) => NESPRESSO_IDS.includes(l.productId));
    if (nespressoSources.length > 0) {
      list.push({
        id: NESPRESSO_AGG_ID_CONST,
        name: "NESPRESSO (Total)",
      });
    }
    const nutellaSources = levels.filter((l) => l.productId === NUTELLA_ALI_ID || l.productId === NESTLE_CARAMEL_ALI_ID);
    if (nutellaSources.length > 0) list.push({ id: NUTELLA_NESTLE_AGG_ID, name: "Nutella/Nestlé caramel" });
    if (levels.some((l) => /tchaba/i.test(l.productName))) list.push({ id: THE_AROMATISE_AGG_ID, name: "Thé aromatisé (Tchaba)" });
    list.push({ id: MACARON_AGG_ID, name: "MACARON (tous parfums)" });
    list.push({ id: SIROP_AGG_ID, name: "Sirop caramel/chocolat" });
    list.push({ id: CHANTILLY_AGG_ID, name: "Crème chantilly" });
    list.push({ id: AMANDES_AGG_ID, name: "Amandes caramélisées" });

    const query = search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    return query ? list.filter((l) => l.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().includes(query)) : list;
  }, [levels, restants, search]);

  const getRestant = (id: string) => restants[id] ?? 0;
  const monday = weekToDate(week);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const isLastWeekOfMonth = sunday.getMonth() !== monday.getMonth();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Mise en place hebdomadaire</h2>
          <p className="text-xs text-muted-foreground">
            La mise en place est saisie par semaine ; le stock restant est affiché sans être modifié.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setWeek((w) => shiftWeek(w, -1))} aria-label="Semaine précédente">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 justify-center gap-2 font-semibold">
                  <CalendarDays className="h-4 w-4" />
                  {formatWeekLabel(week)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  weekStartsOn={1}
                  showWeekNumber
                  selected={weekToDate(week)}
                  defaultMonth={weekToDate(week)}
                  modifiers={{
                    selectedWeek: {
                      from: weekToDate(week),
                      to: new Date(weekToDate(week).getFullYear(), weekToDate(week).getMonth(), weekToDate(week).getDate() + 6),
                    },
                  }}
                  modifiersClassNames={{ selectedWeek: "bg-primary/15 rounded-none" }}
                  onSelect={(d) => {
                    if (d) {
                      setWeek(weekStartOf(d));
                      setPickerOpen(false);
                    }
                  }}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Button size="sm" variant="outline" onClick={() => setWeek((w) => shiftWeek(w, 1))} aria-label="Semaine suivante">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentWeek && (
              <Button size="sm" variant="ghost" onClick={() => setWeek(weekStartOf(new Date()))}>
                Cette semaine
              </Button>
            )}
          </div>
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {isLastWeekOfMonth
            ? "Dernière semaine du mois : saisie à faire le lendemain de la fin du mois."
            : "Saisie à faire le lundi de chaque semaine."}
        </p>
      </div>

      {levelsLoading || restantsLoading || mepLoading ? (
        <p className="text-center text-muted-foreground py-6">Chargement...</p>
      ) : (
        <div className="rounded-lg border overflow-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock restant</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock mise en place</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saisie</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const restant = getRestant(p.id);
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-sm font-medium">{p.name}</td>
                    <td className="p-3 text-right font-mono">{restant}</td>
                    <td className="p-3 text-right">
                      <WeeklyMepInput value={values[p.id] ?? 0} onSave={(v) => save(p.id, v)} />
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-primary">
                      {roundStockQuantity(restant + (values[p.id] ?? 0))}
                    </td>
                    <td className="p-3 text-right">
                      {saved[p.id] ? (
                        <Badge variant="secondary">Cette semaine</Badge>
                      ) : values[p.id] !== undefined ? (
                        <Badge variant="outline">Reprise</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="text-center text-muted-foreground py-6">Aucun produit</p>
          )}
        </div>
      )}
    </div>
  );
}

function WeeklyMepInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value ?? 0));
  useEffect(() => {
    setDraft(String(value ?? 0));
  }, [value]);
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft) || 0;
        if (n !== value) onSave(n);
      }}
      className="h-8 w-24 text-right font-mono text-sm ml-auto"
    />
  );
}

export default WeeklyMiseEnPlacePage;
