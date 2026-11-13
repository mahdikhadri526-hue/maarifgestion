import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roundStockQuantity } from "@/lib/stockData";
import { formatDateFR } from "@/lib/utils";
import { sumGlaceStockDetails, type GlaceStockDetail } from "@/lib/glaceStockAggregate";

const columns = ["stockInitial", "entrees", "sorties", "stockRestant"] as const;
const labels = ["Stock initial", "Entrées", "Sorties", "Stock restant"];
const quantity = (n: number) => roundStockQuantity(n).toLocaleString("fr-FR", { maximumFractionDigits: 3 });

export function GlaceStockDetails({ rows, period }: { rows: GlaceStockDetail[]; period: string }) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const totals = sumGlaceStockDetails(rows);
  return <div className="space-y-4 min-w-0">
    <p className="text-sm font-medium">{period}</p>
    <div className="overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead><tr className="border-b bg-muted">
          <th className="p-2 text-left">Parfum</th><th className="p-2 text-right">Kg / bac</th>
          {labels.map(label => <th key={label} className="p-2 text-right">{label} (kg)</th>)}
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.name} className="border-b">
          <td className="p-2 font-medium">{row.name}</td>
          <td className="p-2 text-right font-mono">{row.missingGrammage ? "Non renseigné" : quantity(row.kgPerBac)}</td>
          {columns.map(key => <td key={key} className="p-2 text-right font-mono">{row.missingGrammage ? "—" : quantity(row[key])}</td>)}
        </tr>)}</tbody>
        <tfoot><tr className="bg-muted font-semibold"><td className="p-2" colSpan={2}>TOTAL (kg)</td>
          {columns.map(key => <td key={key} className="p-2 text-right font-mono">{quantity(totals[key])}</td>)}
        </tr></tfoot>
      </table>
    </div>
    {rows.some(row => row.missingGrammage) && <p className="text-sm text-destructive">Grammage manquant : ces parfums ne sont pas inclus dans le total en kg.</p>}
    <div className="divide-y">
      {rows.map(row => {
        const open = expanded.includes(row.name);
        return <section key={row.name} className="py-2">
          <Button variant="ghost" className="w-full justify-start gap-2 h-auto whitespace-normal text-left" aria-expanded={open}
            onClick={() => setExpanded(current => open ? current.filter(name => name !== row.name) : [...current, row.name])}>
            {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            {row.name} — {quantity(row.bacs.stockRestant)} bacs
          </Button>
          {open && <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {columns.map((key, i) => <div key={key}><span className="text-muted-foreground">{labels[i]}</span><div className="font-mono">{quantity(row.bacs[key])} bacs × {quantity(row.kgPerBac)} kg = {row.missingGrammage ? "—" : `${quantity(row[key])} kg`}</div></div>)}
            </div>
            {row.daily.length === 0 ? <p className="text-xs text-muted-foreground">Aucune saisie dans cette période ; dernier stock connu reporté.</p> :
              <div className="overflow-x-auto"><table className="w-full text-xs whitespace-nowrap">
                <thead><tr className="border-b bg-muted"><th className="p-2 text-left">Date</th>{labels.map(label => <th key={label} className="p-2 text-right">{label} (bacs)</th>)}<th className="p-2 text-right">Restant (kg)</th></tr></thead>
                <tbody>{row.daily.map(day => <tr key={day.date} className="border-b"><td className="p-2">{formatDateFR(day.date)}</td>{columns.map(key => <td key={key} className="p-2 text-right font-mono">{quantity(day[key])}</td>)}<td className="p-2 text-right font-mono">{row.missingGrammage ? "—" : quantity(day.stockRestant * row.kgPerBac)}</td></tr>)}</tbody>
              </table></div>}
          </div>}
        </section>;
      })}
    </div>
  </div>;
}