import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { weekStartOf } from "@/lib/miseEnPlaceData";
import { roundStockQuantity } from "@/lib/stockData";
import { getWeeklyMep, setWeeklyMep } from "@/lib/weeklyMiseEnPlaceData";

function shiftWeek(week: string, deltaWeeks: number): string {
  const [y, m, d] = week.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaWeeks * 7);
  return weekStartOf(date);
}

function formatWeekLabel(week: string): string {
  const [y, m, d] = week.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const fmt = (dt: Date) =>
    `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
  return `Semaine du ${fmt(start)} au ${fmt(end)}`;
}

export function WeeklyMiseEnPlaceDialog({
  open,
  onOpenChange,
  products,
  onWeekChange,
  stockLoading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: Array<{ id: string; name: string; stockRestant: number }>;
  onWeekChange?: (week: string, isCurrent: boolean) => void;
  stockLoading?: boolean;
}) {
  const [week, setWeek] = useState(() => weekStartOf(new Date()));
  const [values, setValues] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    onWeekChange?.(week, week === weekStartOf(new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, week]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getWeeklyMep(week)
      .then((r) => {
        if (cancelled) return;
        setValues(r.values);
        setSaved(r.saved);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e?.message || "Chargement impossible");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, week]);

  const save = async (productId: string, value: number) => {
    const prev = values[productId];
    setValues((p) => ({ ...p, [productId]: value }));
    try {
      await setWeeklyMep(productId, value, week);
      setSaved((p) => ({ ...p, [productId]: true }));
    } catch (e: any) {
      setValues((p) => ({ ...p, [productId]: prev ?? 0 }));
      toast.error(e?.message || "Enregistrement impossible");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()} className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Mise en place hebdomadaire</DialogTitle>
          <DialogDescription>
            La mise en place est saisie par semaine ; le stock restant est affiché sans être modifié.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" onClick={() => setWeek((w) => shiftWeek(w, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 justify-center gap-2 font-semibold">
                <CalendarDays className="h-4 w-4" />
                {formatWeekLabel(week)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={weekToDate(week)}
                defaultMonth={weekToDate(week)}
                onSelect={(d) => {
                  if (d) {
                    setWeek(weekStartOf(d));
                    setPickerOpen(false);
                  }
                }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" onClick={() => setWeek((w) => shiftWeek(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {loading || stockLoading ? (
          <p className="text-center text-muted-foreground py-6">Chargement...</p>
        ) : (
          <div className="rounded-lg border overflow-auto min-h-0 max-w-full">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock restant</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock mise en place</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saisie</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-sm font-medium">{p.name}</td>
                    <td className="p-3 text-right font-mono">{roundStockQuantity(p.stockRestant)}</td>
                    <td className="p-3 text-right">
                      <WeeklyMepInput value={values[p.id] ?? 0} onSave={(v) => save(p.id, v)} />
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-primary">
                      {roundStockQuantity(p.stockRestant + (values[p.id] ?? 0))}
                    </td>
                    <td className="p-3 text-right">
                      {saved[p.id] ? (
                        <Badge variant="secondary">Cette semaine</Badge>
                      ) : values[p.id] !== undefined ? (
                        <Badge variant="outline">Reprise</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length === 0 && (
              <p className="text-center text-muted-foreground py-6">Aucun produit</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WeeklyMepInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value ?? 0));
  useEffect(() => {
    setDraft(String(value ?? 0));
  }, [value]);
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft) || 0;
        if (n !== value) onSave(n);
      }}
      className="h-8 w-24 text-right font-mono text-sm ml-auto"
    />
  );
}
