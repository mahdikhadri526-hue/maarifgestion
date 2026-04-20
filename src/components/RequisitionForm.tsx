import { useState } from "react";
import { getProducts, UnitType } from "@/lib/stockData";
import { saveRequisition, setRequisitionTotal, REQUISITION_SALLE_IDS, REQUISITION_EMPORTER_IDS } from "@/lib/requisitionData";
import { useRequisitionsByDate, useProductUnits } from "@/hooks/useStockData";
import { getOperators, rememberOperator } from "@/lib/operators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ClipboardList, Search, Pencil, Check, X } from "lucide-react";
import logo from "@/assets/logo.jpeg";
import { VoiceButton } from "@/components/VoiceButton";

function findProductByVoice(spoken: string, products: { id: string; name: string }[]): string | null {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ");
  const target = norm(spoken);
  if (!target.trim()) return null;
  const targetWords = target.split(/\s+/).filter(Boolean);
  let best: { id: string; score: number } | null = null;
  for (const p of products) {
    const name = norm(p.name);
    let score = 0;
    if (name.includes(target)) score += 100;
    for (const w of targetWords) {
      if (w.length >= 3 && name.includes(w)) score += 10;
    }
    if (!best || score > best.score) best = { id: p.id, score };
  }
  return best && best.score > 0 ? best.id : null;
}

interface Props {
  onUpdated: () => void;
}

export function RequisitionForm({ onUpdated }: Props) {
  const UNIT_LABELS: Record<UnitType, string> = { PIECE: "Pièce", KILO: "Kilo", LITRE: "Litre" };
  const [reqType, setReqType] = useState<"salle" | "emporter">("salle");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [performedBy, setPerformedBy] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [operators, setOperators] = useState<string[]>(() => getOperators());
  const { data: units } = useProductUnits();

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
    const entries = Object.entries(quantities).filter(([, v]) => Number(v) > 0);
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
      for (const [productId, qty] of entries) {
        const product = allProducts.find((p) => p.id === productId);
        if (!product) continue;
        await saveRequisition({
          date,
          type: reqType,
          productId,
          productName: product.name,
          quantity: Number(qty),
          performedBy: operatorName,
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
    try {
      const operatorName = performedBy.trim();
      await saveRequisition({
        date,
        type: reqType,
        productId,
        productName: product.name,
        quantity: Number(quantities[productId]),
        performedBy: operatorName,
      });
      setOperators(rememberOperator(operatorName));
      toast.success(`${product.name} enregistré`);
      setQuantities((q) => ({ ...q, [productId]: "" }));
      onUpdated();
    } catch (err) {
      toast.error("Erreur");
      console.error(err);
    }
  };

  const startEdit = (productId: string, currentQty: number) => {
    setEditingId(productId);
    setEditValue(String(currentQty));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (productId: string) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;
    const val = Number(editValue);
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
      setEditValue("");
      onUpdated();
    } catch (err) {
      toast.error("Erreur lors de la mise à jour");
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
        </div>
      </div>

      <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">Unité</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">Qté demandée</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">Qté rajoutée</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="p-3 text-sm font-medium">{p.name}</td>
                <td className="p-3 text-xs text-muted-foreground">{UNIT_LABELS[(units?.[p.id] as UnitType) || "PIECE"]}</td>
                <td className="p-3 text-right">
                  {editingId === p.id ? (
                    <div className="flex items-center gap-1 justify-end">
                      <Input
                        type="number" min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="font-mono text-right w-20 h-8"
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveEdit(p.id)}>
                        <Check className="h-3.5 w-3.5 text-success" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(p.id, existingMap[p.id] || 0)}
                      className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                      title="Modifier la quantité"
                    >
                      {existingMap[p.id] || 0}
                      <Pencil className="h-3 w-3 opacity-60" />
                    </button>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Input
                      type="number" min="0"
                      value={quantities[p.id] || ""}
                      onChange={(e) => setQuantities((q) => ({ ...q, [p.id]: e.target.value }))}
                      className="font-mono text-right w-20"
                      placeholder="0"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-2 text-xs"
                      disabled={!quantities[p.id] || Number(quantities[p.id]) <= 0}
                      onClick={() => handleSingleSave(p.id)}
                    >
                      ✓
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t">
        <Button onClick={handleSubmitAll} className="w-full" disabled={submitting}>
          {submitting ? "Enregistrement..." : "Enregistrer tout"}
        </Button>
      </div>
    </div>
  );
}
