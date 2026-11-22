import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { saveStockTotalOpening, validateStockTotalOpening, type StockTotalOpening } from "@/lib/stockTotalOpening";
import { toast } from "sonner";
import { formatDateFR } from "@/lib/utils";

export type StockTotalOpeningTarget = {
  productId: string; name: string; category: "alimentaire" | "emballage";
  date: string; current?: number; unit: string; existing?: boolean;
};

export function StockTotalOpeningDialog({ target, operators, canEdit, onClose, onSaved }: {
  target: StockTotalOpeningTarget | null; operators: string[]; canEdit: boolean;
  onClose: () => void; onSaved: (opening: StockTotalOpening) => void;
}) {
  const [quantity, setQuantity] = useState(target?.existing ? String(target.current ?? "") : "");
  const [operator, setOperator] = useState("");
  const [date, setDate] = useState(target?.date ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!target || !canEdit || saving) return;
    try {
      const value = validateStockTotalOpening(quantity, operator, date);
      setSaving(true);
      const opening = { product_id: target.productId, category: target.category,
        opening_date: date, quantity: value, performed_by: operator };
      await saveStockTotalOpening(opening, target.existing);
      onSaved(opening);
      toast.success("Stock total de départ enregistré");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’enregistrer le stock de départ");
    } finally { setSaving(false); }
  };
  return <Dialog open={!!target} onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Stock total de départ</DialogTitle></DialogHeader>
      {target && <div className="space-y-4 text-sm">
        <div><p className="font-semibold">{target.name}</p>
          <p className="text-muted-foreground">Début du {formatDateFR(date)} · {target.unit}</p>
          <p className="text-muted-foreground">Stock initial total actuel : {target.current ?? "—"}</p>
        </div>
        <div><label htmlFor="stock-total-opening-date">Date de départ *</label>
          <Input id="stock-total-opening-date" type="date" value={date}
            onChange={event => setDate(event.target.value)} disabled={saving} className="mt-1" />
        </div>
        <div><label htmlFor="stock-total-opening-quantity">Nouveau stock initial total *</label>
          <Input id="stock-total-opening-quantity" type="number" min="0" step="any" autoFocus
            value={quantity} onChange={event => setQuantity(event.target.value)} disabled={saving}
            className="mt-1 text-right font-mono" />
        </div>
        <div><label htmlFor="stock-total-opening-operator">Effectué par *</label>
          <select id="stock-total-opening-operator" className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={operator} onChange={event => setOperator(event.target.value)} disabled={saving}>
            <option value="">Choisir...</option>{operators.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">Stock de départ modifiable pour cet article et ce PDV. Les mouvements et l’historique antérieurs restent conservés.</p>
      </div>}
      <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>Annuler</Button>
        <Button disabled={!canEdit || saving || !date || !quantity.trim() || !operator.trim()} onClick={() => void save()}>
          {saving ? "Enregistrement…" : "Confirmer le stock de départ"}
        </Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}