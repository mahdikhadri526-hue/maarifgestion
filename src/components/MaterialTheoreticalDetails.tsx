import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { materialTheoreticalDetails } from "@/lib/materialTheoreticalDetails";
import { materialUsageDisplay } from "@/lib/materialDisplayUnits";
import type { MaterialResult } from "@/lib/materialVariance";
import type { loadMaterialAnalysis } from "@/lib/materialVarianceData";

const labels: Record<string, string> = { surplace: "Sur place", emporter: "Emporter", tartes: "Tartes", autres: "Autres" };
const format = (value: number | null) => value === null ? "—" : value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });

export function MaterialTheoreticalDetails({ row, data, sales, preferredUnit, period, onClose }: {
  row: MaterialResult | null;
  data: Awaited<ReturnType<typeof loadMaterialAnalysis>> | null;
  sales: Record<string, number>;
  preferredUnit?: string;
  period: { start: string; end: string };
  onClose: () => void;
}) {
  const lines = row && data ? materialTheoreticalDetails(row.id, data.recipes, data.ingredients, sales) : [];
  const products = new Map(data?.products.map(product => [product.id, product]));
  const total = row ? materialUsageDisplay("theo", row.theoretical, row.unit, preferredUnit) : null;
  const date = (value: string) => value.split("-").reverse().join(".");
  return <Dialog open={!!row} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-3xl max-h-[85dvh] overflow-y-auto min-w-0">
      <DialogHeader>
        <DialogTitle className="pr-6 break-words">{row?.name}</DialogTitle>
        <DialogDescription>Utilisation théorique · {date(period.start)} au {date(period.end)}</DialogDescription>
      </DialogHeader>
      {lines.length > 0 ? <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm min-w-[580px]">
          <thead className="bg-muted"><tr><th className="p-3 text-left">Produit vendu</th><th className="p-3 text-left">Catégorie</th><th className="p-3 text-right">Quantité vendue</th><th className="p-3 text-right">Dose de recette</th><th className="p-3 text-right">Ventes × dose</th></tr></thead>
          <tbody>{lines.map((line, index) => {
            const product = products.get(line.productId);
            const usage = materialUsageDisplay("theo", line.usage, line.unit, preferredUnit);
            return <tr key={`${line.productId}:${index}`} className="border-t even:bg-muted/30">
              <td className="p-3 font-medium">{product?.name ?? line.productId}</td>
              <td className="p-3 text-muted-foreground">{labels[product?.category ?? "autres"] ?? product?.category}</td>
              <td className="p-3 text-right tabular-nums">{format(line.sold)}</td>
              <td className="p-3 text-right tabular-nums whitespace-nowrap">{format(line.dose)} {line.unit}</td>
              <td className="p-3 text-right tabular-nums whitespace-nowrap">{format(usage.value)} {usage.label}</td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <p className="text-sm text-muted-foreground">{row?.theoretical === null ? "Aucune recette liée avec des ventes sur cette période." : "Aucune vente renseignée pour les recettes de cet ingrédient sur cette période."}</p>}
      <div className="border-t pt-3 flex flex-wrap justify-between gap-2 font-semibold">
        <span>Total théorique</span>
        <span className="tabular-nums break-words">{total && (row?.theoretical === null ? row.unit || "—" : `${format(total.value)} ${total.label}`)}</span>
      </div>
      {row?.theoretical === null && row.unit && <p className="text-sm text-warning">Unités différentes : les quantités restent séparées.</p>}
    </DialogContent>
  </Dialog>;
}