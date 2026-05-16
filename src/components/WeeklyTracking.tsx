import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save, Check, Plus, Trash2, Filter, X, CalendarIcon, Eye, EyeOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { PhotoScanEntry, type ScannedEntry } from "./PhotoScanEntry";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

const TARTE_ARTICLES = [
  "Tarte 6", "Tarte 8", "Tarte 10", "Tte Sp.", "Tte.Sp 8", "Tte Mac.", "Tte Sor.",
  "Tche Sor.", "Tche Mac.", "Tche Nap.", "Bûche", "Bûche Sp.", "N.F", "Demis",
  "M.L", "M B M", "M B F", "M.Loulou", "Chanty.Fruit confits", "Panachés",
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
const ARTICLES = [...TARTE_ARTICLES, ...GLACE_ARTICLES];

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(iso: string, n: number) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("fr-FR");
}

function dayShort(iso: string, n: number) {
  const d = parseISO(iso);
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
type FilterTypeExt = FilterType | "sans_lot_existant" | "masquer_lots";

function LotExistantCell({
  dayIdx,
  article,
  getBalances,
}: {
  dayIdx: number;
  article: string;
  getBalances: (d: number, a: string) => { lot: string; remaining: number }[];
}) {
  const batches = getBalances(dayIdx, article).filter((b) => b.remaining > 0);
  // Conserver l'ordre FIFO d'apparition, mais fusionner les lots identiques
  const merged: { lot: string; remaining: number }[] = [];
  for (const b of batches) {
    const label = b.lot && b.lot.trim() ? b.lot : "(sans lot)";
    const existing = merged.find((m) => m.lot === label);
    if (existing) existing.remaining += b.remaining;
    else merged.push({ lot: label, remaining: b.remaining });
  }
  return (
    <div className="min-h-7 w-44 text-[11px] px-1 py-1 bg-primary/5 border border-primary/20 rounded leading-tight space-y-0.5">
      {merged.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        merged.map((m, i) => (
          <div
            key={`${m.lot}-${i}`}
            className="flex items-center justify-between gap-1 px-1.5 py-0.5 rounded bg-background border border-primary/30 shadow-sm"
          >
            <span
              className={cn(
                "truncate font-medium",
                m.lot === "(sans lot)" ? "text-destructive" : "text-primary",
              )}
              title={m.lot}
            >
              {m.lot}
            </span>
            <span className="font-bold tabular-nums text-foreground">×{m.remaining}</span>
          </div>
        ))
      )}
    </div>
  );
}

