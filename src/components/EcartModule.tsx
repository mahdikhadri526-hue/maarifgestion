import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Boxes, Loader2, Package, Save, Scale, ShoppingCart } from "lucide-react";
import { formatDateFR } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  GRAM_SECTIONS,
  SECTION_ITEMS,
  computeDay,
  eachDate,
  fetchEcartLines,
  fmtG,
  hasFinalStock,
  initialFromFinal,
  lastFinalBefore,
  monthRange,
  saveEcartDay,
  shiftDate,
  type DayData,
  type Section,
} from "@/lib/ecartRatio";

type View = "ventes" | "entrees" | "final" | "initial" | "ecarts";
type Mode = "jour" | "mois" | "periode";

const today = () => new Date().toISOString().slice(0, 10);
const VIEW_SECTIONS: Record<Exclude<View, "ecarts">, Section[]> = {
  ventes: ["VENTE_EMP", "VENTE_SP"],
  entrees: ["ENTREE_EMP"],
  final: ["SF_EMP", "SF_CHAMBRE_EMP", "SF_SP"],
  initial: ["SI_EMP", "SI_CHAMBRE_EMP", "SI_SP"],
};

export function EcartModule() {
  const { can, isAdmin, isRegionalAdmin } = useAuth();
  const canEdit = can("edit_ecarts") || isAdmin || isRegionalAdmin;

  const [view, setView] = useState<View>("ecarts");
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState<Mode>("jour");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());

  const [day, setDay] = useState<DayData>({});
  const [prev, setPrev] = useState<DayData | undefined>(undefined);
  const [history, setHistory] = useState<Map<string, DayData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => {
    if (view !== "ecarts") return { start: date, end: date };
    if (mode === "jour") return { start: date, end: date };
    if (mode === "mois") return monthRange(month);
    return { start, end };
  }, [view, mode, date, month, start, end]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const days = await fetchEcartLines(shiftDate(range.start, -60), range.end);
      setHistory(days);
      setDay(days.get(date) ?? {});
      setPrev(lastFinalBefore(days, date));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const setCell = (section: Section, item: string, value: string) => {
    setDay((d) => ({
      ...d,
      [section]: { ...(d[section] ?? {}), [item]: value === "" ? 0 : Number(value.replace(",", ".")) },
    }));
  };

  const save = async () => {
    if (view === "ecarts") return;
    setSaving(true);
    try {
      await saveEcartDay(date, day, VIEW_SECTIONS[view]);
      toast.success("Saisie enregistrée");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const result = computeDay(date, day, prev);
  const needsSeed = !hasFinalStock(prev);
  const carried = initialFromFinal(prev);

  const dates = eachDate(range.start, range.end);
  const rows = dates.map((d) => computeDay(d, history.get(d) ?? {}, lastFinalBefore(history, d)));
  const shown = rows.filter(
    (r) => r.ventesTotalG !== 0 || r.consoTotalG !== 0 || r.sfEmpG !== 0 || r.sfSpG !== 0,
  );
  const sum = shown.reduce(
    (a, r) => ({
      consoTotalG: a.consoTotalG + r.consoTotalG,
      ventesEmpG: a.ventesEmpG + r.ventesEmpG,
      ventesSpG: a.ventesSpG + r.ventesSpG,
      ventesTotalG: a.ventesTotalG + r.ventesTotalG,
      ecartTotalG: a.ecartTotalG + r.ecartTotalG,
    }),
    { consoTotalG: 0, ventesEmpG: 0, ventesSpG: 0, ventesTotalG: 0, ecartTotalG: 0 },
  );

  const sectionTable = ({
    section,
    title,
    subtitle,
    override,
  }: {
    section: Section;
    title: string;
    subtitle: string;
    override?: Record<string, number>;
  }) => {
    const items = SECTION_ITEMS[section];
    const gramInput = GRAM_SECTIONS.includes(section);
    const locked = !!override;
    const map = override ?? day[section] ?? {};
    const total = items.reduce((a, it) => {
      const q = Number(map[it.name] ?? 0);
      return a + (gramInput ? q : q * it.gram);
    }, 0);
    return (
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/50">
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-2 py-1.5 text-left">Article</th>
                {!gramInput && <th className="px-2 py-1.5 text-right">Grammage (g)</th>}
                <th className="px-2 py-1.5 text-right">{gramInput ? "Grammes" : "Quantité"}</th>
                {!gramInput && <th className="px-2 py-1.5 text-right">Total (g)</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const q = Number(map[it.name] ?? 0);
                return (
                  <tr key={it.name} className="border-t">
                    <td className="px-2 py-1 whitespace-nowrap font-medium">{it.name}</td>
                    {!gramInput && (
                      <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{fmtG(it.gram)}</td>
                    )}
                    <td className="px-1 py-1 text-right">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={q === 0 ? "" : q}
                        disabled={!canEdit || locked}
                        onChange={(e) => setCell(section, it.name, e.target.value)}
                        className="w-24 border rounded px-1.5 py-1 text-right bg-background"
                      />
                    </td>
                    {!gramInput && (
                      <td className="px-2 py-1 text-right tabular-nums">{fmtG(q * it.gram)}</td>
                    )}
                  </tr>
                );
              })}
              <tr className="border-t bg-muted/40 font-semibold">
                <td className="px-2 py-2" colSpan={gramInput ? 1 : 3}>
                  TOTAL (G)
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtG(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const Stat = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${strong ? "font-bold" : "font-medium"} ${strong && value < 0 ? "text-destructive" : ""}`}
      >
        {fmtG(value)} g
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-xl p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" /> Calcul des écarts
        </h2>

        <div className="flex flex-wrap gap-2">
          {([
            ["initial", "Stock initial", Boxes],
            ["entrees", "Entrées", Package],
            ["ventes", "Ventes", ShoppingCart],
            ["final", "Stock final", Boxes],
            ["ecarts", "Écarts", Scale],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                view === id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          {view === "ecarts" && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Période</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                className="border rounded-lg px-2 py-1.5 text-sm bg-background"
              >
                <option value="jour">Jour</option>
                <option value="mois">Mois</option>
                <option value="periode">Période</option>
              </select>
            </div>
          )}
          {(view !== "ecarts" || mode === "jour") && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-sm bg-background"
              />
            </div>
          )}
          {view === "ecarts" && mode === "mois" && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Mois</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-sm bg-background"
              />
            </div>
          )}
          {view === "ecarts" && mode === "periode" && (
            <>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Du</label>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-background" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Au</label>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-background" />
              </div>
            </>
          )}
          {view !== "ecarts" && canEdit && (
            <button
              onClick={save}
              disabled={saving || loading}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
      ) : view === "ventes" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {sectionTable({ section: "VENTE_EMP", title: "Ventes Emporter", subtitle: "Saisir les quantités vendues — les grammes sont calculés automatiquement." })}
          {sectionTable({ section: "VENTE_SP", title: "Ventes Salle / Surplace", subtitle: "Saisir les quantités vendues — les grammes sont calculés automatiquement." })}
        </div>
      ) : view === "entrees" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {sectionTable({ section: "ENTREE_EMP", title: "Entrées Emporter (stuffs)", subtitle: "Saisir le nombre de stuffs par parfum — grammage déjà enregistré." })}
        </div>
      ) : view === "final" ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {sectionTable({ section: "SF_EMP", title: "Stock final Emporter", subtitle: "Total en grammes (frigo + transit)." })}
            {sectionTable({ section: "SF_CHAMBRE_EMP", title: "Stock final Chambre", subtitle: "Total en grammes." })}
            {sectionTable({ section: "SF_SP", title: "Stock final Salle / Surplace", subtitle: "Grammes par parfum." })}
          </div>
          <div className="bg-card border rounded-xl p-4 shadow-sm text-sm">
            <Stat label="Emporter (frigo + transit) (g)" value={result.sfEmpG - result.sfChambreG} />
            <Stat label="Chambre (g)" value={result.sfChambreG} />
            <Stat label="Total stock final Emporter (g)" value={result.sfEmpG} strong />
            <Stat label="Total stock final Salle (g)" value={result.sfSpG} strong />
          </div>
        </div>
      ) : view === "initial" ? (
        <div className="space-y-4">
          {needsSeed ? (
            <div className="bg-card border rounded-xl p-3 shadow-sm text-xs text-muted-foreground">
              Aucun stock final la veille : saisir ci-dessous le premier stock initial. Les jours suivants, le stock
              final devient automatiquement le stock initial du lendemain.
            </div>
          ) : (
            <div className="bg-card border rounded-xl p-3 shadow-sm text-xs text-muted-foreground">
              Le stock initial est repris automatiquement depuis le stock final de la veille. Il n'est modifiable ici
              que si aucun stock final n'a été saisi la veille.
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-3">
            {sectionTable({
              section: "SI_EMP",
              title: "Stock initial Emporter",
              subtitle: carried
                ? "Reporté automatiquement (frigo + transit) du stock final de la veille."
                : "Total en grammes (frigo + transit).",
              override: carried?.SI_EMP,
            })}
            {sectionTable({
              section: "SI_CHAMBRE_EMP",
              title: "Stock initial Chambre",
              subtitle: carried
                ? "Reporté automatiquement du stock final chambre de la veille."
                : "Total en grammes.",
              override: carried?.SI_CHAMBRE_EMP,
            })}
            {sectionTable({
              section: "SI_SP",
              title: "Stock initial Salle",
              subtitle: carried ? "Reporté automatiquement du stock final de la veille." : "Grammes par parfum.",
              override: carried?.SI_SP,
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { t: "Consommation", value: sum.consoTotalG },
              { t: "Ventes", value: sum.ventesTotalG },
              { t: "Écart", value: sum.ecartTotalG, strong: true },
            ].map((b) => (
              <div key={b.t} className="bg-card border rounded-xl p-4 shadow-sm text-sm">
                <h3 className="font-semibold mb-2">{b.t}</h3>
                <Stat label={`${b.t} (g)`} value={b.value} strong={b.strong} />
              </div>
            ))}
          </div>

          {mode === "jour" && (
            <div className="bg-card border rounded-xl p-4 shadow-sm text-sm grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <Stat label="Stock initial Emporter (g)" value={result.siEmpG} />
              <Stat label="Stock initial Salle (g)" value={result.siSpG} />
              <Stat label="Entrées Emporter (g)" value={result.entreeEmpG} />
              <Stat label="Entrées Salle (g)" value={result.entreeSpG} />
              <Stat label="Stock final Emporter (g)" value={result.sfEmpG} />
              <Stat label="Stock final Chambre (g)" value={result.sfChambreG} />
              <Stat label="Stock final Salle (g)" value={result.sfSpG} />
              <Stat label="Ventes Emporter (g)" value={result.ventesEmpG} />
              <Stat label="Ventes Surplace (g)" value={result.ventesSpG} />
            </div>
          )}

          <div className="bg-card border rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-xs sm:text-sm border-collapse min-w-[600px]">
              <thead className="bg-muted/60">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/60 px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-right">Ventes Emp. (g)</th>
                  <th className="px-2 py-2 text-right">Ventes Srp. (g)</th>
                  <th className="px-2 py-2 text-right">Ventes total (g)</th>
                  <th className="px-2 py-2 text-right">Consommation (g)</th>
                  <th className="px-2 py-2 text-right">Écart (g)</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      Aucune saisie sur la période.
                    </td>
                  </tr>
                )}
                {shown.map((r) => (
                  <tr key={r.date} className="border-t">
                    <td className="sticky left-0 z-10 bg-card px-2 py-1 whitespace-nowrap">{formatDateFR(r.date)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtG(r.ventesEmpG)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtG(r.ventesSpG)}</td>
                    <td className="px-2 py-1 text-right tabular-nums font-semibold">{fmtG(r.ventesTotalG)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtG(r.consoTotalG)}</td>
                    <td className={`px-2 py-1 text-right tabular-nums font-bold ${r.ecartTotalG < 0 ? "text-destructive" : ""}`}>{fmtG(r.ecartTotalG)}</td>
                  </tr>
                ))}
                {shown.length > 0 && (
                  <tr className="border-t bg-muted/40 font-semibold">
                    <td className="sticky left-0 z-10 bg-muted/40 px-2 py-2">Total</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtG(sum.ventesEmpG)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtG(sum.ventesSpG)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtG(sum.ventesTotalG)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtG(sum.consoTotalG)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtG(sum.ecartTotalG)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Consommation = Stock initial total + Entrées total − Stock final total · Ventes = Ventes Emporter +
              Ventes Surplace · Écart = Consommation − Ventes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
