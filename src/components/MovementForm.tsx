import { useState } from "react";
import { Category, getProducts, saveMovement } from "@/lib/stockData";
import { addLotEntry, consumeFromLots } from "@/lib/lotData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus } from "lucide-react";
import { toast } from "sonner";

interface MovementFormProps {
  onMovementAdded: () => void;
}

export function MovementForm({ onMovementAdded }: MovementFormProps) {
  const [type, setType] = useState<"entree" | "sortie">("entree");
  const [category, setCategory] = useState<Category>("alimentaire");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const products = getProducts(category);
  const selectedProduct = products.find((p) => p.id === productId);
  const isAlimentaire = category === "alimentaire";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !quantity || Number(quantity) <= 0) {
      toast.error("Veuillez remplir tous les champs correctement");
      return;
    }

    // For food entries, lot number and expiry date are required
    if (isAlimentaire && type === "entree" && (!lotNumber || !expiryDate)) {
      toast.error("Veuillez saisir le numéro de lot et la date limite de consommation");
      return;
    }

    // Save the movement
    saveMovement({
      date,
      productId,
      productName: selectedProduct?.name || "",
      category,
      type,
      quantity: Number(quantity),
    });

    // Handle lot tracking for food products
    if (isAlimentaire) {
      if (type === "entree") {
        addLotEntry({
          productId,
          lotNumber,
          expiryDate,
          quantity: Number(quantity),
          entryDate: date,
        });
        toast.success(
          `Entrée de ${quantity} ${selectedProduct?.name} (Lot: ${lotNumber}) enregistrée`
        );
      } else {
        const consumed = consumeFromLots(productId, Number(quantity));
        if (consumed.length > 0) {
          const lotInfo = consumed.map((c) => `${c.lotNumber}: ${c.consumed}`).join(", ");
          toast.success(
            `Sortie FIFO de ${quantity} ${selectedProduct?.name} — Lots: ${lotInfo}`
          );
        } else {
          toast.success(
            `Sortie de ${quantity} ${selectedProduct?.name} enregistrée (aucun lot disponible)`
          );
        }
      }
    } else {
      toast.success(
        `${type === "entree" ? "Entrée" : "Sortie"} de ${quantity} ${selectedProduct?.name} enregistrée`
      );
    }

    setProductId("");
    setQuantity("");
    setLotNumber("");
    setExpiryDate("");
    onMovementAdded();
  };

  return (
    <div className="bg-card rounded-lg border p-5 animate-fade-in">
      <h2 className="text-lg font-semibold mb-4">Nouveau Mouvement</h2>
      
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setType("entree")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
            type === "entree"
              ? "bg-success text-success-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Plus className="h-4 w-4" /> Entrée
        </button>
        <button
          type="button"
          onClick={() => setType("sortie")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
            type === "sortie"
              ? "bg-destructive text-destructive-foreground"
              : "bg-muted text-muted-foreground"
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
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Catégorie</label>
          <Select value={category} onValueChange={(v) => { setCategory(v as Category); setProductId(""); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alimentaire">Alimentaire</SelectItem>
              <SelectItem value="emballage">Emballage</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Produit</label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un produit" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantité</label>
          <Input
            type="number"
            min="1"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="font-mono"
          />
        </div>

        {/* Lot fields for food products on entry */}
        {isAlimentaire && type === "entree" && (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">N° de Lot</label>
              <Input
                type="text"
                placeholder="Ex: LOT-2026-001"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Date Limite de Consommation (DLC)</label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </>
        )}

        {/* FIFO notice for food exits */}
        {isAlimentaire && type === "sortie" && (
          <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
            <p className="text-xs text-primary font-medium">
              ℹ️ FIFO : Les sorties seront automatiquement déduites des lots les plus anciens.
            </p>
          </div>
        )}

        <Button type="submit" className="w-full">
          Enregistrer
        </Button>
      </form>
    </div>
  );
}