export function WeeklyTracking() {
  const [weekStart, setWeekStart] = useState<string>(fmt(getMonday(new Date())));
  const [tab, setTab] = useState<"creme" | "glace" | "tarte">("creme");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  // Toutes les entrées "Crème fraîche (mousse fouettée)" du mouvement glaces,
  // chargées globalement pour afficher leurs lots dans la fiche Suivi crème fraîche.
  const [cremeGlaceRows, setCremeGlaceRows] = useState<Row[]>([]);

  // Filters for Mouvement tab
  const [filterArticle, setFilterArticle] = useState<string>("all");
  const [filterDay, setFilterDay] = useState<string>("all"); // index 0..6 or "all"
  const [filterType, setFilterType] = useState<FilterTypeExt>("all");
  const [filterFrom, setFilterFrom] = useState<string>(""); // YYYY-MM-DD
  const [filterTo, setFilterTo] = useState<string>(""); // YYYY-MM-DD
  const [showControls, setShowControls] = useState(true);

  const ficheType = tab === "creme" ? "Crème fraîche" : "Mouvement glaces & tartes";
  const activeArticles = tab === "glace" ? GLACE_ARTICLES : tab === "tarte" ? TARTE_ARTICLES : ARTICLES;

  // Compute the list of week-starts to load (covers period filter)
  const weeksToLoad = useMemo(() => {
    const set = new Set<string>([weekStart]);
    // Always load adjacent weeks so lots & sorties can flow between Sunday and next Monday
    const prev = parseISO(weekStart); prev.setDate(prev.getDate() - 7); set.add(fmt(prev));
    const next = parseISO(weekStart); next.setDate(next.getDate() + 7); set.add(fmt(next));
    if (filterFrom) set.add(fmt(getMonday(parseISO(filterFrom))));
    if (filterTo) set.add(fmt(getMonday(parseISO(filterTo))));
    if (filterFrom && filterTo) {
      const start = getMonday(parseISO(filterFrom));
      const end = getMonday(parseISO(filterTo));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
        set.add(fmt(d));
      }
    }
    return Array.from(set);
  }, [weekStart, filterFrom, filterTo]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("weekly_tracking")
        .select("*")
        .in("week_start", weeksToLoad)
        .eq("fiche_type", ficheType);
      if (error) {
        toast.error("Erreur de chargement");
        return;
      }
      setRows(data || []);
    })();
  }, [weeksToLoad, ficheType]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("weekly_tracking")
        .select("*")
        .eq("fiche_type", "Mouvement glaces & tartes")
        .eq("article", "Crème fraîche (mousse fouettée)");
      if (error) return;
      setCremeGlaceRows(data || []);
    })();
  }, [rows]);

  const CREME_ARTICLE = "Crème fraîche (mousse fouettée)";

  const numLocal = (v: any) => {
    if (v === "" || v == null) return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  // Lots saisis dans le mouvement glaces pour "Crème fraîche (mousse fouettée)".
  // Affichés automatiquement dans la fiche Suivi crème fraîche.
  // Clé: `${week_start}|${day_of_week}` → liste de lots distincts.
  const glaceCremeLotsByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    const merged = new Map<string, Row>();
    for (const r of cremeGlaceRows) {
      merged.set(`${r.week_start}|${r.day_of_week}|${r.row_index ?? 0}`, r);
    }
    for (const r of rows) {
      if (r.fiche_type === "Mouvement glaces & tartes" && r.article === CREME_ARTICLE) {
        merged.set(`${r.week_start}|${r.day_of_week}|${r.row_index ?? 0}`, r);
      }
    }
    for (const r of merged.values()) {
      const lot = (r.lot_number ?? "").toString().trim();
      if (!lot) continue;
      const k = `${r.week_start}|${r.day_of_week}`;
      const arr = map.get(k) ?? [];
      if (!arr.includes(lot)) arr.push(lot);
      map.set(k, arr);
    }
    return map;
  }, [cremeGlaceRows, rows]);


  const cellMap = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of rows) {
      const key = `${r.week_start}|${r.day_of_week}|${r.row_index}|${r.article ?? ""}`;
      m.set(key, r);
    }
    return m;
  }, [rows]);

  // Pour la fiche Suivi crème fraîche : attribue automatiquement à chaque
  // ligne (où une quantité est saisie) le prochain lot disponible côté
  // mouvement glaces, dans l'ordre des shifts (row_index 0..3).
  const cremeAutoLotMap = useMemo(() => {
    const map = new Map<string, string>();
    const weeks = new Set<string>([weekStart, ...rows.map((r) => r.week_start)]);
    for (const wk of weeks) {
      for (const day of DAYS) {
        const lots = glaceCremeLotsByDay.get(`${wk}|${day}`) ?? [];
        if (lots.length === 0) continue;
        const cremeSlots = [0, 1, 2, 3]
          .map((rowIdx) => {
            const r = cellMap.get(`${wk}|${day}|${rowIdx}|`);
            return { rowIdx, qty: numLocal(r?.quantity) };
          })
          .filter((s) => s.qty > 0);
        cremeSlots.forEach((s, i) => {
          const lot = lots[i] ?? lots[lots.length - 1];
          map.set(`${wk}|${day}|${s.rowIdx}`, lot);
        });
      }
    }
    return map;
  }, [glaceCremeLotsByDay, cellMap, weekStart, rows]);

  // Persiste automatiquement le lot transféré dans le champ lot_number
  // des lignes Suivi crème fraîche dès qu'une quantité est saisie.
  useEffect(() => {
    if (ficheType !== "Crème fraîche") return;
    if (cremeAutoLotMap.size === 0) return;
    setRows((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (r.fiche_type !== "Crème fraîche") return r;
        const key = `${r.week_start}|${r.day_of_week}|${r.row_index ?? 0}`;
        const auto = cremeAutoLotMap.get(key);
        if (!auto) return r;
        if (numLocal(r.quantity) <= 0) return r;
        if ((r.lot_number ?? "") === auto) return r;
        changed = true;
        return { ...r, lot_number: auto };
      });
      return changed ? next : prev;
    });
  }, [cremeAutoLotMap, ficheType]);

  const updateCellAt = (
    wkStart: string,
    day: string,
    rowIndex: number,
    article: string | null,
    patch: Partial<Row>,
  ) => {
    const key = `${wkStart}|${day}|${rowIndex}|${article ?? ""}`;
    setRows((prev) => {
      const idx = prev.findIndex(
        (r) => `${r.week_start}|${r.day_of_week}|${r.row_index}|${r.article ?? ""}` === key,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
      return [
        ...prev,
        {
          fiche_type: ficheType,
          week_start: wkStart,
          day_of_week: day,
          row_index: rowIndex,
          article,
          ...patch,
        },
      ];
    });
  };

  const updateCell = (
    day: string,
    rowIndex: number,
    article: string | null,
    patch: Partial<Row>,
  ) => updateCellAt(weekStart, day, rowIndex, article, patch);

  const cellAt = (wkStart: string, day: string, rowIndex: number, article: string | null) =>
    cellMap.get(`${wkStart}|${day}|${rowIndex}|${article ?? ""}`) ?? {};

  const cell = (day: string, rowIndex: number, article: string | null) =>
    cellAt(weekStart, day, rowIndex, article);

  const entriesForAt = (wkStart: string, day: string, article: string) => {
    const list: { rowIndex: number; entree: any; lot: any }[] = [];
    for (const r of rows) {
      if (
        r.week_start === wkStart &&
        r.day_of_week === day &&
        r.article === article &&
        (r.entrees != null || r.lot_number)
      ) {
        list.push({ rowIndex: r.row_index ?? 0, entree: r.entrees, lot: r.lot_number });
      }
    }
    return list.sort((a, b) => a.rowIndex - b.rowIndex);
  };
  const entriesFor = (day: string, article: string) => entriesForAt(weekStart, day, article);

  const num = (v: any) => {
    if (v === "" || v == null) return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  const getSI = (dayIdx: number, article: string, wkStart: string = weekStart): number | "" => {
    const v = cellAt(wkStart, DAYS[dayIdx], 0, article).stock_initial;
    return v === "" || v == null ? "" : Number(v);
  };

  const getSortie = (dayIdx: number, article: string, wkStart: string = weekStart): number | "" => {
    if (dayIdx >= DAYS.length - 1) {
      // Dimanche : si la semaine suivante a un Stock Initial Lundi, en déduire la sortie implicite
      const nextWk = (() => { const d = parseISO(wkStart); d.setDate(d.getDate() + 7); return fmt(d); })();
      const siNextMon = getSI(0, article, nextWk);
      const siCur = getSI(6, article, wkStart);
      if (siNextMon !== "" && siCur !== "") {
        const eCur = entriesForAt(wkStart, DAYS[6], article).reduce((s, e) => s + num(e.entree), 0);
        return Number(siCur) + eCur - Number(siNextMon);
      }
      const v = cellAt(wkStart, DAYS[dayIdx], 0, article).sorties;
      return v === "" || v == null ? "" : Number(v);
    }
    const siNext = getSI(dayIdx + 1, article, wkStart);
    const siCur = getSI(dayIdx, article, wkStart);
    if (siNext === "" || siCur === "") return "";
    const eCur = entriesForAt(wkStart, DAYS[dayIdx], article).reduce((s, e) => s + num(e.entree), 0);
    return Number(siCur) + eCur - Number(siNext);
  };

  // Returns the running per-lot remaining stock at END of dayIdx, in FIFO order.
  // Lot "" = stock initial sans lot (du lundi).
  const getLotBalancesEndOfDay = (
    dayIdx: number,
    article: string,
    wkStart: string = weekStart,
  ): { lot: string; remaining: number }[] => {
    type Batch = { lot: string; remaining: number };
    // Seed avec les lots restants à la fin du dimanche de la semaine précédente (report)
    const prevWk = (() => { const d = parseISO(wkStart); d.setDate(d.getDate() - 7); return fmt(d); })();
    const hasPrev = rows.some(
      (r) => r.week_start === prevWk && r.fiche_type === ficheType && r.article === article,
    );
    let batches: Batch[] = hasPrev
      ? getLotBalancesEndOfDay(6, article, prevWk)
          .filter((b) => b.remaining > 0)
          .map((b) => ({ ...b }))
      : [];
    for (let d = 0; d <= dayIdx; d++) {
      const day = DAYS[d];
      if (d === 0) {
        const si = num(cellAt(wkStart, day, 0, article).stock_initial);
        // Si un report existe déjà depuis la semaine précédente, ne pas dupliquer avec le SI Lundi
        if (si > 0 && batches.length === 0) batches.push({ lot: "", remaining: si });
      }
      for (const e of entriesForAt(wkStart, day, article)) {
        const q = num(e.entree);
        if (q > 0) batches.push({ lot: (e.lot ?? "").toString(), remaining: q });
      }
      let sortie = num(cellAt(wkStart, day, 0, article).sorties);
      if (!sortie) {
        const computed = getSortie(d, article, wkStart);
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

  // Lots du jour uniquement (SI le lundi + entrées du jour) — pour tarte/glace
  const getLotsOfDay = (
    dayIdx: number,
    article: string,
    wkStart: string = weekStart,
  ): { lot: string; remaining: number }[] => {
    // Report : lots restants à la fin du dimanche de la semaine précédente
    const prevWk = (() => { const d = parseISO(wkStart); d.setDate(d.getDate() - 7); return fmt(d); })();
    const hasPrev = rows.some(
      (r) => r.week_start === prevWk && r.fiche_type === ficheType && r.article === article,
    );
    const out: { lot: string; remaining: number }[] = hasPrev
      ? getLotsOfDay(6, article, prevWk).map((b) => ({ ...b }))
      : [];
    // SI du lundi : ajuste les lots reportés (FIFO) pour que le total
    // corresponde exactement au SI saisi — chaque lot conserve son numéro
    // et sa quantité, on ne fait que compléter ou réduire si besoin.
    const siMon = num(cellAt(wkStart, DAYS[0], 0, article).stock_initial);
    if (siMon > 0) {
      if (out.length === 0) {
        out.push({ lot: "", remaining: siMon });
      } else {
        const total = out.reduce((s, b) => s + b.remaining, 0);
        if (total > siMon) {
          let excess = total - siMon;
          for (const b of out) {
            if (excess <= 0) break;
            const take = Math.min(b.remaining, excess);
            b.remaining -= take;
            excess -= take;
          }
        } else if (total < siMon) {
          out.push({ lot: "", remaining: siMon - total });
        }
      }
    }
    // Entrées cumulées + déduction FIFO des sorties jour par jour
    for (let d = 0; d <= dayIdx; d++) {
      for (const e of entriesForAt(wkStart, DAYS[d], article)) {
        const q = num(e.entree);
        if (q > 0) out.push({ lot: (e.lot ?? "").toString(), remaining: q });
      }
      let sortie = num(cellAt(wkStart, DAYS[d], 0, article).sorties);
      if (!sortie) {
        const computed = getSortie(d, article, wkStart);
        if (typeof computed === "number") sortie = computed;
      }
      let need = sortie;
      for (const b of out) {
        if (need <= 0) break;
        if (b.remaining <= 0) continue;
        const take = Math.min(b.remaining, need);
        b.remaining -= take;
        need -= take;
      }
    }
    return out.filter((b) => b.remaining > 0);
  };

  const addEntryRow = (day: string, article: string) => {
    const existing = entriesFor(day, article);
    const nextIdx = existing.length > 0 ? Math.max(...existing.map((e) => e.rowIndex)) + 1 : 1;
    updateCell(day, nextIdx, article, { entrees: "", lot_number: "" });
  };

  const removeEntryRow = (day: string, rowIndex: number, article: string, wkStart: string = weekStart) => {
    const key = `${wkStart}|${day}|${rowIndex}|${article}`;
    setRows((prev) =>
      prev.filter(
        (r) => `${r.week_start}|${r.day_of_week}|${r.row_index}|${r.article ?? ""}` !== key,
      ),
    );
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

      const wkStarts = Array.from(new Set(meaningful.map((r) => r.week_start).concat([weekStart])));
      const { error: delErr } = await supabase
        .from("weekly_tracking")
        .delete()
        .in("week_start", wkStarts)
        .eq("fiche_type", ficheType);
      if (delErr) throw delErr;

      if (meaningful.length > 0) {
        const payload = meaningful.map((r) => ({
          fiche_type: ficheType,
          week_start: r.week_start ?? weekStart,
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
    const d = parseISO(weekStart);
    d.setDate(d.getDate() + n * 7);
    setWeekStart(fmt(d));
  };

  // Filtered articles list (article filter)
  const visibleArticles = useMemo(() => {
    const list = activeArticles.map((a, i) => ({ article: a, aIdx: i }));
    if (filterArticle === "all") return list;
    return list.filter((x) => x.article === filterArticle);
  }, [filterArticle, activeArticles]);

  // Filtered days — supports period spanning multiple weeks
  type VisDay = { wkStart: string; day: string; dIdx: number; iso: string };
  const visibleDays: VisDay[] = useMemo(() => {
    const out: VisDay[] = [];
    const weeks = filterFrom || filterTo ? weeksToLoad.slice().sort() : [weekStart];
    for (const wk of weeks) {
      DAYS.forEach((d, i) => {
        const dt = parseISO(wk);
        dt.setDate(dt.getDate() + i);
        const iso = fmt(dt);
        if (filterDay !== "all" && weeks.length === 1 && Number(filterDay) !== i) return;
        if (filterFrom && iso < filterFrom) return;
        if (filterTo && iso > filterTo) return;
        out.push({ wkStart: wk, day: d, dIdx: i, iso });
      });
    }
    return out;
  }, [filterDay, filterFrom, filterTo, weekStart, weeksToLoad]);

  // For "type" filter: determine if a (day,article) cell matches
  const cellMatchesTypeFilter = (dIdx: number, article: string, wkStart: string = weekStart): boolean => {
    if (filterType === "all") return true;
    if (filterType === "masquer_lots") return true;
    const c = cellAt(wkStart, DAYS[dIdx], 0, article);
    const entries = entriesForAt(wkStart, DAYS[dIdx], article);
    const sortie = getSortie(dIdx, article, wkStart);

    if (filterType === "si") return c.stock_initial != null && c.stock_initial !== "";
    if (filterType === "entree") return entries.some((e) => num(e.entree) > 0);
    if (filterType === "sortie") return typeof sortie === "number" && sortie !== 0;
    if (filterType === "sans_lot_existant") {
      // Pas de lot identifié dans le stock existant (vide OU uniquement "(sans lot)")
      const balances = getLotBalancesEndOfDay(dIdx, article, wkStart);
      const hasNamedLot = balances.some((b) => b.remaining > 0 && (b.lot ?? "").toString().trim());
      const hasAnyStock = balances.some((b) => b.remaining > 0);
      return hasAnyStock && !hasNamedLot;
    }
    if (filterType === "sans_lot") {
      // Show only if there is an entry without a lot, or sortie with no lot info
      const entreeSansLot = entries.some((e) => num(e.entree) > 0 && !(e.lot ?? "").toString().trim());
      const sortieAvecStockSansLot = (() => {
        if (typeof sortie !== "number" || sortie === 0) return false;
        // a sortie is "sans lot" if FIFO consumes from the "" (stock initial) batch
        // Recompute consumption tracking the lots used today
        const balancesBefore = dIdx === 0 ? [] : getLotBalancesEndOfDay(dIdx - 1, article, wkStart);
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
    if (filterType === "all" || filterType === "masquer_lots") return visibleArticles;
    return visibleArticles.filter((row) =>
      visibleDays.some((d) => cellMatchesTypeFilter(d.dIdx, row.article, d.wkStart)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleArticles, visibleDays, filterType, rows]);

  const resetFilters = () => {
    setFilterArticle("all");
    setFilterDay("all");
    setFilterType("all");
    setFilterFrom("");
    setFilterTo("");
  };

  const filtersActive =
    filterArticle !== "all" || filterDay !== "all" || filterType !== "all" || !!filterFrom || !!filterTo;

  const handleScanResults = (scanned: ScannedEntry[]) => {
    const today = new Date();
    const monday = getMonday(today);
    const targetWeek = fmt(monday);
    const dayDiff = Math.floor(
      (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
        monday.getTime()) /
        86400000,
    );
    const dayName = DAYS[Math.max(0, Math.min(6, dayDiff))];

    setRows((prev) => {
      let next = [...prev];
      for (const e of scanned) {
        const existingForArticle = next.filter(
          (r) =>
            r.week_start === targetWeek &&
            r.day_of_week === dayName &&
            r.article === e.article &&
            (r.entrees != null || r.lot_number),
        );
        const nextIdx =
          existingForArticle.length > 0
            ? Math.max(...existingForArticle.map((r) => r.row_index ?? 0)) + 1
            : 1;
        next.push({
          fiche_type: ficheType,
          week_start: targetWeek,
          day_of_week: dayName,
          row_index: nextIdx,
          article: e.article,
          entrees: e.quantity,
          lot_number: e.lotNumber,
        });
      }
      return next;
    });

    if (targetWeek !== weekStart) setWeekStart(targetWeek);
    toast.info("N'oubliez pas d'enregistrer pour sauvegarder.");
  };

  return (
    <div className="space-y-4">
      {/* TOP BAR: week selector + toggle */}
      <div className="bg-card rounded-xl border shadow-sm p-4 flex flex-wrap items-center gap-3">
        {showControls && (
          <>
            <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => shiftWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 font-normal">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <span className="font-medium">Choisir une semaine</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseISO(weekStart)}
                  onSelect={(d) => d && setWeekStart(fmt(getMonday(d)))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20">
              <CalendarIcon className="h-3.5 w-3.5" />
              Semaine du {parseISO(weekStart).toLocaleDateString("fr-FR")} → {addDays(weekStart, 6)}
            </div>
            <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => shiftWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart(fmt(getMonday(new Date())))}
              className="text-xs"
            >
              Aujourd'hui
            </Button>
          </>
        )}
        {!showControls && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20">
            <CalendarIcon className="h-3.5 w-3.5" />
            Semaine du {parseISO(weekStart).toLocaleDateString("fr-FR")} → {addDays(weekStart, 6)}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowControls((v) => !v)}
          className="text-xs ml-auto"
          title={showControls ? "Masquer filtres et semaine" : "Afficher filtres et semaine"}
        >
          {showControls ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          {showControls ? "Masquer" : "Afficher"}
        </Button>
        <div className={showControls ? "" : "ml-auto"}>
          <Button onClick={handleSave} disabled={saving} size="sm" className="shadow-sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="creme">Crème fraîche</TabsTrigger>
          <TabsTrigger value="glace">Mouvement glaces</TabsTrigger>
          <TabsTrigger value="tarte">Mouvement tartes</TabsTrigger>
        </TabsList>

        <TabsContent value="creme" className="mt-4">
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Jour</th>
                  <th className="p-2 text-left">Shift</th>
                  <th className="p-2 text-left">Quantité</th>
                  <th className="p-2 text-left min-w-[260px]">N° lot crème fraîche</th>
                  <th className="p-2 text-left">Couleur</th>
                  <th className="p-2 text-left">Odeur</th>
                  <th className="p-2 text-left">Texture</th>
                  <th className="p-2 text-left">Visa opérateur</th>
                  <th className="p-2 text-left">Visa manager</th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, dIdx) =>
                  [0, 1, 2, 3].map((rowIdx) => {
                    const c = cell(day, rowIdx, null);
                    const isFirstOfDay = rowIdx === 0;
                    const isFirstOfShift = rowIdx === 0 || rowIdx === 2;
                    const shiftLabel = rowIdx < 2 ? "Matin" : "Soir";
                    return (
                      <tr
                        key={`${day}-${rowIdx}`}
                        className={cn(
                          "border-t",
                          rowIdx === 2 && "border-t-2 border-t-primary/30",
                        )}
                      >
                        {isFirstOfDay && (
                          <td rowSpan={4} className="p-2 font-medium border-r align-middle">
                            <div>{day}</div>
                            <div className="text-[10px] font-normal text-muted-foreground">
                              {dayShort(weekStart, dIdx)}
                            </div>
                          </td>
                        )}
                        {isFirstOfShift && (
                          <td
                            rowSpan={2}
                            className={cn(
                              "p-2 text-xs font-semibold border-r align-middle text-center",
                              shiftLabel === "Matin"
                                ? "bg-amber-50 text-amber-800"
                                : "bg-indigo-50 text-indigo-800",
                            )}
                          >
                            {shiftLabel}
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
                          {(() => {
                            const hasQty = numLocal(c.quantity) > 0;
                            const autoLot = hasQty
                              ? cremeAutoLotMap.get(`${weekStart}|${day}|${rowIdx}`) ?? ""
                              : "";
                            if (hasQty && autoLot) {
                              return (
                                <div
                                  className="h-8 min-w-[240px] px-2 flex items-center rounded border bg-primary/10 text-primary border-primary/40 text-sm font-medium"
                                  title={`Lot transféré depuis le mouvement glaces : ${autoLot}`}
                                >
                                  {autoLot}
                                </div>
                              );
                            }
                            return (
                              <Input
                                value={c.lot_number ?? ""}
                                onChange={(e) => updateCell(day, rowIdx, null, { lot_number: e.target.value })}
                                className="h-8 min-w-[240px]"
                                placeholder={hasQty ? "Aucun lot dispo en mouvement glaces" : "Saisir la quantité…"}
                                disabled={!hasQty}
                              />
                            );
                          })()}
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
                        <td className="p-1 align-middle">
                          <Input
                            value={c.visa_operateur ?? ""}
                            onChange={(e) => updateCell(day, rowIdx, null, { visa_operateur: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        {isFirstOfShift && (
                          <td rowSpan={2} className="p-1 align-middle border-l">
                            <Input
                              value={cell(day, rowIdx, null).visa_manager ?? ""}
                              onChange={(e) => updateCell(day, rowIdx, null, { visa_manager: e.target.value })}
                              className="h-8"
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {(["glace", "tarte"] as const).map((t) => (
        <TabsContent key={t} value={t} className="mt-4 space-y-3">
          {/* FILTERS BAR */}
          {showControls && (
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
              <Label className="text-xs">Période — Du</Label>
              <Input
                type="date"
                className="h-8 w-36 text-xs"
                value={filterFrom}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilterFrom(v);
                  if (v) setWeekStart(fmt(getMonday(parseISO(v))));
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Au</Label>
              <Input
                type="date"
                className="h-8 w-36 text-xs"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Affichage</Label>
              <label className="h-8 flex items-center gap-2 text-xs px-2 rounded border bg-background cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterType === "masquer_lots"}
                  onChange={(e) => setFilterType(e.target.checked ? "masquer_lots" : "all")}
                  className="h-3.5 w-3.5"
                />
                Masquer lots (entrée + existant)
              </label>
            </div>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8">
                <X className="h-3 w-3 mr-1" /> Réinitialiser
              </Button>
            )}
            <div className="ml-auto">
              <PhotoScanEntry
                articles={t === "glace" ? GLACE_ARTICLES : TARTE_ARTICLES}
                onConfirm={handleScanResults}
                buttonLabel="📷 Scanner entrée"
              />
            </div>
          </div>
          )}

          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-1 text-left sticky left-0 bg-muted z-10 border-r w-[110px] text-[11px]">Article</th>
                  {visibleDays.map(({ day, dIdx, wkStart, iso }) => (
                    <th
                      key={`${wkStart}-${day}`}
                      colSpan={filterType === "masquer_lots" ? 3 : 5}
                      className="p-2 text-center border-l"
                    >
                      <div>{day}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        {dayShort(wkStart, dIdx)}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="p-1 sticky left-0 bg-muted z-10 border-r"></th>
                  {visibleDays.map(({ day, wkStart }) => (
                    <Fragment key={`${wkStart}-${day}-h`}>
                      <th className="p-1 border-l text-center font-normal">SI</th>
                      <th className="p-1 text-center font-normal text-success">E</th>
                      {filterType !== "masquer_lots" && (
                        <th className="p-1 text-center font-normal">N° lot</th>
                      )}
                      <th className="p-1 text-center font-normal text-destructive">S</th>
                      {filterType !== "masquer_lots" && (
                        <th className="p-1 text-center font-normal">Lot existant</th>
                      )}
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredArticles.map(({ article, aIdx }, rowI) => (
                  <tr
                    key={article}
                    className={cn("border-t", rowI % 2 === 1 && "bg-muted/30", "hover:bg-accent/20")}
                  >
                    <td
                      title={article}
                      className={cn(
                        "p-1 font-medium sticky left-0 z-10 border-r whitespace-nowrap border-b-2 border-b-primary/10 shadow-[2px_0_4px_-2px_hsl(var(--border))] max-w-[110px] truncate text-[11px]",
                        rowI % 2 === 1 ? "bg-muted" : "bg-card",
                      )}
                    >
                      {article}
                    </td>
                    {visibleDays.map(({ day, dIdx, wkStart }) => {
                      const c = cellAt(wkStart, day, 0, article);
                      const entries = entriesForAt(wkStart, day, article);
                      const entryRows = entries.length > 0 ? entries : [{ rowIndex: 0, entree: "", lot: "" }];
                      const sortieAuto = getSortie(dIdx, article, wkStart);
                      const totalE = entries.reduce((s, e) => s + num(e.entree), 0);
                      const matchType = cellMatchesTypeFilter(dIdx, article, wkStart);
                      const dim = filterType !== "all" && filterType !== "masquer_lots" && !matchType;
                      return (
                        <Fragment key={`${wkStart}-${day}`}>
                          {/* SI */}
                          <td className={cn("p-0.5 border-l-2 border-l-border align-top", dim && "opacity-30")}>
                            <Input
                              type="number"
                              inputMode="numeric"
                              data-si={`${dIdx}-${aIdx}`}
                              value={c.stock_initial ?? ""}
                              onChange={(e) =>
                                updateCellAt(wkStart, day, 0, article, { stock_initial: e.target.value })
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
                                    updateCellAt(wkStart, day, er.rowIndex, article, { entrees: ev.target.value })
                                  }
                                  className="h-7 w-14 text-xs px-1 bg-success/10 text-success border-success/40 font-medium"
                                />
                              ))}
                              <button
                                type="button"
                                onClick={() => {
                                  const existing = entriesForAt(wkStart, day, article);
                                  const nextIdx = existing.length > 0 ? Math.max(...existing.map((e) => e.rowIndex)) + 1 : 1;
                                  updateCellAt(wkStart, day, nextIdx, article, { entrees: "", lot_number: "" });
                                }}
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
                          {filterType !== "masquer_lots" && (
                          <td className={cn("p-0.5 align-top", dim && "opacity-30")}>
                            <div className="flex flex-col gap-0.5">
                              {entryRows.map((er, i) => (
                                  <div key={`l-${er.rowIndex}-${i}`} className="flex items-center gap-0.5">
                                    <Input
                                      value={er.lot ?? ""}
                                      onChange={(ev) =>
                                        updateCellAt(wkStart, day, er.rowIndex, article, { lot_number: ev.target.value })
                                      }
                                      placeholder="lot"
                                      className="h-7 w-20 text-xs px-1"
                                    />
                                    {er.rowIndex > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => removeEntryRow(day, er.rowIndex, article, wkStart)}
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
                          )}
                          {/* Sortie auto — ROUGE */}
                          <td className={cn("p-0.5 align-top", dim && "opacity-30")}>
                            <div className="h-7 w-14 text-xs px-1 flex items-center justify-center bg-destructive/10 text-destructive border border-destructive/40 rounded font-medium">
                              {sortieAuto === "" || sortieAuto == null ? "—" : sortieAuto}
                            </div>
                          </td>
                          {/* Lot existant (FIFO restant par lot) */}
                          {filterType !== "masquer_lots" && (
                            <td className={cn("p-0.5 align-top", dim && "opacity-30")}>
                              <LotExistantCell
                                dayIdx={dIdx}
                                article={article}
                                getBalances={(d, a) => getLotsOfDay(d, a, wkStart)}
                              />
                            </td>
                          )}
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
                {filteredArticles.length === 0 && (
                  <tr>
                    <td
                      colSpan={1 + visibleDays.length * (filterType === "masquer_lots" ? 3 : 5)}
                      className="p-6 text-center text-muted-foreground"
                    >
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
            <strong>Lot existant</strong> cumule le SI du lundi et les entrées, puis déduit les sorties en FIFO.
          </div>
        </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
