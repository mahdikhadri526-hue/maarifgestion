import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save, Check, Plus, Trash2, Filter, X, CalendarIcon, Eye, EyeOff, Lock, Printer, FileDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, formatDateFR } from "@/lib/utils";
import { PhotoScanEntry, type ScannedEntry } from "./PhotoScanEntry";
import { OPERATORS } from "@/lib/operators";
import { MANAGERS } from "@/lib/managers";
import { useOperators, useManagers } from "@/lib/roster";
import { useAuth } from "@/contexts/AuthContext";
import { printElement, printStructuredPdf, downloadStructuredPdf, type PdfTableSection } from "@/lib/printExport";
import { fetchAllRows } from "@/lib/supabasePaginate";
import { MaterielTracking } from "./MaterielTracking";
import { WeeklyTransfers } from "./WeeklyTransfers";

const SHOW_KG_BAC = false; // colonne Kg/bac masquée
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

const TARTE_ARTICLES = [
  "Tarte 6", "Tarte 8", "Tarte 10", "Tte Sp.", "Tte.Sp 8", "Tte Mac.", "Tte Sor.",
  "Tche Sor.", "Tche Mac.", "Tche Nap.", "Bûche", "Bûche Sp.", "N.F", "Demis",
  "Maria Louisa", "Maria mangue", "Maria framboise", "Maria reglisse", "M.Loulou", "Panachés",
  "Mac.Chocolat P", "Mac.Pistache P", "Mac.Caramel P", "Mac.Cfé P", "Mac.Mng P", "Mac.Cit P",
  "Mac.Chocolat N", "Mac.Pistache N", "Mac.Caramel N", "Mac.Cfé N", "Mac.Mng N", "Mac.Cit N",
  "Chantilly,F,C", "Cho.Logo", "PJA", "Cho.Blnc", "Amd.Crml", "Sirop.Blc", "Sirop.Crml",
  "Merg.trt", "Merg.Pt KG", "Merg.Pt SCH", "Merg.Glacé", "Org.Confit", "Biscuit",
  "Bigarreaux", "Cake Chocolat", "Cake.citron", "Pain Savoi", "Brownies.G", "Brownies.Top",
  "Amandes.Top", "Noix.Top", "Tulipes", "Cornet", "Gaufrette",
  "Orange fruits", "Citron fruits", "POMME fruits", "POIRE fruits", "Ananas fruits", "Kiwi fruits",
  "Rc 20", "Chlorane", "Solnet", "Flexi", "Mitard A", "Renovac", "Clean plack",
  "Handonet", "Rince Matic", "Wach Matic", "Handobac",
];
const GLACE_ARTICLES = [
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
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function dayShort(iso: string, n: number) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

function lotDateKey(lot: string): string | null {
  const value = lot.trim();
  const fr = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  return null;
}

type Row = Record<string, any>;

const WEEKLY_VALUE_FIELDS = [
  "lot_number",
  "couleur",
  "odeur",
  "texture",
  "visa_operateur",
  "visa_manager",
  "stock_initial",
  "entrees",
  "sorties",
  "quantity",
] as const;

const rowKey = (r: Row) => `${r.fiche_type}|${r.week_start}|${r.day_of_week}|${r.row_index ?? 0}|${r.article ?? ""}`;
const filled = (v: any) => v !== null && v !== undefined && v !== "";
const rowStamp = (r: Row) => new Date(r.updated_at ?? r.created_at ?? 0).getTime();
const hasWeeklyValue = (r: Row) => WEEKLY_VALUE_FIELDS.some((f) => filled(r[f]));

function normalizeWeeklyRows(input: Row[]) {
  const merged = new Map<string, Row>();
  input.forEach((row) => {
    const key = rowKey(row);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...row });
      return;
    }
    const newer = rowStamp(row) >= rowStamp(current) ? { ...row } : { ...current };
    const older = newer.id === row.id ? current : row;
    WEEKLY_VALUE_FIELDS.forEach((field) => {
      if (!filled(newer[field]) && filled(older[field])) newer[field] = older[field];
    });
    if (row.__dirty || current.__dirty) newer.__dirty = true;
    merged.set(key, newer);
  });
  const dayRank = (day: any) => {
    const idx = DAYS.indexOf(day as typeof DAYS[number]);
    return idx < 0 ? 99 : idx;
  };
  return Array.from(merged.values()).sort(
    (a, b) =>
      String(a.week_start ?? "").localeCompare(String(b.week_start ?? "")) ||
      dayRank(a.day_of_week) - dayRank(b.day_of_week) ||
      String(a.article ?? "").localeCompare(String(b.article ?? "")) ||
      Number(a.row_index ?? 0) - Number(b.row_index ?? 0),
  );
}

async function runInBatches<T>(items: T[], worker: (item: T) => Promise<void>, batchSize = 25) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(worker));
  }
}

function ConformityToggle({
  value,
  onChange,
  disabled,
}: {
  value?: string | null;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={() => onChange(value === "C" ? "" : "C")}
        disabled={disabled}
        className={cn(
          "h-8 w-8 rounded border flex items-center justify-center transition-colors",
          value === "C"
            ? "bg-success text-success-foreground border-success"
            : "bg-background hover:bg-muted",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        aria-label="Conforme"
      >
        <Check className="h-4 w-4" />
      </button>
    </div>
  );
}

// Input bufferisé : conserve la valeur en local pendant la frappe et ne
// remonte au parent qu'au blur ou à Enter. Évite de recomputer tout le
// tableau (cellMap, FIFO, sorties auto…) à chaque caractère, ce qui
// rendait la saisie très lente sur glace/tarte.
const CommittedInput = React.memo(function CommittedInput({
  value,
  onCommit,
  className,
  disabled,
  type,
  inputMode,
  placeholder,
  ...rest
}: {
  value: any;
  onCommit: (v: string) => void;
  className?: string;
  disabled?: boolean;
  type?: string;
  inputMode?: any;
  placeholder?: string;
  [key: string]: any;
}) {
  const initial = value ?? "";
  const [local, setLocal] = useState<string>(String(initial));
  const lastExternal = useRef<string>(String(initial));
  useEffect(() => {
    const ext = String(value ?? "");
    if (ext !== lastExternal.current) {
      lastExternal.current = ext;
      setLocal(ext);
    }
  }, [value]);
  const commit = () => {
    if (local !== lastExternal.current) {
      lastExternal.current = local;
      onCommit(local);
    }
  };
  return (
    <Input
      {...rest}
      type={type}
      inputMode={inputMode}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.currentTarget as HTMLInputElement).blur();
        }
        rest.onKeyDown?.(e);
      }}
    />
  );
});

type FilterType = "all" | "si" | "entree" | "sortie" | "sans_lot";
type FilterTypeExt = FilterType | "sans_lot_existant" | "masquer_lots";

