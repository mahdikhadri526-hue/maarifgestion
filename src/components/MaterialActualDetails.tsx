import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MaterialActualDetail } from "@/lib/materialStockActuals";
import type { MaterialResult } from "@/lib/materialVariance";

const format = (value: number | null) => value === null ? "—" : value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });

/** Read-only explanation of the existing actual usage calculation (Sorties total Réf.). */
export function MaterialActualDetails({ row, detail, period, onClose }: {
  row: MaterialResult | null;
  detail: MaterialActualDetail | null;
  period: { start: string; end: string };
  onClose: () => void;
}) {
  const date = (value: string) => value.split("-").reverse().join(".");
  const perLineConversion = !!detail?.lines.some(line => line.converted !== null);
  return <Dialog open={!!row} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-3xl max-h-[85dvh] overflow-y-auto min-w-0">
      <DialogHeader>
        <DialogTitle className="pr-6 break-words">{row?.name}</DialogTitle>
        <DialogDescription>Utilisation réelle · {date(period.start)} au {date(period.end)}</DialogDescription>
      </DialogHeader>
      {!detail ? <p className="text-sm text-muted-foreground">Aucune sortie de stock liée à cet ingrédient sur cette période.</p> : <>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm min-w-[580px]">
            <thead className="bg-muted"><tr>
              <th className="p-3 text-left">Produit source</th>
              <th className="p-3 text-right">Sorties</th>
              <th className="p-3 text-right">Mise en place</th>
              <th className="p-3 text-right">Sorties total</th>
              {perLineConversion && <th className="p-3 text-right">Conversion Réf.</th>}
              {perLineConversion && <th className="p-3 text-right">Sorties total Réf.</th>}
            </tr></thead>
            <tbody>{detail.lines.map((line, index) => <tr key={`${line.name}:${index}`} className="border-t even:bg-muted/30">
              <td className="p-3 font-medium break-words">{line.name}</td>
              <td className="p-3 text-right tabular-nums whitespace-nowrap">{format(line.sorties)} {line.nativeUnit}</td>
              <td className="p-3 text-right tabular-nums whitespace-nowrap">{format(line.miseEnPlace)}</td>
              <td className="p-3 text-right tabular-nums whitespace-nowrap">{format(line.sortiesTotal)} {line.nativeUnit}</td>
              {perLineConversion && <td className="p-3 text-right tabular-nums whitespace-nowrap">{line.converted !== null ? `× ${line.conversion}` : "—"}</td>}
              {perLineConversion && <td className="p-3 text-right tabular-nums whitespace-nowrap">{line.converted !== null ? `${format(line.converted)} ${line.unitRef}` : "—"}</td>}
            </tr>)}</tbody>
          </table>
        </div>
        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <span>Sorties total (Sorties − Mise en place)</span>
            <span className="tabular-nums">{format(detail.totalSorties)} {detail.nativeUnit}</span>
          </div>
          {detail.conversion && <div className="flex flex-wrap justify-between gap-2">
            <span>Conversion Réf.</span>
            <span className="tabular-nums">× {detail.conversion}</span>
          </div>}
          <div className="flex flex-wrap justify-between gap-2 font-semibold">
            <span>Utilisation réelle</span>
            <span className="tabular-nums break-words">{detail.total === null ? "—" : `${format(detail.total)} ${detail.unit}`}</span>
          </div>
        </div>
        {detail.conversionMissing && <p className="text-sm text-warning">Conversion Réf. manquante : la quantité reste en unité native.</p>}
      </>}
    </DialogContent>
  </Dialog>;
}
