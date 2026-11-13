import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roundStockQuantity, type SourceDailyDetail } from "@/lib/stockData";
import { formatDateFR } from "@/lib/utils";

const columns = ["stockInitial", "entrees", "sorties", "stockRestant"] as const;
const labels = ["Stock initial", "Entrées", "Sorties", "Stock restant"];
const quantity = (n: number) => roundStockQuantity(n).toLocaleString("fr-FR", { maximumFractionDigits: 3 });

/** Expandable per-source daily history shown under the totals of an aggregated row. */
export function AggregateSourceDetails({ sources, period }: { sources: SourceDailyDetail[]; period: string }) {
  const [expanded, setExpanded] = useState<string[]>([]);
  if (sources.length === 0) return null;
  return <div className="space-y-2 pt-4 min-w-0">
    <p className="text-sm font-medium">Détail par jour — {period}</p>
    <div className="divide-y border rounded-md">
      {sources.map(src => {
        const open = expanded.includes(src.name);
        const tot = src.daily.reduce((a, d) => ({ e: a.e + d.entrees, s: a.s + d.sorties }), { e: 0, s: 0 });
        return <section key={src.name} className="py-1">
          <Button variant="ghost" className="w-full justify-start gap-2 h-auto whitespace-normal text-left" aria-expanded={open}
            onClick={() => setExpanded(c => open ? c.filter(n => n !== src.name) : [...c, src.name])}>
            {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <span className="flex-1">{src.name}</span>
            <span className="text-xs text-muted-foreground">{src.source === "suivi-hebdo" ? "Suivi hebdo" : "Mouvements"} · {src.daily.length} j · +{quantity(tot.e)} / −{quantity(tot.s)}</span>
          </Button>
          {open && (src.daily.length === 0
            ? <p className="text-xs text-muted-foreground px-3 pb-2">Aucune saisie dans cette période ; dernier stock connu reporté.</p>
            : <div className="overflow-x-auto px-2 pb-2"><table className="w-full text-xs whitespace-nowrap">
                <thead><tr className="border-b bg-muted"><th className="p-2 text-left">Date</th>{labels.map(l => <th key={l} className="p-2 text-right">{l}</th>)}</tr></thead>
                <tbody>{src.daily.map(d => <tr key={d.date} className="border-b last:border-0"><td className="p-2">{formatDateFR(d.date)}</td>{columns.map(k => <td key={k} className={`p-2 text-right font-mono ${k === "stockRestant" && d[k] < 0 ? "text-destructive" : ""}`}>{quantity(d[k])}</td>)}</tr>)}</tbody>
              </table></div>)}
        </section>;
      })}
    </div>
  </div>;
}
