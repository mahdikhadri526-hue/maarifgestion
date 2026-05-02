import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save, Check, Plus, Trash2, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

const ARTICLES = [
  "Tarte 6", "Tarte 8", "Tarte 10", "Tte Sp.", "Tte.Sp 8", "Tte Mac.", "Tte Sor.",
  "Tche Sor.", "Tche Mac.", "Tche Nap.", "Bûche", "Bûche Sp.", "N.F", "Demis",
  "M.L", "M B M", "M B F", "M.Loulou", "Chanty.Fruit confits", "Panachés",
  "Sicilienne vanille", "Sicilienne chocolat", "Sicilienne fraise", "Sicilienne mangue",
  "Nougat", "Praliné", "Vanille", "Chocolat", "Pistache", "Caramel", "Moka",
  "Parfait", "Fraise", "Framboise", "Orange", "Mangue", "Citron", "Pêche",
  "CREME FRAICHE",
];

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("fr-FR");
}

function dayShort(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

type Row = Record<string, any>;

function ConformityToggle({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={() => onChange(value === "C" ? "" : "C")}
        className={cn(
          "h-8 w-8 rounded border flex items-center justify-center transition-colors",
          value === "C"
            ? "bg-success text-success-foreground border-success"
            : "bg-background hover:bg-muted",
        )}
        aria-label="Conforme"
      >
        <Check className="h-4 w-4" />
      </button>
    </div>
  );
}

type FilterType = "all" | "si" | "entree" | "sortie" | "sans_lot";

export function WeeklyTracking() {
  const [weekStart, setWeekStart] = useState<string>(fmt(getMonday(new Date())));
  const [tab, setTab] = useState<"creme" | "mouvement">("creme");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  // Filters for Mouvement tab
  const [filterArticle, setFilterArticle] = useState<string>("all");
  const [filterDay, setFilterDay] = useState<string>("all"); // index 0..6 or "all"
  const [filterType, setFilterType] = useState<FilterType>("all");

  const ficheType = tab === "creme" ? "Crème fraîche" : "Mouvement glaces & tartes";

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("weekly_tracking")
        .select("*")
        .eq("week_start", weekStart)
        .eq("fiche_type", ficheType);
      if (error) {
        toast.error("Erreur de chargement");
        return;
      }
      setRows(data || []);
    })();
  }, [weekStart, ficheType]);

  const cellMap = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of rows) {
      const key = `${r.day_of_week}|${r.row_index}|${r.article ?? ""}`;
      m.set(key, r);
    }
    return m;
  }, [rows]);

  const updateCell = (
    day: string,
    rowIndex: number,
    article: string | null,
    patch: Partial<Row>,
  ) => {
    const key = `${day}|${rowIndex}|${article ?? ""}`;
    setRows((prev) => {
      const idx = prev.findIndex((r) => `${r.day_of_week}|${r.row_index}|${r.article ?? ""}` === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
      return [
        ...prev,
        {
          fiche_type: ficheType,
          week_start: weekStart,
          day_of_week: day,
          row_index: rowIndex,
          article,
          ...patch,
        },
      ];
    });
  };

  const cell = (day: string, rowIndex: number, article: string | null) =>
    cellMap.get(`${day}|${rowIndex}|${article ?? ""}`) ?? {};

  const entriesFor = (day: string, article: string) => {
    const list: { rowIndex: number; entree: any; lot: any }[] = [];
    for (const r of rows) {
      if (r.day_of_week === day && r.article === article && (r.entrees != null || r.lot_number)) {
        list.push({ rowIndex: r.row_index ?? 0, entree: r.entrees, lot: r.lot_number });
      }
    }
    return list.sort((a, b) => a.rowIndex - b.rowIndex);
  };

  const num = (v: any) => {
    if (v === "" || v == null) return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  const getSI = (dayIdx: number, article: string): number | "" => {
    const v = cell(DAYS[dayIdx], 0, article).stock_initial;
    return v === "" || v == null ? "" : Number(v);
  };

  const getSortie = (dayIdx: number, article: string): number | "" => {
    if (dayIdx >= DAYS.length - 1) {
      const v = cell(DAYS[dayIdx], 0, article).sorties;
      return v === "" || v == null ? "" : Number(v);
    }
    const siNext = getSI(dayIdx + 1, article);
    const siCur = getSI(dayIdx, article);
    if (siNext === "" || siCur === "") return "";
    const eCur = entriesFor(DAYS[dayIdx], article).reduce((s, e) => s + num(e.entree), 0);
    return Number(siCur) + eCur - Number(siNext);
  };

  // Returns the running per-lot remaining stock at END of dayIdx, in FIFO order.
  // Lot "" = stock initial sans lot (du lundi).
  const getLotBalancesEndOfDay = (dayIdx: number, article: string): { lot: string; remaining: number }[] => {
    type Batch = { lot: string; remaining: number };
    const batches: Batch[] = [];
    for (let d = 0; d <= dayIdx; d++) {
      const day = DAYS[d];
      if (d === 0) {
        const si = num(cell(day, 0, article).stock_initial);
        if (si > 0) batches.push({ lot: "", remaining: si });
      }
      for (const e of entriesFor(day, article)) {
        const q = num(e.entree);
        if (q > 0) batches.push({ lot: (e.lot ?? "").toString(), remaining: q });
      }
      let sortie = num(cell(day, 0, article).sorties);
      if (!sortie) {
        const computed = getSortie(d, article);
        if (typeof computed === "number") sortie = computed;
      }
      let need = sortie;
      for (const b of batches) {
        if (need <= 0) break;
        if (b.remaining <= 0) continue;
        const take = Math.min(b.remaining, need);
        b.remaining -= take;
        need -= take;
      }
    }
    return batches;
  };

  // Stock existant par lot APRES sortie du jour (pour affichage dans la colonne "Lot existant")
  const getLotsExistantString = (dayIdx: number, article: string): string => {
    const batches = getLotBalancesEndOfDay(dayIdx, article);
    const merged = new Map<string, number>();
    for (const b of batches) {
      if (b.remaining <= 0) continue;
      const label = b.lot && b.lot.trim() ? b.lot : "(sans lot)";
      merged.set(label, (merged.get(label) ?? 0) + b.remaining);
    }
    const parts: string[] = [];
    for (const [lot, qty] of merged.entries()) parts.push(`${lot} ×${qty}`);
    return parts.join(" / ");
  };

  const addEntryRow = (day: string, article: string) => {
    const existing = entriesFor(day, article);
    const nextIdx = existing.length > 0 ? Math.max(...existing.map((e) => e.rowIndex)) + 1 : 1;
    updateCell(day, nextIdx, article, { entrees: "", lot_number: "" });
  };

  const removeEntryRow = (day: string, rowIndex: number, article: string) => {
    const key = `${day}|${rowIndex}|${article}`;
    setRows((prev) => prev.filter((r) => `${r.day_of_week}|${r.row_index}|${r.article ?? ""}` !== key));
  };

  const focusNextSI = (currentArticleIdx: number) => {
    // Find next visible article
    for (let next = currentArticleIdx + 1; next < ARTICLES.length; next++) {
      const el = document.querySelector<HTMLInputElement>(`input[data-si="0-${next}"]`);
      if (el) {
        el.focus();
        el.select();
        return;
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const meaningful = rows.filter((r) => {
        const fields = ["lot_number", "couleur", "odeur", "texture", "visa_operateur", "visa_manager"];
        const nums = ["stock_initial", "entrees", "sorties", "quantity"];
        return (
          fields.some((f) => (r[f] ?? "").toString().trim().length > 0) ||
          nums.some((f) => r[f] !== null && r[f] !== undefined && r[f] !== "")
        );
      });

      const { error: delErr } = await supabase
        .from("weekly_tracking")
        .delete()
        .eq("week_start", weekStart)
        .eq("fiche_type", ficheType);
      if (delErr) throw delErr;

      if (meaningful.length > 0) {
        const payload = meaningful.map((r) => ({
          fiche_type: ficheType,
          week_start: weekStart,
          day_of_week: r.day_of_week,
          row_index: r.row_index ?? 0,
          article: r.article ?? null,
          lot_number: r.lot_number ?? null,
          couleur: r.couleur ?? null,
          odeur: r.odeur ?? null,
          texture: r.texture ?? null,
          stock_initial: r.stock_initial === "" || r.stock_initial == null ? null : Number(r.stock_initial),
          entrees: r.entrees === "" || r.entrees == null ? null : Number(r.entrees),
          sorties: r.sorties === "" || r.sorties == null ? null : Number(r.sorties),
          quantity: r.quantity === "" || r.quantity == null ? null : Number(r.quantity),
          visa_operateur: r.visa_operateur ?? null,
          visa_manager: r.visa_manager ?? null,
        }));
        const { error } = await supabase.from("weekly_tracking").insert(payload);
        if (error) throw error;
      }
      toast.success("Suivi hebdomadaire enregistré");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const shiftWeek = (n: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + n * 7);
    setWeekStart(fmt(d));
  };

  // Filtered articles list (article filter)
  const visibleArticles = useMemo(() => {
    if (filterArticle === "all") return ARTICLES.map((a, i) => ({ article: a, aIdx: i }));
    return ARTICLES.map((a, i) => ({ article: a, aIdx: i })).filter((x) => x.article === filterArticle);
  }, [filterArticle]);

  // Filtered days
  const visibleDays = useMemo(() => {
    if (filterDay === "all") return DAYS.map((d, i) => ({ day: d, dIdx: i }));
    const idx = Number(filterDay);
    return [{ day: DAYS[idx], dIdx: idx }];
  }, [filterDay]);

  // For "type" filter: determine if a (day,article) cell matches
  const cellMatchesTypeFilter = (dIdx: number, article: string): boolean => {
    if (filterType === "all") return true;
    const c = cell(DAYS[dIdx], 0, article);
    const entries = entriesFor(DAYS[dIdx], article);
    const sortie = getSortie(dIdx, article);

    if (filterType === "si") return c.stock_initial != null && c.stock_initial !== "";
    if (filterType === "entree") return entries.some((e) => num(e.entree) > 0);
    if (filterType === "sortie") return typeof sortie === "number" && sortie !== 0;
    if (filterType === "sans_lot") {
      // Show only if there is an entry without a lot, or sortie with no lot info
      const entreeSansLot = entries.some((e) => num(e.entree) > 0 && !(e.lot ?? "").toString().trim());
      const sortieAvecStockSansLot = (() => {
        if (typeof sortie !== "number" || sortie === 0) return false;
        // a sortie is "sans lot" if FIFO consumes from the "" (stock initial) batch
        // Recompute consumption tracking the lots used today
        const balancesBefore = dIdx === 0 ? [] : getLotBalancesEndOfDay(dIdx - 1, article);
        const todayBatches = [...balancesBefore.map((b) => ({ ...b }))];
        if (dIdx === 0) {
          const si = num(c.stock_initial);
          if (si > 0) todayBatches.push({ lot: "", remaining: si });
        }
        for (const e of entries) {
          const q = num(e.entree);
          if (q > 0) todayBatches.push({ lot: (e.lot ?? "").toString(), remaining: q });
        }
        let need = sortie;
        for (const b of todayBatches) {
          if (need <= 0) break;
          if (b.remaining <= 0) continue;
          const take = Math.min(b.remaining, need);
          if (!b.lot) return true;
          b.remaining -= take;
          need -= take;
        }
        return false;
      })();
      return entreeSansLot || sortieAvecStockSansLot;
    }
    return true;
  };

  // For Mouvement: filter rows (articles) — only keep articles having at least one matching cell across visible days
  const filteredArticles = useMemo(() => {
    if (filterType === "all") return visibleArticles;
    return visibleArticles.filter((row) =>
      visibleDays.some((d) => cellMatchesTypeFilter(d.dIdx, row.article)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleArticles, visibleDays, filterType, rows]);

  const resetFilters = () => {
    setFilterArticle("all");
    setFilterDay("all");
    setFilterType("all");
  };

  const filtersActive = filterArticle !== "all" || filterDay !== "all" || filterType !== "all";

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border p-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-medium">
          Semaine du {new Date(weekStart).toLocaleDateString("fr-FR")} au {addDays(weekStart, 6)}
        </div>
        <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="creme">Crème fraîche</TabsTrigger>
          <TabsTrigger value="mouvement">Mouvement glaces & tartes</TabsTrigger>
        </TabsList>

        <TabsContent value="creme" className="mt-4">
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Jour</th>
                  <th className="p-2 text-left">Quantité</th>
                  <th className="p-2 text-left">N° lot crème fraîche</th>
                  <th className="p-2 text-left">Couleur</th>
                  <th className="p-2 text-left">Odeur</th>
                  <th className="p-2 text-left">Texture</th>
                  <th className="p-2 text-left">Visa opérateur</th>
                  <th className="p-2 text-left">Visa manager</th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) =>
                  [0, 1].map((rowIdx) => {
                    const c = cell(day, rowIdx, null);
                    const isFirst = rowIdx === 0;
                    return (
                      <tr key={`${day}-${rowIdx}`} className="border-t">
                        {isFirst && (
                          <td rowSpan={2} className="p-2 font-medium border-r align-middle">
                            {day}
                          </td>
                        )}
                        <td className="p-1">
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={c.quantity ?? ""}
                            onChange={(e) => updateCell(day, rowIdx, null, { quantity: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            value={c.lot_number ?? ""}
                            onChange={(e) => updateCell(day, rowIdx, null, { lot_number: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="p-1">
                          <ConformityToggle
                            value={c.couleur}
                            onChange={(v) => updateCell(day, rowIdx, null, { couleur: v })}
                          />
                        </td>
                        <td className="p-1">
                          <ConformityToggle
                            value={c.odeur}
                            onChange={(v) => updateCell(day, rowIdx, null, { odeur: v })}
                          />
                        </td>
                        <td className="p-1">
                          <ConformityToggle
                            value={c.texture}
                            onChange={(v) => updateCell(day, rowIdx, null, { texture: v })}
                          />
                        </td>
                        {isFirst && (
                          <>
                            <td rowSpan={2} className="p-1 align-middle">
                              <Input
                                value={cell(day, 0, null).visa_operateur ?? ""}
                                onChange={(e) => updateCell(day, 0, null, { visa_operateur: e.target.value })}
                                className="h-8"
                              />
                            </td>
                            <td rowSpan={2} className="p-1 align-middle">
                              <Input
                                value={cell(day, 0, null).visa_manager ?? ""}
                                onChange={(e) => updateCell(day, 0, null, { visa_manager: e.target.value })}
                                className="h-8"
                              />
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="mouvement" className="mt-4 space-y-3">
          {/* FILTERS BAR */}
          <div className="bg-card rounded-lg border p-3 flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" /> Filtres
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Produit</Label>
              <Select value={filterArticle} onValueChange={setFilterArticle}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les produits</SelectItem>
                  {ARTICLES.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Jour</Label>
              <Select value={filterDay} onValueChange={setFilterDay}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toute la semaine</SelectItem>
                  {DAYS.map((d, i) => (
                    <SelectItem key={d} value={String(i)}>
                      {d} ({dayShort(weekStart, i)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Période (mois)</Label>
              <Input
                type="month"
                className="h-8 w-40 text-xs"
                value={weekStart.slice(0, 7)}
                onChange={(e) => {
                  const v = e.target.value; // YYYY-MM
                  if (!v) return;
                  const [y, m] = v.split("-").map(Number);
                  const first = new Date(y, m - 1, 1);
                  setWeekStart(fmt(getMonday(first)));
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Type</Label>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout afficher</SelectItem>
                  <SelectItem value="si">Stock Initial</SelectItem>
                  <SelectItem value="entree">Entrées</SelectItem>
                  <SelectItem value="sortie">Sorties</SelectItem>
                  <SelectItem value="sans_lot">Sans lot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8">
                <X className="h-3 w-3 mr-1" /> Réinitialiser
              </Button>
            )}
          </div>

          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left sticky left-0 bg-muted z-10 border-r">Article</th>
                  {visibleDays.map(({ day, dIdx }) => (
                    <th key={day} colSpan={5} className="p-2 text-center border-l">
                      <div>{day}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        {dayShort(weekStart, dIdx)}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="p-1 sticky left-0 bg-muted z-10 border-r"></th>
                  {visibleDays.map(({ day }) => (
                    <Fragment key={day}>
                      <th className="p-1 border-l text-center font-normal">SI</th>
                      <th className="p-1 text-center font-normal text-success">E</th>
                      <th className="p-1 text-center font-normal">N° lot</th>
                      <th className="p-1 text-center font-normal text-destructive">S</th>
                      <th className="p-1 text-center font-normal">Lot existant</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredArticles.map(({ article, aIdx }) => (
                  <tr key={article} className="border-t">
                    <td className="p-2 font-medium sticky left-0 bg-card border-r whitespace-nowrap">
                      {article}
                    </td>
                    {visibleDays.map(({ day, dIdx }) => {
                      const c = cell(day, 0, article);
                      const entries = entriesFor(day, article);
                      const entryRows = entries.length > 0 ? entries : [{ rowIndex: 0, entree: "", lot: "" }];
                      const sortieAuto = getSortie(dIdx, article);
                      const lotsExistant = getLotsExistantString(dIdx, article);
                      const totalE = entries.reduce((s, e) => s + num(e.entree), 0);
                      const matchType = cellMatchesTypeFilter(dIdx, article);
                      const dim = filterType !== "all" && !matchType;
                      return (
                        <Fragment key={day}>
                          {/* SI */}
                          <td className={cn("p-0.5 border-l align-top", dim && "opacity-30")}>
                            <Input
                              type="number"
                              inputMode="numeric"
                              data-si={`${dIdx}-${aIdx}`}
                              value={c.stock_initial ?? ""}
                              onChange={(e) =>
                                updateCell(day, 0, article, { stock_initial: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  focusNextSI(aIdx);
                                }
                              }}
                              className="h-7 w-14 text-xs px-1"
                            />
                          </td>
                          {/* Entries (multi-row) — VERT */}
                          <td className={cn("p-0.5 align-top", dim && "opacity-30")}>
                            <div className="flex flex-col gap-0.5">
                              {entryRows.map((er, i) => (
                                <Input
                                  key={`e-${er.rowIndex}-${i}`}
                                  type="number"
                                  inputMode="numeric"
                                  value={er.entree ?? ""}
                                  onChange={(ev) =>
                                    updateCell(day, er.rowIndex, article, { entrees: ev.target.value })
                                  }
                                  className="h-7 w-14 text-xs px-1 bg-success/10 text-success border-success/40 font-medium"
                                />
                              ))}
                              <button
                                type="button"
                                onClick={() => addEntryRow(day, article)}
                                className="h-5 w-14 rounded border border-dashed text-[10px] text-muted-foreground hover:bg-muted flex items-center justify-center gap-1"
                                title="Ajouter une 2e entrée (lot différent)"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              {entries.length > 1 && totalE > 0 && (
                                <div className="text-[9px] text-muted-foreground text-center">Σ {totalE}</div>
                              )}
                            </div>
                          </td>
                          {/* N° lot d'entrée (juste après E) */}
                          <td className={cn("p-0.5 align-top", dim && "opacity-30")}>
                            <div className="flex flex-col gap-0.5">
                              {entryRows.map((er, i) => (
                                <div key={`l-${er.rowIndex}-${i}`} className="flex items-center gap-0.5">
                                  <Input
                                    value={er.lot ?? ""}
                                    onChange={(ev) =>
                                      updateCell(day, er.rowIndex, article, { lot_number: ev.target.value })
                                    }
                                    placeholder="lot"
                                    className="h-7 w-20 text-xs px-1"
                                  />
                                  {er.rowIndex > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => removeEntryRow(day, er.rowIndex, article)}
                                      className="text-destructive hover:bg-destructive/10 rounded p-0.5"
                                      title="Supprimer cette entrée"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                          {/* Sortie auto — ROUGE */}
                          <td className={cn("p-0.5 align-top", dim && "opacity-30")}>
                            <div className="h-7 w-14 text-xs px-1 flex items-center justify-center bg-destructive/10 text-destructive border border-destructive/40 rounded font-medium">
                              {sortieAuto === "" || sortieAuto == null ? "—" : sortieAuto}
                            </div>
                          </td>
                          {/* Lot existant (FIFO restant par lot) */}
                          <td className={cn("p-0.5 align-top", dim && "opacity-30")}>
                            <div
                              className="min-h-7 w-32 text-[10px] px-1 py-1 bg-muted/40 rounded text-foreground/80 leading-tight whitespace-normal break-words"
                              title={lotsExistant || "Aucun stock"}
                            >
                              {lotsExistant || <span className="text-muted-foreground">—</span>}
                            </div>
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
                {filteredArticles.length === 0 && (
                  <tr>
                    <td colSpan={1 + visibleDays.length * 5} className="p-6 text-center text-muted-foreground">
                      Aucune ligne ne correspond aux filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-muted-foreground px-1">
            <span className="text-success font-medium">Entrées en vert</span> ·{" "}
            <span className="text-destructive font-medium">Sorties en rouge</span> · La colonne{" "}
            <strong>Lot existant</strong> affiche les stocks restants par lot en FIFO (ex: <code>L240501 ×5</code>).
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