function LotExistantCell({
  dayIdx,
  article,
  getBalances,
}: {
  dayIdx: number;
  article: string;
  getBalances: (d: number, a: string) => { lot: string; remaining: number; entryDate?: string }[];
}) {
  const batches = getBalances(dayIdx, article).filter((b) => b.remaining > 0);
  // Tri FIFO strict : le lot avec la date d'entrée la plus ancienne en haut.
  // On fusionne les lots identiques en conservant la date d'entrée la plus
  // ancienne, puis on trie par cette date (puis par ordre d'arrivée en
  // secours pour les dates identiques ou absentes).
  const merged: { lot: string; remaining: number; entryDate: string; lotDate: string; order: number }[] = [];
  batches.forEach((b, idx) => {
    const label = b.lot && b.lot.trim() ? b.lot : "(sans lot)";
    const ed = b.entryDate ?? "";
    const existing = merged.find((m) => m.lot === label);
    if (existing) {
      existing.remaining += b.remaining;
      if (ed && (!existing.entryDate || ed < existing.entryDate)) existing.entryDate = ed;
    } else {
      merged.push({ lot: label, remaining: b.remaining, entryDate: ed, lotDate: lotDateKey(label) ?? "", order: idx });
    }
  });
  merged.sort((a, b) => {
    const ad = a.lotDate || a.entryDate || "\uffff";
    const bd = b.lotDate || b.entryDate || "\uffff";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.order - b.order;
  });
  // Fusion "(sans lot)" -> ajoute la quantité au lot réel le plus ancien si disponible
  const sansLotIdx = merged.findIndex((m) => m.lot === "(sans lot)");
  if (sansLotIdx !== -1) {
    const realLot = merged.find((m) => m.lot !== "(sans lot)");
    if (realLot) {
      realLot.remaining += merged[sansLotIdx].remaining;
      merged.splice(sansLotIdx, 1);
    }
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
            <span className="font-bold tabular-nums text-foreground">×{Math.round(m.remaining * 100) / 100}</span>
          </div>
        ))
      )}
    </div>
  );
}

