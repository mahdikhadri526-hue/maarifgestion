import { useState } from "react";
import { getProducts, DEFAULT_UNIT_CONFIG, getPieceLabel } from "@/lib/stockData";
import { saveRequisition, setRequisitionTotal, REQUISITION_SALLE_IDS, REQUISITION_EMPORTER_IDS } from "@/lib/requisitionData";
import { useRequisitionsByDate, useProductUnitConfigs } from "@/hooks/useStockData";
import { getOperators, rememberOperator } from "@/lib/operators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ClipboardList, Search, Pencil, Check, X, Eye, EyeOff, Trash2 } from "lucide-react";
import logo from "@/assets/logo.jpeg";
import { MultiUnitInput, MultiUnitValues, EMPTY_MULTI, totalPieces, dominantUnit } from "./MultiUnitInput";

interface Props {
  onUpdated: () => void;
}

// Décompose un total en pièces vers cartons/paquets/pièces selon la config (greedy).
function piecesToMulti(total: number, cfg: { cartonEnabled: boolean; paquetEnabled: boolean; piecesPerCarton: number; piecesPerPaquet: number }): MultiUnitValues {
  let remaining = Math.max(0, Math.floor(total));
  let cartons = 0, paquets = 0;
  if (cfg.cartonEnabled && cfg.piecesPerCarton > 0) {
    cartons = Math.floor(remaining / cfg.piecesPerCarton);
    remaining -= cartons * cfg.piecesPerCarton;
  }
  if (cfg.paquetEnabled && cfg.piecesPerPaquet > 0) {
    paquets = Math.floor(remaining / cfg.piecesPerPaquet);
    remaining -= paquets * cfg.piecesPerPaquet;
  }
  return {
    cartons: cartons ? String(cartons) : "",
    paquets: paquets ? String(paquets) : "",
    pieces: remaining ? String(remaining) : "",
  };
}

