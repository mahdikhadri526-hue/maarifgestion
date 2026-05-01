import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save, Check, X, Plus, Trash2 } from "lucide-react";
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
    <div className="flex gap-1 justify-center">
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
      <button
        type="button"
        onClick={() => onChange(value === "NC" ? "" : "NC")}
        className={cn(
          "h-8 w-8 rounded border flex items-center justify-center transition-colors",
          value === "NC"
            ? "bg-destructive text-destructive-foreground border-destructive"
            : "bg-background hover:bg-muted",
        )}
        aria-label="Non conforme"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function WeeklyTracking() {
  const [weekStart, setWeekStart] = useState<string>(fmt(getMonday(new Date())));
  const [tab, setTab] = useState<"creme" | "mouvement">("creme");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

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

  const getCell = (key: string, fallback: any = "") => {
    const found = rows.find((r) => r._key === key);
    return found?.data ?? fallback;
  };

  // Build a map for quick access: key = day|rowIndex|article
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

  // For mouvement tab: get all entry rows for an article on a given day (row_index 0..n)
  const entriesFor = (day: string, article: string) => {
    const list: { rowIndex: number; entree: any; lot: any }[] = [];
    for (const r of rows) {
      if (r.day_of_week === day && r.article === article && (r.entrees != null || r.lot_number)) {
        list.push({ rowIndex: r.row_index ?? 0, entree: r.entrees, lot: r.lot_number });
      }
    }
    return list.sort((a, b) => a.rowIndex - b.rowIndex);
  };

  // Number helpers
  const num = (v: any) => {
    if (v === "" || v == null) return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  // Compute SI for a given day for an article (J>0 => SI(J-1)+sum(E(J-1))-S(J-1) auto; J=0 => saisi manuellement)
  const getSI = (dayIdx: number, article: string): number | "" => {
    if (dayIdx === 0) {
      const v = cell(DAYS[0], 0, article).stock_initial;
      return v === "" || v == null ? "" : Number(v);
    }
    const prevDay = DAYS[dayIdx - 1];
    const prevSI = getSI(dayIdx - 1, article);
    if (prevSI === "") return "";
    const prevE = entriesFor(prevDay, article).reduce((s, e) => s + num(e.entree), 0);
    const prevS = num(cell(prevDay, 0, article).sorties);
    return Number(prevSI) + prevE - prevS;
  };

  // Compute Sortie for a day = SI(J) + sum(E(J)) - SI(J+1) (only if SI(J+1) is set)
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

  // FIFO lot computation: returns lot string for sortie of dayIdx for article
  const getSortieLotFIFO = (dayIdx: number, article: string): string => {
    // Build list of entry batches in order (day asc, rowIndex asc) with remaining qty
    type Batch = { lot: string; remaining: number };
    const batches: Batch[] = [];
    for (let d = 0; d <= dayIdx; d++) {
      const day = DAYS[d];
      // Initial stock of Monday counts as a starting batch with no lot
      if (d === 0) {
        const si = num(cell(day, 0, article).stock_initial);
        if (si > 0) batches.push({ lot: "", remaining: si });
      }
      for (const e of entriesFor(day, article)) {
        const q = num(e.entree);
        if (q > 0) batches.push({ lot: (e.lot ?? "").toString(), remaining: q });
      }
      // Consume sorties of days strictly before dayIdx
      if (d < dayIdx) {
        let sortie = num(cell(day, 0, article).sorties);
        // if sortie not set, try computed
        if (!sortie) {
          const computed = getSortie(d, article);
          if (typeof computed === "number") sortie = computed;
        }
        let need = sortie;
        for (const b of batches) {
          if (need <= 0) break;
          const take = Math.min(b.remaining, need);
          b.remaining -= take;
          need -= take;
        }
      }
    }
    // Now consume sortie of dayIdx and collect lots used
    let sortie = num(cell(DAYS[dayIdx], 0, article).sorties);
    if (!sortie) {
      const computed = getSortie(dayIdx, article);
      if (typeof computed === "number") sortie = computed;
    }
    if (!sortie) return "";
    const used: string[] = [];
    let need = sortie;
    for (const b of batches) {
      if (need <= 0) break;
      if (b.remaining <= 0) continue;
      const take = Math.min(b.remaining, need);
      if (b.lot) {
        if (!used.includes(b.lot)) used.push(b.lot);
      }
      b.remaining -= take;
      need -= take;
    }
    return used.join(" / ");
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

  // Keyboard: Enter on SI Lundi -> next article's SI Lundi
  const focusNextSI = (currentArticleIdx: number) => {
    const next = currentArticleIdx + 1;
    if (next < ARTICLES.length) {
      const el = document.querySelector<HTMLInputElement>(
        `input[data-si="${next}"]`,
      );
      el?.focus();
      el?.select();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Filter rows that have at least one meaningful value
      const meaningful = rows.filter((r) => {
        const fields = ["lot_number", "couleur", "odeur", "texture", "visa_operateur", "visa_manager"];
        const nums = ["stock_initial", "entrees", "sorties"];
        return (
          fields.some((f) => (r[f] ?? "").toString().trim().length > 0) ||
          nums.some((f) => r[f] !== null && r[f] !== undefined && r[f] !== "")
        );
      });

      // Delete existing rows for this week+type then re-insert
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

        <TabsContent value="mouvement" className="mt-4">
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left sticky left-0 bg-muted z-10 border-r">Article</th>
                  {DAYS.map((day, dIdx) => (
                    <th key={day} colSpan={4} className="p-2 text-center border-l">
                      <div>{day}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        {dayShort(weekStart, dIdx)}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="p-1 sticky left-0 bg-muted z-10 border-r"></th>
                  {DAYS.map((day) => (
                    <Fragment key={day}>
                      <th className="p-1 border-l text-center font-normal">SI</th>
                      <th className="p-1 text-center font-normal">E</th>
                      <th className="p-1 text-center font-normal">S</th>
                      <th className="p-1 text-center font-normal">N° lot</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ARTICLES.map((article, aIdx) => (
                  <tr key={article} className="border-t">
                    <td className="p-2 font-medium sticky left-0 bg-card border-r whitespace-nowrap">
                      {article}
                    </td>
                    {DAYS.map((day, dIdx) => {
                      const c = cell(day, 0, article);
                      const entries = entriesFor(day, article);
                      // Always show at least the row 0 entry input
                      const entryRows = entries.length > 0 ? entries : [{ rowIndex: 0, entree: "", lot: "" }];
                      const siAuto = dIdx === 0 ? null : getSI(dIdx, article);
                      const sortieAuto = getSortie(dIdx, article);
                      const sortieLotFifo = getSortieLotFIFO(dIdx, article);
                      const totalE = entries.reduce((s, e) => s + num(e.entree), 0);
                      return (
                        <Fragment key={day}>
                          {/* SI */}
                          <td className="p-0.5 border-l align-top">
                            {dIdx === 0 ? (
                              <Input
                                type="number"
                                inputMode="numeric"
                                data-si={aIdx}
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
                            ) : (
                              <div className="h-7 w-14 text-xs px-1 flex items-center justify-center bg-muted/40 rounded text-muted-foreground">
                                {siAuto === "" || siAuto == null ? "—" : siAuto}
                              </div>
                            )}
                          </td>
                          {/* Entries (multi-row) */}
                          <td className="p-0.5 align-top">
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
                                  className="h-7 w-14 text-xs px-1"
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
                          {/* Sortie auto */}
                          <td className="p-0.5 align-top">
                            <div className="h-7 w-14 text-xs px-1 flex items-center justify-center bg-muted/40 rounded text-muted-foreground">
                              {sortieAuto === "" || sortieAuto == null ? "—" : sortieAuto}
                            </div>
                          </td>
                          {/* Lot column: editable per entry row, sortie shows FIFO lot read-only */}
                          <td className="p-0.5 align-top">
                            <div className="flex flex-col gap-0.5">
                              {entryRows.map((er, i) => (
                                <div key={`l-${er.rowIndex}-${i}`} className="flex items-center gap-0.5">
                                  <Input
                                    value={er.lot ?? ""}
                                    onChange={(ev) =>
                                      updateCell(day, er.rowIndex, article, { lot_number: ev.target.value })
                                    }
                                    placeholder="lot entrée"
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
                              {sortieLotFifo && (
                                <div className="text-[10px] text-primary text-center px-1 truncate" title={`Lot sortie (FIFO): ${sortieLotFifo}`}>
                                  ↳ {sortieLotFifo}
                                </div>
                              )}
                            </div>
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-muted-foreground mt-2 px-1">
            <strong>SI</strong> du Lundi à saisir, les jours suivants se calculent automatiquement (SI + Entrées − Sorties).
            <strong> Sorties</strong> calculées dès que le SI du lendemain est saisi.
            <strong> Lots</strong> à saisir uniquement sur les Entrées ; les sorties affichent les lots utilisés en FIFO.
            Cliquez sur <kbd>+</kbd> pour ajouter un 2ᵉ lot d'entrée. Touche <kbd>Entrée</kbd> sur le SI Lundi pour passer à l'article suivant.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}