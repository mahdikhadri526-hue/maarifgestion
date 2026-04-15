import { useState } from "react";
import { updateLotEntry, LotEntry } from "@/lib/lotData";
import { getProducts } from "@/lib/stockData";
import { useExpiringLots, useProductLots } from "@/hooks/useStockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Edit2, Check, X, Package } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.jpeg";

export function ExpiryAlerts() {
  const { data: expiringLots, loading } = useExpiringLots(15);

  if (loading || !expiringLots || expiringLots.length === 0) return null;

  return (
    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h3 className="font-semibold text-destructive">Alertes DLC — Expiration ≤ 15 jours</h3>
      </div>
      <div className="space-y-2">
        {expiringLots.map((lot) => {
          const product = getProducts().find((p) => p.id === lot.productId);
          const isExpired = lot.daysUntilExpiry <= 0;
          return (
            <div
              key={lot.id}
              className={`flex items-center justify-between rounded-lg p-3 text-sm ${
                isExpired
                  ? "bg-destructive/10 border border-destructive/30"
                  : lot.daysUntilExpiry <= 5
                  ? "bg-amber-500/10 border border-amber-500/30"
                  : "bg-muted border"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{product?.name || lot.productId}</p>
                <p className="text-xs text-muted-foreground">
                  Lot: {lot.lotNumber} · Qté restante: {lot.remainingQuantity}
                </p>
              </div>
              <div className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                isExpired
                  ? "bg-destructive text-destructive-foreground"
                  : lot.daysUntilExpiry <= 5
                  ? "bg-amber-500 text-white"
                  : "bg-primary/10 text-primary"
              }`}>
                {isExpired ? "EXPIRÉ" : `${lot.daysUntilExpiry}j restants`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LotManager() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [editingLot, setEditingLot] = useState<string | null>(null);
  const [editLotNumber, setEditLotNumber] = useState("");
  const [editExpiryDate, setEditExpiryDate] = useState("");

  const products = getProducts("alimentaire");
  const { data: lots, loading } = useProductLots(selectedProductId);

  const startEdit = (lot: LotEntry) => {
    setEditingLot(lot.id);
    setEditLotNumber(lot.lotNumber);
    setEditExpiryDate(lot.expiryDate);
  };

  const saveEdit = async () => {
    if (editingLot) {
      await updateLotEntry(editingLot, { lotNumber: editLotNumber, expiryDate: editExpiryDate });
      toast.success("Lot mis à jour");
      setEditingLot(null);
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="bg-card rounded-lg border animate-fade-in">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <Package className="h-5 w-5 text-primary" />
          Gestion des Lots
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Consultez et modifiez les lots par produit alimentaire
        </p>
      </div>

      <div className="p-4 border-b">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Sélectionner un produit</label>
        <select
          value={selectedProductId || ""}
          onChange={(e) => setSelectedProductId(e.target.value || null)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">-- Choisir un produit --</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}{p.conditionnement ? ` — ${p.conditionnement}` : ""}</option>
          ))}
        </select>
      </div>

      {selectedProductId && (
        <div className="overflow-x-auto">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Chargement...</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">N° Lot</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">DLC</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Qté Init.</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Restant</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Statut</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!lots || lots.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                      Aucun lot pour ce produit
                    </td>
                  </tr>
                ) : (
                  lots.map((lot) => {
                    const days = getDaysUntilExpiry(lot.expiryDate);
                    const isEditing = editingLot === lot.id;
                    return (
                      <tr key={lot.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                        days <= 0 ? "bg-destructive/5" : days <= 5 ? "bg-amber-50 dark:bg-amber-950/20" : days <= 15 ? "bg-primary/5" : ""
                      }`}>
                        <td className="p-3 text-sm font-mono">
                          {isEditing ? (
                            <Input value={editLotNumber} onChange={(e) => setEditLotNumber(e.target.value)} className="h-8 text-xs" />
                          ) : lot.lotNumber}
                        </td>
                        <td className="p-3 text-sm">
                          {isEditing ? (
                            <Input type="date" value={editExpiryDate} onChange={(e) => setEditExpiryDate(e.target.value)} className="h-8 text-xs" />
                          ) : lot.expiryDate}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">{lot.quantity}</td>
                        <td className={`p-3 text-right font-mono text-sm font-semibold ${lot.remainingQuantity === 0 ? "text-muted-foreground" : ""}`}>
                          {lot.remainingQuantity}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            days <= 0 ? "bg-destructive text-destructive-foreground"
                            : days <= 5 ? "bg-amber-500 text-white"
                            : days <= 15 ? "bg-primary/10 text-primary"
                            : "bg-success/10 text-success"
                          }`}>
                            {days <= 0 ? "Expiré" : `${days}j`}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {isEditing ? (
                            <div className="flex gap-1 justify-center">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEdit}>
                                <Check className="h-3.5 w-3.5 text-success" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingLot(null)}>
                                <X className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(lot)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
