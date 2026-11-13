import { StockColumnHeaders } from "@/components/StockColumnHeaders";
import { MiseEnPlaceInput } from "@/components/MiseEnPlaceCell";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateStockTotals } from "@/lib/stockInitialTotal";
import { stockReferenceQuantity } from "@/lib/stockReference";
import { stockRecipeIngredientId } from "@/lib/stockRecipeIngredients";
import { roundStockQuantity, type UnitType } from "@/lib/stockData";

type Row = { article: string; stockInitial: number; entrees: number; sorties: number; stockRestant: number };
type Reference = { conversion: string; unitRef: string };
export function WeeklyStockColumns({ rows, categoryLabel, showRefCols, showMepCols, references, updateRef, mepMap, saveMep, editable, previousTotals, previousLoading, units, unitLabels, canEditUnit, updateUnit }: {
  rows: Row[]; categoryLabel: string; showRefCols: boolean; showMepCols: boolean;
  references: Record<string, Reference>; updateRef: (id: string, patch: Partial<Reference>) => void;
  mepMap: Record<string, number>; saveMep: (id: string, value: number) => void; editable: boolean;
  previousTotals: Record<string, number>; previousLoading: boolean;
  units: Record<string, UnitType>; unitLabels: Record<UnitType, string>;
  canEditUnit: boolean; updateUnit: (id: string, unit: UnitType) => Promise<void>;
}) {
  const referenceValue = (id: string, quantity: number | undefined) => {
    if (quantity === undefined) return "—";
    const ref = references[id];
    const converted = stockReferenceQuantity(quantity, ref?.conversion ?? "");
    return converted === null ? "—" : <>{converted} <span className="text-xs text-muted-foreground">{ref?.unitRef}</span></>;
  };
  const cell = "p-3 text-right font-mono text-sm";
  const sum = (field: keyof Omit<Row, "article">) => roundStockQuantity(rows.reduce((total, row) => total + row[field], 0));
  return <table className="weekly-sticky-table text-sm w-max min-w-full border-separate border-spacing-0">
    <thead className="bg-muted sticky top-0 z-30"><tr className="border-b bg-muted/50">
      <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider weekly-sticky-column weekly-sticky-head bg-muted border-r w-[140px] min-w-[140px] sticky left-0 z-40">Article</th>
      <StockColumnHeaders showRefCols={showRefCols} showMepCols={showMepCols} />
    </tr></thead>
    <tbody>{rows.map(row => {
      const id = stockRecipeIngredientId(row.article);
      const initialTotal = previousTotals[id];
      const mep = mepMap[id] ?? 0;
      const { sortiesTotal, stockTotal } = calculateStockTotals(initialTotal, row.entrees, row.sorties, mep);
      return <tr key={id} className="border-b last:border-0 hover:bg-muted/30 even:bg-muted/30">
        <td className="p-3 font-medium weekly-sticky-column border-r bg-card w-[140px] min-w-[140px] sticky left-0 z-20">{row.article}</td>
        <td className="p-3 text-xs">
          <Select disabled={!canEditUnit} value={units[id] ?? (categoryLabel === "Crème fraîche" ? "KILO" : "")} onValueChange={value => { void updateUnit(id, value as UnitType); }}>
            <SelectTrigger aria-label={`Unité ${row.article}`} className="h-8 w-28 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{(Object.entries(unitLabels) as [UnitType, string][]).map(([unit, label]) => <SelectItem key={unit} value={unit}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </td>
        <td className={cell}><Input type="number" step="any" aria-label={`Conversion ${row.article}`} value={references[id]?.conversion ?? ""} onChange={e => updateRef(id, { conversion: e.target.value })} placeholder="—" className="w-20 h-8 text-right text-xs" /></td>
        <td className="p-3"><select aria-label={`Unité Réf. ${row.article}`} value={references[id]?.unitRef ?? ""} onChange={e => updateRef(id, { unitRef: e.target.value })} className="w-24 bg-background border rounded px-2 py-1 text-xs">
          <option value="">—</option>{["kg", "g", "L", "ml", "pièce", "paquet", "carton", "bac", "boîte", "sachet", "bouteille", "rouleau"].map(unit => <option key={unit} value={unit}>{unit}</option>)}
        </select></td>
        <td className="p-3 text-xs text-primary">{categoryLabel}</td>
        <td className={`${cell} text-primary font-semibold`}>{row.stockInitial}</td>
        {showMepCols && <td className={`${cell} text-primary`}>{previousLoading ? "…" : initialTotal ?? "—"}</td>}
        {showMepCols && showRefCols && <td className={cell}>{previousLoading ? "…" : referenceValue(id, initialTotal)}</td>}
        <td className={`${cell} text-success`}>{row.entrees}</td>{showRefCols && <td className={cell}>{referenceValue(id, row.entrees)}</td>}
        <td className={`${cell} text-accent-foreground`}>{row.sorties}</td>{showRefCols && <td className={cell}>{referenceValue(id, row.sorties)}</td>}
        <td className={`${cell} font-semibold ${row.stockRestant < 0 ? "text-destructive" : ""}`}>{row.stockRestant}</td>{showRefCols && <td className={cell}>{referenceValue(id, row.stockRestant)}</td>}
        {showMepCols && <>
          <td className={cell}>{editable ? <MiseEnPlaceInput value={mep} onSave={value => saveMep(id, value)} /> : mep}</td>
          {showRefCols && <td className={cell}>{referenceValue(id, mep)}</td>}
          <td className={`${cell} font-bold ${sortiesTotal < 0 ? "text-destructive" : "text-accent-foreground"}`}>{sortiesTotal}</td>
          {showRefCols && <td className={cell}>{referenceValue(id, sortiesTotal)}</td>}
          <td className={`${cell} font-bold text-primary`}>{previousLoading ? "…" : stockTotal ?? "—"}</td>
          {showRefCols && <td className={cell}>{previousLoading ? "…" : referenceValue(id, stockTotal)}</td>}
        </>}
      </tr>;
    })}
    {rows.length > 0 && <tr className="border-t-2 bg-muted/40 font-semibold">
      <td className="p-3 weekly-sticky-column border-r bg-muted sticky left-0 z-20">TOTAL</td>
      <td colSpan={4} /><td className={cell}>{sum("stockInitial")}</td>
      {showMepCols && <td className={cell}>—</td>}{showMepCols && showRefCols && <td />}
      <td className={cell}>{sum("entrees")}</td>{showRefCols && <td />}
      <td className={cell}>{sum("sorties")}</td>{showRefCols && <td />}
      <td className={cell}>{sum("stockRestant")}</td>{showRefCols && <td />}
      {showMepCols && <><td />{showRefCols && <td />}<td />{showRefCols && <td />}<td />{showRefCols && <td />}</>}
    </tr>}
    </tbody>
  </table>;
}