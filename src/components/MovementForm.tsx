import { useState } from "react";
import { Category, getProducts, saveMovement, DEFAULT_UNIT_CONFIG } from "@/lib/stockData";
import { addLotEntry, consumeFromLots } from "@/lib/lotData";
import { useProductUnitConfigs } from "@/hooks/useStockData";
import { getOperators, rememberOperator } from "@/lib/operators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { MultiUnitInput, MultiUnitValues, EMPTY_MULTI, totalPieces, dominantUnit } from "./MultiUnitInput";

interface MovementFormProps {
  onMovementAdded: () => void;
}

export function MovementForm({ onMovementAdded }: MovementFormProps) {
  const [type, setType] = useState<"entree" | "sortie">("entree");
  const [category, setCategory] = useState<Category>("alimentaire");
  const [productId, setProductId] = useState("");
  const [multi, setMulti] = useState<MultiUnitValues>(EMPTY_MULTI);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [operators, setOperators] = useState<string[]>(() => getOperators());
  const [submitting, setSubmitting] = useState(false);

  const products = getProducts(category);
  const selectedProduct = products.find((p) => p.id === productId);
  const isAlimentaire = category === "alimentaire";
  const { data: configs } = useProductUnitConfigs();
  const config = configs?.[productId] || DEFAULT_UNIT_CONFIG;
  const totalQty = totalPieces(multi, config);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || totalQty <= 0) {
      toast.error("Veuillez remplir tous les champs correctement");
      return;
    }

    if (!performedBy.trim()) {
      toast.error("Veuillez saisir le prénom de la personne");
      return;
    }

    if (isAlimentaire && type === "entree" && (!lotNumber || !expiryDate)) {
      toast.error("Veuillez saisir le numéro de lot et la date limite de consommation");
      return;
    }

    setSubmitting(true);
    try {
      const operatorName = performedBy.trim();
      const unitUsed = dominantUnit(multi, config);
      await saveMovement({
        date,
        productId,
        productName: selectedProduct?.name || "",
        category,
        type,
        quantity: totalQty,
        performedBy: operatorName,
        unitUsed,
      });
      setOperators(rememberOperator(operatorName));

      if (isAlimentaire) {
        if (type === "entree") {
          await addLotEntry({
            productId,
            lotNumber,
            expiryDate,
            quantity: totalQty,
            entryDate: date,
          });
          toast.success(`Entrée de ${totalQty} pièces ${selectedProduct?.name} (Lot: ${lotNumber}) enregistrée`);
        } else {
          const consumed = await consumeFromLots(productId, totalQty);
          if (consumed.length > 0) {
            const lotInfo = consumed.map((c) => `${c.lotNumber}: ${c.consumed}`).join(", ");
            toast.success(`Sortie FIFO de ${totalQty} pièces ${selectedProduct?.name} — Lots: ${lotInfo}`);
          } else {
            toast.success(`Sortie de ${totalQty} pièces ${selectedProduct?.name} enregistrée (aucun lot disponible)`);
          }
        }
      } else {
        toast.success(`${type === "entree" ? "Entrée" : "Sortie"} de ${totalQty} pièces ${selectedProduct?.name} enregistrée`);
      }

      setProductId("");
      setMulti(EMPTY_MULTI);
      setLotNumber("");
      setExpiryDate("");
      onMovementAdded();
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border p-5 animate-fade-in">
      <h2 className="text-lg font-semibold mb-4">Nouveau Mouvement</h2>
      
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setType("entree")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
            type === "entree" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Plus className="h-4 w-4" /> Entrée
        </button>
        <button
          type="button"
          onClick={() => setType("sortie")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
            type === "sortie" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Minus className="h-4 w-4" /> Sortie
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Effectué par (prénom)</label>
          <Input
            type="text"
            placeholder="Ex: Karim"
            value={performedBy}
            onChange={(e) => setPerformedBy(e.target.value)}
            list="operators-list"
            autoComplete="off"
          />
          <datalist id="operators-list">
            {operators.map((o) => <option key={o} value={o} />)}
          </datalist>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Catégorie</label>
          <Select value={category} onValueChange={(v) => { setCategory(v as Category); setProductId(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alimentaire">Alimentaire</SelectItem>
              <SelectItem value="emballage">Emballage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Produit</label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Quantité
          </label>
          {productId ? (
            <MultiUnitInput config={config} values={multi} onChange={setMulti} />
          ) : (
            <p className="text-xs text-muted-foreground italic">Sélectionnez un produit d'abord</p>
          )}
        </div>

        {isAlimentaire && type === "entree" && (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">N° de Lot</label>
              <Input type="text" placeholder="Ex: LOT-2026-001" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Date Limite de Consommation (DLC)</label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </>
        )}

        {isAlimentaire && type === "sortie" && (
          <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
            <p className="text-xs text-primary font-medium">
              ℹ️ FIFO : Les sorties seront automatiquement déduites des lots les plus anciens.
            </p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </form>
    </div>
  );
}