export function WeeklyTracking() {
  const [weekStart, setWeekStart] = useState<string>(fmt(getMonday(new Date())));
  const [tab, setTab] = useState<"creme" | "glace" | "tarte" | "materiel">("creme");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  // Toutes les entrées "Crème fraîche (mousse fouettée)" du mouvement glaces,
  // chargées globalement pour afficher leurs lots dans la fiche Suivi crème fraîche.
  const [cremeGlaceRows, setCremeGlaceRows] = useState<Row[]>([]);

  // Grammage par bac pour chaque parfum de glace (g)
  const [glaceGrammages, setGlaceGrammages] = useState<Record<string, number>>({});
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("glace_grammage")
          .select("article, grammage_grams");
        if (error) throw error;
        const map: Record<string, number> = {};
        (data || []).forEach((r: any) => {
          map[r.article] = Number(r.grammage_grams) || 0;
        });
        setGlaceGrammages(map);
      } catch {
        /* ignore */
      }
    })();
  }, []);
  const saveGrammage = async (article: string, raw: string) => {
    // Saisie en Kg/bac → stockée en grammes en base
    const kg = Math.max(0, Number(raw) || 0);
    const grams = Math.round(kg * 1000);
    setGlaceGrammages((prev) => ({ ...prev, [article]: grams }));
    try {
      const { error } = await supabase
        .from("glace_grammage")
        .upsert({ article, grammage_grams: grams }, { onConflict: "article" });
      if (error) throw error;
    } catch (err: any) {
      toast.error("Erreur grammage", { description: err?.message ?? String(err) });
    }
  };

  // Filters for Mouvement tab
  const [filterArticle, setFilterArticle] = useState<string>("all");
  const [filterDay, setFilterDay] = useState<string>("all"); // index 0..6 or "all"
  const [filterType, setFilterType] = useState<FilterTypeExt>("all");
  const [filterFrom, setFilterFrom] = useState<string>(""); // YYYY-MM-DD
  const [filterTo, setFilterTo] = useState<string>(""); // YYYY-MM-DD
  const [showControls, setShowControls] = useState(true);
  const [unlockedDays, setUnlockedDays] = useState<Set<string>>(new Set());
  const [scanDay, setScanDay] = useState<string>("today");
  const { can, user } = useAuth();
  const operatorOptions = useOperators();
  const managerOptions = useManagers();
  const restrictedEmail = "gestionmaarif1@gmail.com";
  const isRestrictedUser = (user?.email ?? "").toLowerCase() === restrictedEmail;
  const ficheRef = useRef<HTMLDivElement>(null);
  const handlePrintFiche = () => {
    const label = tab === "creme" ? "creme-fraiche" : tab === "glace" ? "mouvement-glaces" : "mouvement-tartes";
    printStructuredPdf(buildWeeklyPdf(label)).catch((err: any) => {
      toast.error("Erreur impression", { description: err?.message ?? String(err) });
      if (ficheRef.current) printElement(ficheRef.current);
    });
  };
  const handleDownloadFiche = async () => {
    const label = tab === "creme" ? "creme-fraiche" : tab === "glace" ? "mouvement-glaces" : "mouvement-tartes";
    toast.info("Génération du PDF...");
    try {
      await downloadStructuredPdf(buildWeeklyPdf(label));
    } catch (err: any) {
      toast.error("Erreur PDF", { description: err?.message ?? String(err) });
    }
  };
  const todayIso = fmt(new Date());
  const tomorrowIso = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return fmt(d); })();
  const yesterdayIso = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return fmt(d); })();
  const dayIso = (wkStart: string, dIdx: number) => {
    const d = parseISO(wkStart);
    d.setDate(d.getDate() + dIdx);
    return fmt(d);
  };
  const isDayEditable = (iso: string) => {
    if (isRestrictedUser) return iso === yesterdayIso || iso === todayIso || iso === tomorrowIso;
    return iso === yesterdayIso || iso === todayIso || iso === tomorrowIso || unlockedDays.has(iso);
  };

  const ficheType = tab === "creme" ? "Crème fraîche" : "Mouvement glaces & tartes";
  const activeArticles = tab === "glace" ? GLACE_ARTICLES : tab === "tarte" ? TARTE_ARTICLES : ARTICLES;

  // Compute the list of week-starts to load (covers period filter)
  const weeksToLoad = useMemo(() => {
    const set = new Set<string>([weekStart]);
    // Always load adjacent weeks so lots & sorties can flow between Sunday and next Monday
    // On charge 2 semaines en arrière car le calcul du report de lots
    // au lundi a besoin de la fin du dimanche précédent, lui-même calculé
    // à partir du report de la semaine encore avant.
    const prev1 = parseISO(weekStart); prev1.setDate(prev1.getDate() - 7); set.add(fmt(prev1));
    const prev2 = parseISO(weekStart); prev2.setDate(prev2.getDate() - 14); set.add(fmt(prev2));
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
      try {
        const data = await fetchAllRows<any>(() =>
          supabase
            .from("weekly_tracking")
            .select("*")
            .eq("fiche_type", ficheType),
        );
        setRows(normalizeWeeklyRows(data || []));
      } catch (error) {
        toast.error("Erreur de chargement");
      }
    })();
  }, [ficheType]);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchAllRows<any>(() =>
          supabase
            .from("weekly_tracking")
            .select("*")
            .eq("fiche_type", "Mouvement glaces & tartes")
            .eq("article", "Crème fraîche (mousse fouettée)"),
        );
        setCremeGlaceRows(normalizeWeeklyRows(data || []));
      } catch {
        /* ignore */
      }
    })();
  }, [weekStart, tab]);

  const CREME_ARTICLE = "Crème fraîche (mousse fouettée)";

  const numLocal = (v: any) => {
    if (v === "" || v == null) return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  // Données mouvement glaces pour la crème fraîche, utilisées en lecture seule
  // afin d'alimenter automatiquement les lots dans le suivi Crème fraîche.
  const movementCremeRows = useMemo(() => {
    const merged = new Map<string, Row>();
    for (const r of cremeGlaceRows) {
      if (r.fiche_type === "Mouvement glaces & tartes" && r.article === CREME_ARTICLE) {
        merged.set(`${r.week_start}|${r.day_of_week}|${r.row_index ?? 0}`, r);
      }
    }
    for (const r of rows) {
      if (r.fiche_type === "Mouvement glaces & tartes" && r.article === CREME_ARTICLE) {
        merged.set(`${r.week_start}|${r.day_of_week}|${r.row_index ?? 0}`, r);
      }
    }
    return Array.from(merged.values());
  }, [cremeGlaceRows, rows]);

  const movementCremeCellMap = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of movementCremeRows) {
      const key = `${r.week_start}|${r.day_of_week}|${r.row_index ?? 0}|${r.article ?? ""}`;
      m.set(key, r);
    }
    return m;
  }, [movementCremeRows]);


  const cellMap = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of rows) {
      const key = `${r.week_start}|${r.day_of_week}|${r.row_index}|${r.article ?? ""}`;
      m.set(key, r);
    }
    return m;
  }, [rows]);

  const movementCellAt = (wkStart: string, day: string, rowIndex: number) =>
    movementCremeCellMap.get(`${wkStart}|${day}|${rowIndex}|${CREME_ARTICLE}`) ?? {};

  const movementEntriesForAt = (wkStart: string, day: string) =>
    movementCremeRows
      .filter(
        (r) =>
          r.week_start === wkStart &&
          r.day_of_week === day &&
          r.article === CREME_ARTICLE &&
          (r.entrees != null || r.lot_number),
      )
      .map((r) => ({ rowIndex: r.row_index ?? 0, entree: r.entrees, lot: r.lot_number }))
      .sort((a, b) => a.rowIndex - b.rowIndex);

  const getMovementSI = (dayIdx: number, wkStart: string): number | "" => {
    const v = movementCellAt(wkStart, DAYS[dayIdx], 0).stock_initial;
    return v === "" || v == null ? "" : Number(v);
  };

  const getMovementSortie = (dayIdx: number, wkStart: string): number | "" => {
    const explicit = movementCellAt(wkStart, DAYS[dayIdx], 0).sorties;
    if (explicit !== "" && explicit != null) return Number(explicit);
    if (dayIdx >= DAYS.length - 1) {
      const nextWk = (() => { const d = parseISO(wkStart); d.setDate(d.getDate() + 7); return fmt(d); })();
      const siCur = getMovementSI(dayIdx, wkStart);
      const siNextMon = getMovementSI(0, nextWk);
      if (siCur === "" || siNextMon === "") return "";
      const entries = movementEntriesForAt(wkStart, DAYS[dayIdx]).reduce((s, e) => s + numLocal(e.entree), 0);
      return Number(siCur) + entries - Number(siNextMon);
    }
    const siCur = getMovementSI(dayIdx, wkStart);
    const siNext = getMovementSI(dayIdx + 1, wkStart);
    if (siCur === "" || siNext === "") return "";
    const entries = movementEntriesForAt(wkStart, DAYS[dayIdx]).reduce((s, e) => s + numLocal(e.entree), 0);
    return Number(siCur) + entries - Number(siNext);
  };

  const getMovementLotsOfDay = (dayIdx: number, wkStart: string): { lot: string; remaining: number }[] => {
    const prevWk = (() => { const d = parseISO(wkStart); d.setDate(d.getDate() - 7); return fmt(d); })();
    const hasPrev = movementCremeRows.some((r) => r.week_start === prevWk);
    const batches = hasPrev ? getMovementLotsOfDay(6, prevWk).map((b) => ({ ...b })) : [];
    const siMon = numLocal(movementCellAt(wkStart, DAYS[0], 0).stock_initial);
    if (siMon > 0) {
      if (batches.length === 0) batches.push({ lot: "", remaining: siMon });
      else {
        const total = batches.reduce((s, b) => s + b.remaining, 0);
        if (total > siMon) {
          let excess = total - siMon;
            const ordered = [
              ...batches.filter((b) => !b.lot),
              ...batches.filter((b) => !!b.lot),
            ];
            for (const b of ordered) {
            if (excess <= 0) break;
            const take = Math.min(b.remaining, excess);
            b.remaining -= take;
            excess -= take;
          }
        } else if (total < siMon) {
          batches.push({ lot: "", remaining: siMon - total });
        }
      }
    }
    for (let d = 0; d <= dayIdx; d++) {
      for (const e of movementEntriesForAt(wkStart, DAYS[d])) {
        const q = numLocal(e.entree);
        if (q > 0) batches.push({ lot: (e.lot ?? "").toString(), remaining: q });
      }
      const sortie = getMovementSortie(d, wkStart);
      let need = typeof sortie === "number" ? sortie : 0;
        const ordered = [
          ...batches.filter((b) => !!b.lot),
          ...batches.filter((b) => !b.lot),
        ];
        for (const b of ordered) {
        if (need <= 0) break;
        if (b.remaining <= 0) continue;
        const take = Math.min(b.remaining, need);
        b.remaining -= take;
        need -= take;
      }
    }
    return batches.filter((b) => b.remaining > 0);
  };

  // Pour la fiche Suivi crème fraîche : attribue automatiquement à chaque
  // ligne (où une quantité est saisie) les lots disponibles côté mouvement
  // glaces, en consommant réellement les quantités en FIFO sur plusieurs jours.
  const cremeAutoLotMap = useMemo(() => {
    const map = new Map<string, string>();
    // Calcul uniquement pertinent pour la fiche Crème fraîche : on évite
    // ainsi de scanner toutes les semaines à chaque keystroke sur les
    // onglets glaces / tartes (qui n'utilisent pas cette carte).
    if (ficheType !== "Crème fraîche") return map;
    type Batch = { lot: string; remaining: number };
    type Allocation = { lot: string; quantity: number };
    const batches: Batch[] = [];

    const latestRealLot = (onlyWithStock: boolean) => {
      for (let i = batches.length - 1; i >= 0; i--) {
        const lot = batches[i].lot.trim();
        if (lot && (!onlyWithStock || batches[i].remaining > 0)) return lot;
      }
      return "";
    };

    const lotForUntrackedStock = () => latestRealLot(true) || latestRealLot(false);

    const addUntrackedStock = (quantity: number) => {
      const q = Math.max(0, quantity);
      if (q <= 0) return;
      const lot = lotForUntrackedStock();
      batches.push({ lot, remaining: q });
    };

    const formatQty = (value: number) =>
      Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");

    const formatAllocations = (allocations: Allocation[], missing: number) => {
      // Fusionner les portions "(sans lot)" dans le lot réel le plus ancien si présent.
      const filtered = allocations.filter((a) => a.quantity > 0);
      const firstReal = filtered.find((a) => a.lot.trim());
      const fallbackLot = firstReal?.lot || lotForUntrackedStock();
      const merged: Allocation[] = [];
      for (const a of filtered) {
        if (!a.lot.trim() && fallbackLot) {
          const tgt = merged.find((m) => m.lot === fallbackLot);
          if (tgt) tgt.quantity += a.quantity;
          else merged.push({ lot: fallbackLot, quantity: a.quantity });
        } else {
          const tgt = merged.find((m) => m.lot === a.lot);
          if (tgt) tgt.quantity += a.quantity;
          else merged.push({ ...a });
        }
      }
      const parts = merged.map((a) => `${a.lot.trim() || "(sans lot)"} ×${formatQty(a.quantity)}`);
      if (missing > 0) parts.push(`manque ×${formatQty(missing)}`);
      return parts.join(" / ");
    };

    const adjustToStockInitial = (target: number) => {
      if (target < 0) return;
      const current = batches.reduce((s, b) => s + Math.max(0, b.remaining), 0);
      if (current > target) {
        let excess = current - target;
        // Retirer d'abord les fillers "(sans lot)" puis FIFO sur les vrais lots
        const ordered = [
          ...batches.filter((b) => !b.lot),
          ...batches.filter((b) => !!b.lot),
        ];
        for (const b of ordered) {
          if (excess <= 0) break;
          if (b.remaining <= 0) continue;
          const take = Math.min(b.remaining, excess);
          b.remaining -= take;
          excess -= take;
        }
      } else if (current < target) {
        addUntrackedStock(target - current);
      }
    };

    const consumeFifo = (quantity: number) => {
      const allocations: Allocation[] = [];
      let need = Math.max(0, quantity);
      // Consommer d'abord les vrais lots (FIFO), puis les fillers "(sans lot)"
      const ordered = [
        ...batches.filter((b) => !!b.lot),
        ...batches.filter((b) => !b.lot),
      ];
      for (const b of ordered) {
        if (need <= 0) break;
        if (b.remaining <= 0) continue;
        const take = Math.min(b.remaining, need);
        allocations.push({ lot: b.lot, quantity: take });
        b.remaining -= take;
        need -= take;
      }
      return { allocations, missing: need };
    };

    const weeks = Array.from(
      new Set([
        weekStart,
        ...weeksToLoad,
        ...movementCremeRows.map((r) => r.week_start),
        ...rows.map((r) => r.week_start),
      ].filter(Boolean)),
    ).sort();

    for (const wk of weeks) {
      for (const day of DAYS) {
        const dIdx = DAYS.indexOf(day);
        const si = getMovementSI(dIdx, wk);
        if (si !== "") adjustToStockInitial(Number(si));

        for (const e of movementEntriesForAt(wk, day)) {
          const q = numLocal(e.entree);
          if (q > 0) {
            const lot = (e.lot ?? "").toString().trim();
            if (lot) batches.push({ lot, remaining: q });
            else addUntrackedStock(q);
          }
        }

        let cremeConsumed = 0;
        for (const rowIdx of [0, 1, 2, 3]) {
          const r = cellMap.get(`${wk}|${day}|${rowIdx}|`);
          const qty = numLocal(r?.quantity);
          if (qty <= 0) continue;
          const { allocations, missing } = consumeFifo(qty);
          const label = formatAllocations(allocations, missing);
          if (label) map.set(`${wk}|${day}|${rowIdx}`, label);
          cremeConsumed += qty;
        }

        const sortie = getMovementSortie(dIdx, wk);
        const sortieQty = typeof sortie === "number" ? Math.max(0, sortie) : 0;
        if (sortieQty > cremeConsumed) consumeFifo(sortieQty - cremeConsumed);
      }
    }
    return map;
  }, [cellMap, movementCremeRows, movementCremeCellMap, weekStart, weeksToLoad, rows, ficheType]);

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
        return { ...r, lot_number: auto, __dirty: true };
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
        next[idx] = { ...next[idx], ...patch, __dirty: true };
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
          __dirty: true,
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
    // Un produit nouvellement ajouté peut n'avoir aucun Stock Initial saisi alors
    // qu'il a déjà des entrées : on considère alors le SI comme 0 pour permettre
    // le calcul automatique des sorties.
    const siEff = (dIdx: number, wk: string): number | "" => {
      const si = getSI(dIdx, article, wk);
      if (si !== "") return si;
      const hasEntries = entriesForAt(wk, DAYS[dIdx], article).some((e) => num(e.entree) > 0);
      return hasEntries ? 0 : "";
    };
    if (dayIdx >= DAYS.length - 1) {
      // Dimanche : si la semaine suivante a un Stock Initial Lundi, en déduire la sortie implicite
      const nextWk = (() => { const d = parseISO(wkStart); d.setDate(d.getDate() + 7); return fmt(d); })();
      const siNextMon = getSI(0, article, nextWk);
      const siCur = siEff(6, wkStart);
      if (siNextMon !== "" && siCur !== "") {
        const eCur = entriesForAt(wkStart, DAYS[6], article).reduce((s, e) => s + num(e.entree), 0);
        return Number(siCur) + eCur - Number(siNextMon);
      }
      const v = cellAt(wkStart, DAYS[dayIdx], 0, article).sorties;
      return v === "" || v == null ? "" : Number(v);
    }
    const siNext = getSI(dayIdx + 1, article, wkStart);
    const siCur = siEff(dayIdx, wkStart);
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
        if (q > 0) {
          const lotStr = (e.lot ?? "").toString().trim();
          if (!lotStr) {
            // Sans lot : on ajoute la quantité au lot existant le plus ancien (FIFO)
            const target = batches.find((b) => b.remaining > 0) ?? batches[0];
            if (target) target.remaining += q;
            else batches.push({ lot: "", remaining: q });
          } else {
            batches.push({ lot: lotStr, remaining: q });
          }
        }
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
  ): { lot: string; remaining: number; entryDate: string }[] => {
    // Report : lots restants à la fin du dimanche de la semaine précédente
    const prevWk = (() => { const d = parseISO(wkStart); d.setDate(d.getDate() - 7); return fmt(d); })();
    const hasPrev = rows.some(
      (r) => r.week_start === prevWk && r.fiche_type === ficheType && r.article === article,
    );
    const out: { lot: string; remaining: number; entryDate: string }[] = hasPrev
      ? getLotsOfDay(6, article, prevWk).map((b) => ({ ...b }))
      : [];
    // SI du lundi : ajuste les lots reportés (FIFO) pour que le total
    // corresponde exactement au SI saisi — chaque lot conserve son numéro
    // et sa quantité, on ne fait que compléter ou réduire si besoin.
    const siMon = num(cellAt(wkStart, DAYS[0], 0, article).stock_initial);
    if (siMon > 0) {
      if (out.length === 0) {
        out.push({ lot: "", remaining: siMon, entryDate: wkStart });
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
          // Le complément vient de stock existant non tracé : on l'insère
          // EN TÊTE (plus ancien) pour respecter le tri FIFO à l'affichage.
          out.unshift({ lot: "", remaining: siMon - total, entryDate: "" });
        }
      }
    }
    // Entrées cumulées + déduction FIFO des sorties jour par jour
    for (let d = 0; d <= dayIdx; d++) {
      const dayDate = (() => { const dt = parseISO(wkStart); dt.setDate(dt.getDate() + d); return fmt(dt); })();
      for (const e of entriesForAt(wkStart, DAYS[d], article)) {
        const q = num(e.entree);
        if (q > 0) {
          const lotStr = (e.lot ?? "").toString().trim();
          if (!lotStr) {
            // Sans lot : on cumule la quantité dans le lot existant le plus ancien
            const target = out.find((b) => b.remaining > 0) ?? out[0];
            if (target) target.remaining += q;
            else out.push({ lot: "", remaining: q, entryDate: dayDate });
          } else {
            out.push({ lot: lotStr, remaining: q, entryDate: dayDate });
          }
        }
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

  // PRECALCUL FIFO : évite la récursion O(N_weeks²) par cellule à chaque
  // re-render. On construit en une seule passe (mémoïsée sur `rows`) la
  // carte des lots restants en fin de journée pour chaque (semaine, jour,
  // article). Toutes les cellules de l'onglet glaces/tartes lisent cette
  // carte en O(1), ce qui rend la saisie instantanée même sur des mois
  // de données accumulées.
  const lotsOfDayMap = useMemo(() => {
    type Batch = { lot: string; remaining: number; entryDate: string };
    const map = new Map<string, Batch[]>();

    // Regroupement par article -> semaine -> jour
    const byArticle = new Map<string, Map<string, Map<string, Row[]>>>();
    for (const r of rows) {
      if (r.fiche_type !== ficheType) continue;
      if (!r.article || !r.week_start || !r.day_of_week) continue;
      let weekMap = byArticle.get(r.article);
      if (!weekMap) { weekMap = new Map(); byArticle.set(r.article, weekMap); }
      let dayMap = weekMap.get(r.week_start);
      if (!dayMap) { dayMap = new Map(); weekMap.set(r.week_start, dayMap); }
      let dayRows = dayMap.get(r.day_of_week);
      if (!dayRows) { dayRows = []; dayMap.set(r.day_of_week, dayRows); }
      dayRows.push(r);
    }

    const numL = (v: any) => {
      if (v === "" || v == null) return 0;
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };

    for (const [article, weekMap] of byArticle) {
      const weeks = Array.from(weekMap.keys()).sort();
      let carry: Batch[] = [];
      for (const wk of weeks) {
        const dayMap = weekMap.get(wk)!;

        const siOf = (dIdx: number, w: string): number | "" => {
          const dm = w === wk ? dayMap : weekMap.get(w);
          if (!dm) return "";
          const dr = dm.get(DAYS[dIdx]);
          if (!dr) return "";
          const root = dr.find((r) => (r.row_index ?? 0) === 0);
          const v = root?.stock_initial;
          return v === "" || v == null ? "" : Number(v);
        };

        let batches: Batch[] = carry.map((b) => ({ ...b }));

        for (let d = 0; d < DAYS.length; d++) {
          const day = DAYS[d];
          const dayRows = dayMap.get(day) ?? [];
          const root = dayRows.find((r) => (r.row_index ?? 0) === 0);

          if (d === 0) {
            const siMon = numL(root?.stock_initial);
            if (siMon > 0) {
              if (batches.length === 0) {
                batches.push({ lot: "", remaining: siMon, entryDate: wk });
              } else {
                const total = batches.reduce((s, b) => s + b.remaining, 0);
                if (total > siMon) {
                  let excess = total - siMon;
                  for (const b of batches) {
                    if (excess <= 0) break;
                    const take = Math.min(b.remaining, excess);
                    b.remaining -= take;
                    excess -= take;
                  }
                } else if (total < siMon) {
                  batches.unshift({ lot: "", remaining: siMon - total, entryDate: "" });
                }
              }
            }
          }

          const dayDate = (() => {
            const dt = parseISO(wk);
            dt.setDate(dt.getDate() + d);
            return fmt(dt);
          })();

          const entries = dayRows
            .filter((r) => r.entrees != null || r.lot_number)
            .sort((a, b) => (a.row_index ?? 0) - (b.row_index ?? 0));

          let entriesSum = 0;
          for (const e of entries) {
            const q = numL(e.entrees);
            if (q > 0) {
              entriesSum += q;
              const lotStr = (e.lot_number ?? "").toString().trim();
              if (!lotStr) {
                const target = batches.find((b) => b.remaining > 0) ?? batches[0];
                if (target) target.remaining += q;
                else batches.push({ lot: "", remaining: q, entryDate: dayDate });
              } else {
                batches.push({ lot: lotStr, remaining: q, entryDate: dayDate });
              }
            }
          }

          // Sortie : explicite, sinon auto = SI(j) + entrées - SI(j+1)
          let sortie = numL(root?.sorties);
          if (!sortie) {
            const siCur = siOf(d, wk);
            let siNext: number | "" = "";
            if (d < DAYS.length - 1) {
              siNext = siOf(d + 1, wk);
            } else {
              const nextWk = (() => {
                const dt = parseISO(wk);
                dt.setDate(dt.getDate() + 7);
                return fmt(dt);
              })();
              const dmNext = weekMap.get(nextWk);
              if (dmNext) {
                const drNext = dmNext.get(DAYS[0]);
                const rootNext = drNext?.find((r) => (r.row_index ?? 0) === 0);
                const v = rootNext?.stock_initial;
                siNext = v === "" || v == null ? "" : Number(v);
              }
            }
            if (siCur !== "" && siNext !== "") {
              const auto = Number(siCur) + entriesSum - Number(siNext);
              if (typeof auto === "number" && !isNaN(auto)) sortie = auto;
            }
          }

          let need = sortie;
          for (const b of batches) {
            if (need <= 0) break;
            if (b.remaining <= 0) continue;
            const take = Math.min(b.remaining, need);
            b.remaining -= take;
            need -= take;
          }

          map.set(
            `${wk}|${d}|${article}`,
            batches.filter((b) => b.remaining > 0).map((b) => ({ ...b })),
          );
        }
        carry = batches.filter((b) => b.remaining > 0);
      }
    }
    return map;
  }, [rows, ficheType]);

  const addEntryRow = (day: string, article: string) => {
    const existing = entriesFor(day, article);
    const nextIdx = existing.length > 0 ? Math.max(...existing.map((e) => e.rowIndex)) + 1 : 1;
    updateCell(day, nextIdx, article, { entrees: "", lot_number: "" });
  };

  const removeEntryRow = (day: string, rowIndex: number, article: string, wkStart: string = weekStart) => {
    const key = `${wkStart}|${day}|${rowIndex}|${article}`;
    setRows((prev) =>
      prev.flatMap((r) => {
        if (`${r.week_start}|${r.day_of_week}|${r.row_index}|${r.article ?? ""}` !== key) return [r];
        return r.id ? [{ ...r, entrees: null, lot_number: null, __dirty: true }] : [];
      }),
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
      const normalizedRows = normalizeWeeklyRows(rows);
      const rowsToPersist = normalizedRows.filter((r) => (r.__dirty || !r.id) && (hasWeeklyValue(r) || r.id));
      if (rowsToPersist.length > 0) {
        const payload = rowsToPersist.map((r) => ({
          id: r.id,
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
        const toMutation = (item: (typeof payload)[number]) => ({
          fiche_type: item.fiche_type,
          week_start: item.week_start,
          day_of_week: item.day_of_week,
          row_index: item.row_index,
          article: item.article,
          lot_number: item.lot_number,
          couleur: item.couleur,
          odeur: item.odeur,
          texture: item.texture,
          stock_initial: item.stock_initial,
          entrees: item.entrees,
          sorties: item.sorties,
          quantity: item.quantity,
          visa_operateur: item.visa_operateur,
          visa_manager: item.visa_manager,
        });
        const updates = payload.filter((item) => item.id);
        const inserts = payload.filter((item) => !item.id).map(toMutation);

        await runInBatches(updates, async (item) => {
          const updateItem = toMutation(item);
          const { error } = await supabase.from("weekly_tracking").update(updateItem as never).eq("id", item.id);
          if (error) throw error;

          const idx = normalizedRows.findIndex((row) => row.id === item.id);
          if (idx >= 0) normalizedRows[idx] = { ...normalizedRows[idx], ...updateItem, __dirty: false };
        });

        if (inserts.length > 0) {
          const { data, error } = await supabase
            .from("weekly_tracking")
            .insert(inserts as never)
            .select();
          if (error) throw error;
          const saved = normalizeWeeklyRows(data || []);
          saved.forEach((savedRow) => {
            const idx = normalizedRows.findIndex((row) => rowKey(row) === rowKey(savedRow));
            if (idx >= 0) normalizedRows[idx] = { ...savedRow, __dirty: false };
          });
        }
      }
      setRows(normalizeWeeklyRows(normalizedRows));
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

  const dash = (value: any) => (value === "" || value == null ? "—" : String(value));
  const fmtNum = (value: any) => {
    if (value === "" || value == null) return value;
    const n = Number(value);
    if (!isFinite(n)) return value;
    return Math.round(n * 100) / 100;
  };
  const conformityText = (value: any) => (value === "C" ? "C" : "—");
  const formatLots = (batches: { lot: string; remaining: number }[]) => {
    const merged = new Map<string, number>();
    batches.forEach((b) => {
      if (b.remaining <= 0) return;
      const lot = b.lot?.trim() ? b.lot.trim() : "(sans lot)";
      merged.set(lot, (merged.get(lot) ?? 0) + b.remaining);
    });
    return Array.from(merged.entries()).map(([lot, qty]) => `${lot} ×${qty}`).join(" / ") || "—";
  };

  const buildWeeklyPdf = (label: string) => {
    const periodText = filterFrom || filterTo
      ? `Période du ${filterFrom ? formatDateFR(filterFrom) : formatDateFR(weekStart)} au ${filterTo ? formatDateFR(filterTo) : addDays(weekStart, 6)}`
      : `Semaine du ${formatDateFR(weekStart)} au ${addDays(weekStart, 6)}`;
    const title = `Suivi hebdomadaire — ${tab === "creme" ? "Crème fraîche" : tab === "glace" ? "Mouvement glaces" : "Mouvement tartes"}`;
    const sections: PdfTableSection[] = [];

    if (tab === "creme") {
      sections.push({
        title: "Fiche crème fraîche",
        columns: [
          { header: "Jour", dataKey: "jour", width: 18, halign: "center" },
          { header: "Date", dataKey: "date", width: 17, halign: "center" },
          { header: "Shift", dataKey: "shift", width: 15, halign: "center" },
          { header: "Ligne", dataKey: "ligne", width: 12, halign: "center" },
          { header: "Quantité", dataKey: "quantite", width: 18, halign: "center" },
          { header: "N° lot crème fraîche", dataKey: "lot", width: 62, tone: "lot" },
          { header: "Couleur", dataKey: "couleur", width: 18, halign: "center" },
          { header: "Odeur", dataKey: "odeur", width: 18, halign: "center" },
          { header: "Texture", dataKey: "texture", width: 18, halign: "center" },
          { header: "Visa opérateur", dataKey: "operateur", width: 34 },
          { header: "Visa manager", dataKey: "manager", width: 34 },
        ],
        rows: DAYS.flatMap((day, dIdx) => [0, 1, 2, 3].map((rowIdx) => {
          const c = cell(day, rowIdx, null);
          const qty = numLocal(c.quantity);
          return {
            jour: day,
            date: dayShort(weekStart, dIdx),
            shift: rowIdx < 2 ? "Matin" : "Soir",
            ligne: rowIdx < 2 ? rowIdx + 1 : rowIdx - 1,
            quantite: dash(c.quantity),
            lot: qty > 0 ? dash(cremeAutoLotMap.get(`${weekStart}|${day}|${rowIdx}`) ?? c.lot_number) : dash(c.lot_number),
            couleur: conformityText(c.couleur),
            odeur: conformityText(c.odeur),
            texture: conformityText(c.texture),
            operateur: dash(c.visa_operateur),
            manager: dash(c.visa_manager),
          };
        })),
      });
    } else {
      sections.push({
        title: `Tableau restructuré pour impression — ${tab === "glace" ? "glaces" : "tartes"}`,
        columns: [
          { header: "Article", dataKey: "article", width: 48 },
          { header: "Jour", dataKey: "jour", width: 18, halign: "center" },
          { header: "Date", dataKey: "date", width: 17, halign: "center" },
          { header: "Stock initial", dataKey: "si", width: 22, halign: "center" },
          { header: "Entrées", dataKey: "entrees", width: 24, halign: "center", tone: "entry" },
          { header: "Lots d'entrée", dataKey: "lotsEntree", width: 56, tone: "lot" },
          { header: "Sorties", dataKey: "sorties", width: 22, halign: "center", tone: "exit" },
          { header: "Lot existant FIFO", dataKey: "lotsRestants", width: 68, tone: "lot" },
        ],
        rows: filteredArticles.flatMap(({ article }) => visibleDays.map(({ day, dIdx, wkStart }) => {
          const c = cellAt(wkStart, day, 0, article);
          const entries = entriesForAt(wkStart, day, article);
          const entreeText = entries.filter((e) => num(e.entree) > 0).map((e) => dash(e.entree)).join(" / ") || "—";
          const lotsEntree = entries.filter((e) => num(e.entree) > 0 || e.lot).map((e) => `${dash(e.lot)}${num(e.entree) > 0 ? ` ×${dash(e.entree)}` : ""}`).join(" / ") || "—";
          return {
            article,
            jour: day,
            date: dayShort(wkStart, dIdx),
            si: dash(c.stock_initial),
            entrees: entreeText,
            lotsEntree,
            sorties: dash(fmtNum(getSortie(dIdx, article, wkStart))),
            lotsRestants: formatLots(getLotsOfDay(dIdx, article, wkStart)),
          };
        })),
      });
    }

    return {
      filename: `fiche-${label}-${weekStart}.pdf`,
      title,
      subtitle: periodText,
      meta: [
        `Généré le ${formatDateFR(new Date().toISOString())}`,
        filterArticle !== "all" ? `Produit : ${filterArticle}` : "Tous les produits",
        filterType === "masquer_lots" ? "Lots masqués à l'écran — PDF complet" : "Entrées vertes / sorties rouges",
      ],
      sections,
    };
  };

  const handleScanResults = async (scanned: ScannedEntry[]) => {
    const today = new Date();
    const monday = getMonday(today);
    const targetWeek = fmt(monday);
    const dayDiff = Math.floor(
      (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
        monday.getTime()) /
        86400000,
    );
    const dayName =
      scanDay === "today"
        ? DAYS[Math.max(0, Math.min(6, dayDiff))]
        : (scanDay as typeof DAYS[number]);
    const useCurrentWeek = scanDay === "today";
    const finalWeek = useCurrentWeek ? targetWeek : weekStart;

    // Query DB for actual max row_index per (article, day) to avoid duplicate-key
    // collisions with rows not present in local state.
    const uniqueArticles = Array.from(new Set(scanned.map((e) => e.article)));
    const { data: existingRows, error: existingErr } = await supabase
      .from("weekly_tracking")
      .select("article, row_index")
      .eq("fiche_type", ficheType)
      .eq("week_start", finalWeek)
      .eq("day_of_week", dayName)
      .in("article", uniqueArticles);
    if (existingErr) {
      console.error("scan lookup error", existingErr);
      toast.error("Erreur lors de la vérification des lignes existantes");
      throw existingErr;
    }
    const maxByArticle = new Map<string, number>();
    (existingRows || []).forEach((r: any) => {
      const cur = maxByArticle.get(r.article) ?? 0;
      if ((r.row_index ?? 0) > cur) maxByArticle.set(r.article, r.row_index ?? 0);
    });

    const indexTracker = new Map<string, number>();
    const inserts = scanned.map((e) => {
      const key = `${e.article}`;
      const baseIdx = maxByArticle.get(e.article) ?? 0;
      const offset = indexTracker.get(key) ?? 0;
      indexTracker.set(key, offset + 1);
      return {
        fiche_type: ficheType,
        week_start: finalWeek,
        day_of_week: dayName,
        row_index: baseIdx + offset + 1,
        article: e.article,
        lot_number: e.lotNumber || null,
        entrees: typeof e.quantity === "number" ? e.quantity : null,
      };
    });

    try {
      const { data, error } = await supabase
        .from("weekly_tracking")
        .insert(inserts as never)
        .select();
      if (error) throw error;
      const saved = normalizeWeeklyRows(data || []);
      if (useCurrentWeek && targetWeek !== weekStart) {
        setWeekStart(targetWeek);
      } else {
        setRows((prev) => [...prev, ...saved]);
      }
      toast.success(`${saved.length} entrée(s) enregistrée(s)`);
    } catch (e: any) {
      console.error("scan save error", e);
      toast.error(e?.message || "Erreur lors de l'enregistrement du scan");
      throw e;
    }
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
              Semaine du {formatDateFR(weekStart)} → {addDays(weekStart, 6)}
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
            Semaine du {formatDateFR(weekStart)} → {addDays(weekStart, 6)}
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
        {tab !== "materiel" && (
        <div className={cn("flex items-center gap-2 no-print", showControls ? "" : "ml-auto")}>
          <Button onClick={handlePrintFiche} size="sm" variant="outline" className="shadow-sm">
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
          <Button onClick={handleDownloadFiche} size="sm" variant="outline" className="shadow-sm">
            <FileDown className="h-4 w-4 mr-2" />
            Télécharger PDF
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm" className="shadow-sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="bg-muted/60 p-1.5 gap-1.5 rounded-xl">
          <TabsTrigger
            value="creme"
            className="rounded-lg px-5 py-2 text-sm font-semibold data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-amber-700 data-[state=inactive]:hover:bg-amber-100 transition-all"
          >
            Crème fraîche
          </TabsTrigger>
          <TabsTrigger
            value="glace"
            className="rounded-lg px-5 py-2 text-sm font-semibold data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-sky-700 data-[state=inactive]:hover:bg-sky-100 transition-all"
          >
            Mouvement glaces
          </TabsTrigger>
          <TabsTrigger
            value="tarte"
            className="rounded-lg px-5 py-2 text-sm font-semibold data-[state=active]:bg-rose-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-rose-700 data-[state=inactive]:hover:bg-rose-100 transition-all"
          >
            Mouvement tartes
          </TabsTrigger>
          <TabsTrigger
            value="materiel"
            className="rounded-lg px-5 py-2 text-sm font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-emerald-700 data-[state=inactive]:hover:bg-emerald-100 transition-all"
          >
            Suivi matériel
          </TabsTrigger>
        </TabsList>
        <div ref={ficheRef} className="bg-background p-2 rounded-md">
          <div className="hidden print:block mb-2 px-2">
            <h2 className="text-base font-semibold">
              Suivi hebdomadaire — {tab === "creme" ? "Crème fraîche" : tab === "glace" ? "Mouvement glaces" : "Mouvement tartes"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Semaine du {formatDateFR(weekStart)} → {addDays(weekStart, 6)}
            </p>
          </div>

        <TabsContent value="creme" className="mt-4 min-w-0">
          <div className="bg-card rounded-lg border overflow-auto max-h-[70vh] max-w-full">
            <table className="weekly-sticky-table text-sm" style={{ borderCollapse: "separate", borderSpacing: 0, width: "max-content", minWidth: "100%", overflow: "visible" }}>
              <thead className="bg-muted sticky top-0 z-30">
                <tr>
                  <th className="p-2 text-left weekly-sticky-column weekly-sticky-head bg-muted border-r w-[80px]" style={{ position: "sticky", left: 0, zIndex: 45 }}>Jour</th>
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
                    const iso = dayIso(weekStart, dIdx);
                    const editable = isDayEditable(iso);
                    return (
                      <tr
                        key={`${day}-${rowIdx}`}
                        className={cn(
                          "border-t",
                          rowIdx === 2 && "border-t-2 border-t-primary/30",
                        )}
                      >
                        {isFirstOfDay && (
                          <td rowSpan={4} className="p-2 font-medium border-r align-middle weekly-sticky-column bg-card w-[80px]" style={{ position: "sticky", left: 0, zIndex: 25 }}>
                            <div>{day}</div>
                            <div className="text-[10px] font-normal text-muted-foreground">
                              {dayShort(weekStart, dIdx)}
                            </div>
                            {!editable && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (can("edit_weekly")) {
                                    setUnlockedDays((s) => { const n = new Set(s); n.add(iso); return n; });
                                  } else {
                                    toast.error("Opération non autorisée");
                                  }
                                }}
                                className="mt-1 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                                title="Jour verrouillé — déverrouiller"
                              >
                                <Lock className="h-3 w-3" /> Déverrouiller
                              </button>
                            )}
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
                            disabled={!editable}
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
                                disabled={!hasQty || !editable}
                              />
                            );
                          })()}
                        </td>
                        <td className="p-1">
                          <ConformityToggle
                            value={c.couleur}
                            onChange={(v) => updateCell(day, rowIdx, null, { couleur: v })}
                            disabled={!editable}
                          />
                        </td>
                        <td className="p-1">
                          <ConformityToggle
                            value={c.odeur}
                            onChange={(v) => updateCell(day, rowIdx, null, { odeur: v })}
                            disabled={!editable}
                          />
                        </td>
                        <td className="p-1">
                          <ConformityToggle
                            value={c.texture}
                            onChange={(v) => updateCell(day, rowIdx, null, { texture: v })}
                            disabled={!editable}
                          />
                        </td>
                        <td className="p-1 align-middle">
                          <Select
                            value={c.visa_operateur ?? ""}
                            onValueChange={(v) => updateCell(day, rowIdx, null, { visa_operateur: v })}
                            disabled={!editable}
                          >
                            <SelectTrigger className="h-8 min-w-[140px]"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {operatorOptions.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {isFirstOfShift && (
                          <td rowSpan={2} className="p-1 align-middle border-l">
                            <Select
                              value={cell(day, rowIdx, null).visa_manager ?? ""}
                              onValueChange={(v) => updateCell(day, rowIdx, null, { visa_manager: v })}
                              disabled={!editable}
                            >
                              <SelectTrigger className="h-8 min-w-[140px]"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                {managerOptions.map((m) => (
                                  <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <WeeklyTransfers ficheKey="Crème fraîche" weekStart={weekStart} articles={["Crème fraîche (mousse fouettée)"]} />
        </TabsContent>

        {(["glace", "tarte"] as const).map((t) => (
        <TabsContent key={t} value={t} className="mt-4 space-y-3 min-w-0">
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
            <div className="ml-auto flex items-center gap-2">
              <Select value={scanDay} onValueChange={setScanDay}>
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue placeholder="Jour" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Aujourd'hui</SelectItem>
                  {DAYS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <PhotoScanEntry
                articles={t === "glace" ? GLACE_ARTICLES : TARTE_ARTICLES}
                onConfirm={handleScanResults}
                buttonLabel="📷 Scanner entrée"
              />
            </div>
          </div>
          )}

          <div className="bg-card rounded-lg border overflow-auto max-h-[70vh] max-w-full">
            <table className="weekly-sticky-table text-xs" style={{ borderCollapse: "separate", borderSpacing: 0, width: "max-content", minWidth: "100%", overflow: "visible" }}>
              <thead className="bg-muted sticky top-0 z-30">
                <tr>
                  <th className="p-1 text-left weekly-sticky-column weekly-sticky-head bg-muted border-r w-[140px] min-w-[140px] text-[11px]" style={{ position: "sticky", left: 0, zIndex: 45 }}>Article</th>
                  {SHOW_KG_BAC && t === "glace" && (
                    <th
                      className="p-1 text-center weekly-sticky-column weekly-sticky-head bg-muted border-r w-[110px] min-w-[110px] text-[11px]"
                      style={{ position: "sticky", left: 140, zIndex: 45 }}
                      title="Poids par bac (Kg) — saisie manuelle par parfum"
                    >
                      Kg/bac
                    </th>
                  )}
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
                      {!isDayEditable(iso) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (can("edit_weekly")) {
                              setUnlockedDays((s) => { const n = new Set(s); n.add(iso); return n; });
                            } else {
                              toast.error("Opération non autorisée");
                            }
                          }}
                          className="mt-1 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                          title="Jour verrouillé — déverrouiller"
                        >
                          <Lock className="h-3 w-3" /> Déverrouiller
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="p-1 weekly-sticky-column weekly-sticky-head bg-muted border-r w-[140px] min-w-[140px]" style={{ position: "sticky", left: 0, zIndex: 45 }}></th>
                  {SHOW_KG_BAC && t === "glace" && (
                    <th
                      className="p-1 weekly-sticky-column weekly-sticky-head bg-muted border-r w-[110px] min-w-[110px]"
                      style={{ position: "sticky", left: 140, zIndex: 45 }}
                    ></th>
                  )}
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
                        "p-1 font-medium weekly-sticky-column border-r whitespace-nowrap border-b-2 border-b-primary/10 max-w-[140px] w-[140px] min-w-[140px] truncate text-[11px]",
                        rowI % 2 === 1 ? "bg-muted" : "bg-card",
                      )}
                      style={{ position: "sticky", left: 0, zIndex: 25 }}
                    >
                      {article}
                    </td>
                    {SHOW_KG_BAC && t === "glace" && (
                      <td
                        className={cn(
                          "p-1 weekly-sticky-column border-r text-center",
                          rowI % 2 === 1 ? "bg-muted" : "bg-card",
                        )}
                        style={{ position: "sticky", left: 140, zIndex: 25 }}
                      >
                        {article === CREME_ARTICLE ? (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        ) : (
                          <CommittedInput
                            type="number"
                            inputMode="decimal"
                            step="0.001"
                            value={glaceGrammages[article] ? (glaceGrammages[article] / 1000).toString() : ""}
                            onCommit={(v) => saveGrammage(article, v)}
                            className="h-7 w-20 text-xs px-1 text-center"
                            placeholder="Kg"
                            disabled={!can("edit_weekly")}
                          />
                        )}
                      </td>
                    )}
                    {visibleDays.map(({ day, dIdx, wkStart }) => {
                      const c = cellAt(wkStart, day, 0, article);
                      const entries = entriesForAt(wkStart, day, article);
                      const entryRows = entries.length > 0 ? entries : [{ rowIndex: 0, entree: "", lot: "" }];
                      const sortieAuto = getSortie(dIdx, article, wkStart);
                      const totalE = entries.reduce((s, e) => s + num(e.entree), 0);
                      const matchType = cellMatchesTypeFilter(dIdx, article, wkStart);
                      const dim = filterType !== "all" && filterType !== "masquer_lots" && !matchType;
                      const editable = isDayEditable(dayIso(wkStart, dIdx));
                      return (
                        <Fragment key={`${wkStart}-${day}`}>
                          {/* SI */}
                          <td className={cn("p-0.5 border-l-2 border-l-border align-top", dim && "opacity-30")}>
                            <CommittedInput
                              type="number"
                              inputMode="numeric"
                              data-si={`${dIdx}-${aIdx}`}
                              value={c.stock_initial ?? ""}
                              onCommit={(v) =>
                                updateCellAt(wkStart, day, 0, article, { stock_initial: v })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  focusNextSI(aIdx);
                                }
                              }}
                              className="h-7 w-14 text-xs px-1"
                              disabled={!editable}
                            />
                          </td>
                          {/* Entries (multi-row) — VERT */}
                          <td className={cn("p-0.5 align-top", dim && "opacity-30")}>
                            <div className="flex flex-col gap-0.5">
                              {entryRows.map((er, i) => (
                                <CommittedInput
                                  key={`e-${er.rowIndex}-${i}`}
                                  type="number"
                                  inputMode="numeric"
                                  value={er.entree ?? ""}
                                  onCommit={(v) =>
                                    updateCellAt(wkStart, day, er.rowIndex, article, { entrees: v })
                                  }
                                  className="h-7 w-14 text-xs px-1 bg-success/10 text-success border-success/40 font-medium"
                                  disabled={!editable}
                                />
                              ))}
                              <button
                                type="button"
                                onClick={() => {
                                  const existing = entriesForAt(wkStart, day, article);
                                  const nextIdx = existing.length > 0 ? Math.max(...existing.map((e) => e.rowIndex)) + 1 : 1;
                                  updateCellAt(wkStart, day, nextIdx, article, { entrees: "", lot_number: "" });
                                }}
                                className="h-5 w-14 rounded border border-dashed text-[10px] text-muted-foreground hover:bg-muted flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Ajouter une 2e entrée (lot différent)"
                                disabled={!editable}
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
                                    <CommittedInput
                                      value={er.lot ?? ""}
                                      onCommit={(v) =>
                                        updateCellAt(wkStart, day, er.rowIndex, article, { lot_number: v })
                                      }
                                      placeholder="lot"
                                      className="h-7 w-20 text-xs px-1"
                                      disabled={!editable}
                                    />
                                    {er.rowIndex > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => removeEntryRow(day, er.rowIndex, article, wkStart)}
                                        className="text-destructive hover:bg-destructive/10 rounded p-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Supprimer cette entrée"
                                        disabled={!editable}
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
                              {sortieAuto === "" || sortieAuto == null ? "—" : fmtNum(sortieAuto)}
                            </div>
                          </td>
                          {/* Lot existant (FIFO restant par lot) */}
                          {filterType !== "masquer_lots" && (
                            <td className={cn("p-0.5 align-top", dim && "opacity-30")}>
                              <LotExistantCell
                                dayIdx={dIdx}
                                article={article}
                                getBalances={(d, a) => lotsOfDayMap.get(`${wkStart}|${d}|${a}`) ?? []}
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
          <WeeklyTransfers
            ficheKey={t === "glace" ? "Mouvement glaces" : "Mouvement tartes"}
            weekStart={weekStart}
            articles={t === "glace" ? GLACE_ARTICLES : TARTE_ARTICLES}
          />
        </TabsContent>
        ))}
        <TabsContent value="materiel" className="mt-4 min-w-0">
          <MaterielTracking weekStart={weekStart} />
          <WeeklyTransfers ficheKey="Suivi matériel" weekStart={weekStart} />
        </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
