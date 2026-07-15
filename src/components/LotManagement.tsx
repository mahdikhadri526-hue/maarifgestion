import { useState } from "react";
import { updateLotEntry, deleteLotEntry, LotEntry } from "@/lib/lotData";
import { formatQuantityForProduct, getProducts, getMinStocks } from "@/lib/stockData";
import { useExpiringLots, useProductLots, useProductUnitConfigs, useStockLevels } from "@/hooks/useStockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Edit2, Check, X, Package, Trash2, PackageX, ClipboardCheck, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.jpeg";
import { useAuth } from "@/contexts/AuthContext";
import { ENABLE_FIFO_INDICATOR } from "@/lib/featureFlags";
import { formatDateFR, formatMaybeDate } from "@/lib/utils";
import { useEffect } from "react";
import { getAutocontrols, AutocontrolEntry } from "@/lib/autocontrolData";
import { supabase } from "@/integrations/supabase/client";

// --- Persistance locale du marquage "Commande passée" ---
const ORDER_PLACED_KEY = "order_placed_products_v1";

function readOrderPlaced(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ORDER_PLACED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeOrderPlaced(data: Record<string, string>) {
  try {
    localStorage.setItem(ORDER_PLACED_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("order-placed-changed"));
  } catch {}
}

function useOrderPlaced() {
  const [state, setState] = useState<Record<string, string>>(() => readOrderPlaced());
  useEffect(() => {
    const sync = () => setState(readOrderPlaced());
    window.addEventListener("order-placed-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("order-placed-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const mark = (productId: string) => {
    const next = { ...readOrderPlaced(), [productId]: new Date().toISOString() };
    writeOrderPlaced(next);
  };
  const unmark = (productId: string) => {
    const next = { ...readOrderPlaced() };
    delete next[productId];
    writeOrderPlaced(next);
  };
  const pruneTo = (validIds: Set<string>) => {
    const current = readOrderPlaced();
    let changed = false;
    const next: Record<string, string> = {};
    for (const [id, ts] of Object.entries(current)) {
      if (validIds.has(id)) next[id] = ts;
      else changed = true;
    }
    if (changed) writeOrderPlaced(next);
  };
  return { state, mark, unmark, pruneTo };
}

function OrderPlacedButton({
  placed,
  onMark,
  onUnmark,
  canEdit,
}: { placed: boolean; onMark: () => void; onUnmark: () => void; canEdit: boolean }) {
  if (placed) {
    return (
      <button
        type="button"
        onClick={canEdit ? onUnmark : undefined}
        disabled={!canEdit}
        title={canEdit ? "Annuler la mention" : "Réservé à l'administrateur"}
        className="text-[10px] font-semibold px-2 py-1 rounded-full bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-colors whitespace-nowrap flex items-center gap-1 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-success/15"
      >
        <Check className="h-3 w-3" /> Commande passée
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={canEdit ? onMark : undefined}
      disabled={!canEdit}
      title={canEdit ? "Marquer la commande comme passée" : "Réservé à l'administrateur"}
      className="text-[10px] font-semibold px-2 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-destructive/10"
    >
      Commande passée
    </button>
  );
}

export function PendingAutocontrolAlerts({ onOpen }: { onOpen?: () => void }) {
  const [pending, setPending] = useState<AutocontrolEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getAutocontrols();
        if (!active) return;
        setPending(data.filter((e) => !e.visaManager || !e.visaManager.trim()));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const ch = supabase
      .channel("autocontrols-pending-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "autocontrols" },
        () => load()
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  if (loading || pending.length === 0) return null;

  return (
    <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h3 className="font-semibold text-amber-700 dark:text-amber-400">
            Autocontrôles en attente de visa manager ({pending.length})
          </h3>
        </div>
        {onOpen && (
          <Button size="sm" variant="outline" onClick={onOpen} className="h-7 text-xs">
            Voir
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {pending.slice(0, 8).map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-lg p-2.5 text-sm border bg-background border-amber-500/20"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{e.article || e.ficheType}</p>
              <p className="text-xs text-muted-foreground truncate">
                {formatDateFR(e.controlDate)} · {e.ficheType} · {e.collaborateur}
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 whitespace-nowrap">
              EN ATTENTE
            </span>
          </div>
        ))}
        {pending.length > 8 && (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            … et {pending.length - 8} autre(s).
          </p>
        )}
      </div>
    </div>
  );
}

export function StockOutAlerts() {
  const { data: levels, loading } = useStockLevels();
  const { state: placed, mark, unmark } = useOrderPlaced();
  const { isAdmin } = useAuth();
  if (loading || !levels) return null;
  const outOfStock = levels.filter((l) => l.stockRestant <= 0);
  if (outOfStock.length === 0) return null;

  return (
    <div className="bg-destructive/5 border border-destructive/30 rounded-xl p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <PackageX className="h-5 w-5 text-destructive" />
        <h3 className="font-semibold text-destructive">
          Rupture de Stock ({outOfStock.length}) — Merci de passer votre commande
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {outOfStock.map((l) => (
          <div
            key={l.productId}
            className={`flex flex-col gap-2 rounded-lg p-2.5 text-sm border ${
              l.stockRestant < 0
                ? "bg-destructive/10 border-destructive/40"
                : "bg-muted border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium break-words">{l.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {l.category === "alimentaire" ? "Alimentaire" : "Emballage"}
                </p>
              </div>
              <div
                className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                  l.stockRestant < 0
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-muted-foreground/20 text-foreground"
                }`}
              >
                {l.stockRestant < 0 ? `${l.stockRestant}` : "RUPTURE"}
              </div>
            </div>
            <div className="flex justify-end">
              <OrderPlacedButton
                placed={!!placed[l.productId]}
                onMark={() => { mark(l.productId); toast.success("Commande marquée comme passée"); }}
                onUnmark={() => unmark(l.productId)}
                canEdit={isAdmin}
              />
              <span
                className={`text-[10px] font-bold px-2 py-1 rounded-full ml-2 ${
                  placed[l.productId]
                    ? "bg-success/15 text-success border border-success/30"
                    : "bg-destructive/15 text-destructive border border-destructive/30"
                }`}
                title="Commande passée ?"
              >
                {placed[l.productId] ? "Oui" : "Non"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LowStockAlerts() {
  const { data: levels, loading } = useStockLevels();
  const [minStocks, setMinStocks] = useState<Record<string, number>>({});
  const { state: placed, mark, unmark } = useOrderPlaced();
  const { isAdmin } = useAuth();

  useEffect(() => {
    let active = true;
    const load = () => getMinStocks().then((m) => { if (active) setMinStocks(m); }).catch((e) => console.error(e));
    load();
    const ch = supabase
      .channel("min-stocks-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "initial_stocks" }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  if (loading || !levels) return null;
  const low = levels.filter((l) => {
    const min = minStocks[l.productId] || 0;
    return min > 0 && l.stockRestant > 0 && l.stockRestant <= min;
  });
  if (low.length === 0) return null;

  return (
    <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <h3 className="font-semibold text-amber-700 dark:text-amber-400">
          Stock minimum atteint ({low.length}) — Anticiper la commande
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {low.map((l) => {
          const min = minStocks[l.productId] || 0;
          return (
            <div
              key={l.productId}
              className="flex flex-col gap-2 rounded-lg p-2.5 text-sm border bg-background border-amber-500/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium break-words">{l.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.category === "alimentaire" ? "Alimentaire" : "Emballage"} · Min: {min}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 whitespace-nowrap flex-shrink-0">
                  Restant: {l.stockRestant}
                </span>
              </div>
              <div className="flex justify-end">
                <OrderPlacedButton
                  placed={!!placed[l.productId]}
                  onMark={() => { mark(l.productId); toast.success("Commande marquée comme passée"); }}
                  onUnmark={() => unmark(l.productId)}
                  canEdit={isAdmin}
                />
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-full ml-2 ${
                    placed[l.productId]
                      ? "bg-success/15 text-success border border-success/30"
                      : "bg-destructive/15 text-destructive border border-destructive/30"
                  }`}
                  title="Commande passée ?"
                >
                  {placed[l.productId] ? "Oui" : "Non"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ExpiryAlerts() {
  const { data: expiringLots, loading } = useExpiringLots(30);

  if (loading || !expiringLots || expiringLots.length === 0) return null;

  return (
    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h3 className="font-semibold text-destructive">Alertes DLC — Expiration ≤ 1 mois</h3>
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
                  Lot: {formatMaybeDate(lot.lotNumber)} · Qté restante: {lot.remainingQuantity}
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
  const { can } = useAuth();

  const products = getProducts("alimentaire");
  const { data: lots, loading } = useProductLots(selectedProductId);
  const { data: configs } = useProductUnitConfigs();

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

  const handleDelete = async (lot: LotEntry) => {
    try {
      await deleteLotEntry(lot.id);
      toast.success("Lot supprimé");
    } catch (err) {
      toast.error("Erreur lors de la suppression");
      console.error(err);
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
          <option value="__all__">Tous les produits</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
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
                  {selectedProductId === "__all__" && (
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Produit</th>
                  )}
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">N° Lot</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">DLC</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Qté Init.</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Sorti</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Restant</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Statut</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!lots || lots.length === 0) ? (
                  <tr>
                    <td colSpan={selectedProductId === "__all__" ? 8 : 7} className="text-center text-muted-foreground py-8 text-sm">
                      Aucun lot pour ce produit
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const sorted = [...lots].sort((a, b) => {
                      const aEmpty = a.remainingQuantity === 0 ? 1 : 0;
                      const bEmpty = b.remainingQuantity === 0 ? 1 : 0;
                      if (aEmpty !== bEmpty) return aEmpty - bEmpty;
                      return a.expiryDate.localeCompare(b.expiryDate);
                    });
                    // Compte d'ordre FIFO par produit, uniquement parmi les lots non épuisés
                    const orderByLotId = new Map<string, number>();
                    const countByProduct = new Map<string, number>();
                    sorted.forEach((l) => {
                      if (l.remainingQuantity > 0) {
                        countByProduct.set(l.productId, (countByProduct.get(l.productId) || 0) + 1);
                      }
                    });
                    const seenByProduct = new Map<string, number>();
                    sorted.forEach((l) => {
                      if (l.remainingQuantity > 0) {
                        const n = (seenByProduct.get(l.productId) || 0) + 1;
                        seenByProduct.set(l.productId, n);
                        orderByLotId.set(l.id, n);
                      }
                    });
                    const ordinalLabel = (n: number) => {
                      const labels = ["Première sortie", "Deuxième sortie", "Troisième sortie", "Quatrième sortie", "Cinquième sortie", "Sixième sortie", "Septième sortie", "Huitième sortie", "Neuvième sortie", "Dixième sortie"];
                      return labels[n - 1] || `${n}ème sortie`;
                    };
                    return sorted.map((lot) => {
                    const days = getDaysUntilExpiry(lot.expiryDate);
                    const isEditing = editingLot === lot.id;
                    const productName = products.find((p) => p.id === lot.productId)?.name || lot.productId;
                    const cfg = configs?.[lot.productId];
                    const initialQuantity = formatQuantityForProduct(lot.productId, lot.quantity, cfg);
                    const consumedQuantity = formatQuantityForProduct(lot.productId, lot.quantity - lot.remainingQuantity, cfg);
                    const remainingQuantity = formatQuantityForProduct(lot.productId, lot.remainingQuantity, cfg);
                    const totalActive = countByProduct.get(lot.productId) || 0;
                    const orderNum = orderByLotId.get(lot.id);
                    const showOrder = totalActive > 1 && orderNum !== undefined;
                    return (
                      <tr key={lot.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                        lot.remainingQuantity === 0 ? "bg-muted/40 opacity-70" :
                        days <= 0 ? "bg-destructive/5" : days <= 5 ? "bg-amber-50 dark:bg-amber-950/20" : days <= 15 ? "bg-primary/5" : ""
                      }`}>
                        {selectedProductId === "__all__" && (
                          <td className="p-3 text-sm font-medium">{productName}</td>
                        )}
                        <td className="p-3 text-sm font-mono">
                          {isEditing ? (
                            <Input value={editLotNumber} onChange={(e) => setEditLotNumber(e.target.value)} className="h-8 text-xs" />
                          ) : (
                            <div className="flex flex-col leading-tight">
                              {ENABLE_FIFO_INDICATOR && showOrder && (
                                <span className={`text-[10px] font-sans font-medium italic ${
                                  orderNum === 1 ? "text-primary" : orderNum === 2 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                                }`}>
                                  {ordinalLabel(orderNum!)}
                                </span>
                              )}
                              <span>{formatMaybeDate(lot.lotNumber)}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-sm">
                          {isEditing ? (
                            <Input type="date" value={editExpiryDate} onChange={(e) => setEditExpiryDate(e.target.value)} className="h-8 text-xs" />
                          ) : formatDateFR(lot.expiryDate)}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">{initialQuantity}</td>
                        <td className="p-3 text-right font-mono text-sm text-accent-foreground">{consumedQuantity}</td>
                        <td className={`p-3 text-right font-mono text-sm font-semibold ${lot.remainingQuantity === 0 ? "text-muted-foreground" : ""}`}>
                          {remainingQuantity}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            lot.remainingQuantity === 0 ? "bg-muted-foreground/20 text-muted-foreground"
                            : days <= 0 ? "bg-destructive text-destructive-foreground"
                            : days <= 5 ? "bg-amber-500 text-white"
                            : days <= 15 ? "bg-primary/10 text-primary"
                            : "bg-success/10 text-success"
                          }`}>
                            {lot.remainingQuantity === 0 ? "Épuisé" : days <= 0 ? "Expiré" : `${days}j`}
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
                            <div className="flex gap-1 justify-center">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                                if (can("edit_lots")) {
                                  startEdit(lot);
                                } else {
                                  toast.error("Opération non autorisée");
                                }
                              }}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                                if (can("delete_lots")) {
                                  handleDelete(lot);
                                } else {
                                  toast.error("Opération non autorisée");
                                }
                              }}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  });
                  })()
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
