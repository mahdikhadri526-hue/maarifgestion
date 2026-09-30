import { useEffect, useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getWeeklyMiseEnPlace,
  setWeeklyMiseEnPlace,
  getWeeklyStockRestant,
  inventoryDayOfWeek,
  weekEndOf,
  WeeklyMepRow,
} from "@/lib/weeklyMiseEnPlaceData";
import { weekStartOf } from "@/lib/miseEnPlaceData";
import { parseISODate, formatISODate } from "@/lib/stockWeeklyAggregates";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from "lucide-react";

function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const d = parseISODate(weekStart);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return formatISODate(d);
}

function formatWeekLabel(weekStart: string): string {
  const start = parseISODate(weekStart);
  const end = parseISODate(weekEndOf(weekStart));
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `Semaine du ${fmt(start)} au ${fmt(end)}`;
}

export function WeeklyMiseEnPlacePage() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canEdit = can("edit_remaining_stock");

  const [weekStart, setWeekStart] = useState<string>(() => weekStartOf());
  const [rows, setRows] = useState<WeeklyMepRow[]>([]);
  const [mep, setMep] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getWeeklyStockRestant(weekStart), getWeeklyMiseEnPlace(weekStart)])
      .then(([r, m]) => {
        if (cancelled) return;
        setRows(r);
        setMep(m);
        setDrafts({});
      })
      .catch(() => {
        if (!cancelled) {
          toast({ title: "Erreur de chargement", variant: "destructive" });
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [weekStart, toast]);

  const inventoryDay = useMemo(() => inventoryDayOfWeek(weekStart), [weekStart]);
  const todayISO = formatISODate(new Date());
  const currentWeek = weekStartOf();
  const currentInventoryDay = inventoryDayOfWeek(currentWeek);
  const isInventoryToday = todayISO === currentInventoryDay;
  const inventoryPassed =
    todayISO > currentInventoryDay && weekStart !== currentWeek;

  const saveValue = async (productId: string) => {
    const raw = (drafts[productId] ?? "").replace(",", ".").trim();
    if (raw === "") return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      toast({ title: "Valeur invalide", variant: "destructive" });
      return;
    }
    try {
      await setWeeklyMiseEnPlace(productId, weekStart, value);
      setMep((prev) => ({ ...prev, [productId]: value }));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    } catch {
      toast({ title: "Échec de l'enregistrement", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Inventaire hebdomadaire</h2>
            <p className="text-xs text-muted-foreground">
              Comptage du stock de mise en place — chaque lundi, et le lendemain de la fin du mois pour la dernière semaine du mois.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(shiftWeek(weekStart, -1))} aria-label="Semaine précédente">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 text-sm font-medium">
                  <CalendarDays className="h-4 w-4" />
                  {formatWeekLabel(weekStart)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  weekStartsOn={1}
                  selected={parseISODate(weekStart)}
                  onSelect={(d) => {
                    if (d) {
                      setWeekStart(weekStartOf(d));
                      setCalendarOpen(false);
                    }
                  }}
                  modifiers={{
                    inventoryDay: (date) => inventoryDayOfWeek(weekStartOf(date)) === formatISODate(date),
                    selectedWeek: (date) => weekStartOf(date) === weekStart,
                  }}
                  modifiersClassNames={{
                    inventoryDay: "mep-inventory-day",
                    selectedWeek: "bg-primary/10 rounded-none",
                  }}
                />
                <p className="px-3 pb-3 text-xs text-muted-foreground">
                  Les jours entourés sont les jours d'inventaire.
                </p>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(shiftWeek(weekStart, 1))} aria-label="Semaine suivante">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {(isInventoryToday || inventoryPassed) && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-700 dark:text-amber-500">
                {isInventoryToday
                  ? "Aujourd'hui est le jour de l'inventaire hebdomadaire."
                  : "L'inventaire hebdomadaire de cette semaine est à faire."}
              </p>
              <p className="text-muted-foreground">
                Jour prévu : {parseISODate(currentInventoryDay).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}.
              </p>
              {weekStart !== currentWeek && (
                <button
                  className="mt-1 text-primary font-medium hover:underline"
                  onClick={() => setWeekStart(currentWeek)}
                >
                  Voir cette semaine
                </button>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Jour d'inventaire de la semaine affichée :{" "}
          <span className="font-medium text-foreground">
            {parseISODate(inventoryDay).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
          </span>
        </p>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold">Produit</th>
                <th className="text-right px-4 py-3 font-semibold">Stock restant</th>
                <th className="text-right px-4 py-3 font-semibold">Stock mise en place</th>
                <th className="text-right px-4 py-3 font-semibold">Stock total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Aucun produit.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const mepValue = mep[row.productId] ?? 0;
                  const draft = drafts[row.productId];
                  return (
                    <tr key={row.productId} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <div className="font-medium">{row.productName}</div>
                        {row.conditionnement && (
                          <div className="text-xs text-muted-foreground">{row.conditionnement}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.stockRestant}</td>
                      <td className="px-4 py-2 text-right">
                        {canEdit ? (
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            className="w-28 ml-auto text-right h-8"
                            value={draft ?? (mepValue === 0 ? "" : String(mepValue))}
                            placeholder="0"
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [row.productId]: e.target.value }))
                            }
                            onBlur={() => saveValue(row.productId)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                          />
                        ) : (
                          <span className="tabular-nums">{mepValue}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">
                        {Math.round((row.stockRestant + mepValue) * 1000) / 1000}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