export function RequisitionForm({ onUpdated }: Props) {
  const [reqType, setReqType] = useState<"salle" | "emporter">("salle");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [performedBy, setPerformedBy] = useState("");
  const [quantities, setQuantities] = useState<Record<string, MultiUnitValues>>({});
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<MultiUnitValues>(EMPTY_MULTI);
  const [operators, setOperators] = useState<string[]>(() => getOperators());
  const [showAdded, setShowAdded] = useState(true);
  const { data: configs } = useProductUnitConfigs();

  const allProducts = getProducts();
  const productIds = reqType === "salle" ? REQUISITION_SALLE_IDS : REQUISITION_EMPORTER_IDS;
  const products = productIds
    .map((id) => allProducts.find((p) => p.id === id))
    .filter(Boolean) as typeof allProducts;

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const { data: existing } = useRequisitionsByDate(date, reqType);
  const existingMap: Record<string, number> = {};
  (existing || []).forEach((r) => { existingMap[r.productId] = (existingMap[r.productId] || 0) + r.quantity; });

  const handleSubmitAll = async () => {
    const entries = Object.entries(quantities)
      .map(([pid, v]) => {
        const cfg = configs?.[pid] || DEFAULT_UNIT_CONFIG;
        return { pid, total: totalPieces(v, cfg), unitUsed: dominantUnit(v, cfg) };
      })
      .filter((e) => e.total > 0);
    if (entries.length === 0) {
      toast.error("Aucune quantité saisie");
      return;
    }
    if (!performedBy.trim()) {
      toast.error("Veuillez saisir le prénom de la personne");
      return;
    }

    setSubmitting(true);
    try {
      const operatorName = performedBy.trim();
      for (const { pid: productId, total, unitUsed } of entries) {
        const product = allProducts.find((p) => p.id === productId);
        if (!product) continue;
        await saveRequisition({
          date,
          type: reqType,
          productId,
          productName: product.name,
          quantity: total,
          performedBy: operatorName,
          unitUsed,
        });
      }
      setOperators(rememberOperator(operatorName));
      toast.success(`${entries.length} réquisition(s) enregistrée(s) — sorties créées automatiquement`);
      setQuantities({});
      onUpdated();
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSingleSave = async (productId: string) => {
    const product = allProducts.find((pr) => pr.id === productId);
    if (!product) return;
    if (!performedBy.trim()) {
      toast.error("Veuillez saisir le prénom de la personne");
      return;
    }
    const cfg = configs?.[productId] || DEFAULT_UNIT_CONFIG;
    const v = quantities[productId] || EMPTY_MULTI;
    const total = totalPieces(v, cfg);
    if (total <= 0) {
      toast.error("Quantité invalide");
      return;
    }
    try {
      const operatorName = performedBy.trim();
      await saveRequisition({
        date,
        type: reqType,
        productId,
        productName: product.name,
        quantity: total,
        performedBy: operatorName,
        unitUsed: dominantUnit(v, cfg),
      });
      setOperators(rememberOperator(operatorName));
      toast.success(`${product.name} enregistré`);
      setQuantities((q) => ({ ...q, [productId]: EMPTY_MULTI }));
      onUpdated();
    } catch (err) {
      toast.error("Erreur");
      console.error(err);
    }
  };

  const startEdit = (productId: string, currentQty: number) => {
    setEditingId(productId);
    setEditValue({ cartons: "", paquets: "", pieces: currentQty > 0 ? String(currentQty) : "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue(EMPTY_MULTI);
  };

  const saveEdit = async (productId: string) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;
    const val = Number(editValue.pieces || 0);
    if (isNaN(val) || val < 0) {
      toast.error("Quantité invalide");
      return;
    }
    if (!performedBy.trim()) {
      toast.error("Veuillez saisir le prénom de la personne");
      return;
    }
    try {
      const operatorName = performedBy.trim();
      await setRequisitionTotal(date, reqType, productId, product.name, val, operatorName);
      setOperators(rememberOperator(operatorName));
      toast.success(`${product.name} mis à jour`);
      setEditingId(null);
      setEditValue(EMPTY_MULTI);
      onUpdated();
    } catch (err) {
      toast.error("Erreur lors de la mise à jour");
      console.error(err);
    }
  };

  const handleDelete = async (productId: string) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;
    if (!confirm(`Supprimer la quantité demandée pour ${product.name} ?`)) return;
    try {
      await setRequisitionTotal(date, reqType, productId, product.name, 0, performedBy.trim() || undefined);
      toast.success(`${product.name} supprimé`);
      setEditingId(null);
      setEditValue(EMPTY_MULTI);
      onUpdated();
    } catch (err) {
      toast.error("Erreur lors de la suppression");
      console.error(err);
    }
  };

  return (
    <div className="bg-card rounded-lg border animate-fade-in">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Réquisition
            </h2>
            <p className="text-xs text-muted-foreground">Les quantités saisies seront ajoutées comme sorties</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => { setReqType("salle"); setQuantities({}); }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                reqType === "salle" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              🏪 Salle
            </button>
            <button
              onClick={() => { setReqType("emporter"); setQuantities({}); }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                reqType === "emporter" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              🛍️ Emporter
            </button>
          </div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Input
            type="text"
            placeholder="Effectué par (prénom)"
            value={performedBy}
            onChange={(e) => setPerformedBy(e.target.value)}
            list="req-operators-list"
            autoComplete="off"
            className="w-full sm:w-48"
          />
          <datalist id="req-operators-list">
            {operators.map((o) => <option key={o} value={o} />)}
          </datalist>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un produit..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAdded((v) => !v)}
            className="gap-1.5"
          >
            {showAdded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showAdded ? "Masquer" : "Afficher"} qté demandée
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-72">Qté demandée</th>
              {showAdded && (
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-56">Qté demandée (pièces)</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const cfg = configs?.[p.id] || DEFAULT_UNIT_CONFIG;
              const val = quantities[p.id] || EMPTY_MULTI;
              const total = totalPieces(val, cfg);
              const pieceLbl = getPieceLabel(p.id);
              return (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="p-3 text-sm font-medium">{p.name}</td>
                <td className="p-3">
                  <div className="flex items-end gap-2 justify-end">
                    <MultiUnitInput
                      config={cfg}
                      values={val}
                      onChange={(nv) => setQuantities((q) => ({ ...q, [p.id]: nv }))}
                      size="sm"
                      pieceLabel={pieceLbl.plural}
                      paquetLabel={(PAQUET_LABEL_OVERRIDES[p.id] || "Paquets")}
                      showTotal={false}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-2 text-xs"
                      disabled={total <= 0}
                      onClick={() => handleSingleSave(p.id)}
                    >
                      ✓
                    </Button>
                  </div>
                </td>
                {showAdded && (
                <td className="p-3 text-right">
                  {editingId === p.id ? (
                    <div className="flex items-center gap-1 justify-end">
                      <Input
                        type="number"
                        min="0"
                        autoFocus
                        value={editValue.pieces}
                        onChange={(e) => setEditValue({ cartons: "", paquets: "", pieces: e.target.value })}
                        className="h-8 w-20 font-mono text-right text-sm"
                      />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveEdit(p.id)}>
                        <Check className="h-3.5 w-3.5 text-success" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    (() => {
                      const existingTotal = existingMap[p.id] || 0;
                      const decomposed = piecesToMulti(existingTotal, cfg);
                      const parts: string[] = [];
                      if (cfg.cartonEnabled && decomposed.cartons) parts.push(`${decomposed.cartons} cart.`);
                      if (cfg.paquetEnabled && decomposed.paquets) parts.push(`${decomposed.paquets} paq.`);
                      if (decomposed.pieces) parts.push(`${decomposed.pieces} ${pieceLbl.short}`);
                      const breakdown = parts.length > 0 ? parts.join(" + ") : `0 ${pieceLbl.short}`;
                      return (
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => startEdit(p.id, existingTotal)}
                            className="inline-flex flex-col items-end gap-0.5 font-mono text-sm font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                            title="Modifier la quantité"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {breakdown}
                              <Pencil className="h-3 w-3 opacity-60" />
                            </span>
                            <span className="text-[10px] font-normal text-primary/70">= {existingTotal} {pieceLbl.short}</span>
                          </button>
                          {existingTotal > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => handleDelete(p.id)}
                              title="Supprimer la quantité"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      );
                    })()
                  )}
                </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
