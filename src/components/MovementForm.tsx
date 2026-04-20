import { useState } from "react";
import { Category, getProducts, saveMovement, UnitType } from "@/lib/stockData";
import { addLotEntry, consumeFromLots } from "@/lib/lotData";
import { useProductUnits } from "@/hooks/useStockData";
import { getOperators, rememberOperator } from "@/lib/operators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus } from "lucide-react";
import { toast } from "sonner";
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

const UNIT_LABELS: Record<UnitType, string> = { PIECE: "Pièce", KILO: "Kilo", LITRE: "Litre" };

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
  const [performedBy, setPerformedBy] = useState("");
  const [operators, setOperators] = useState<string[]>(() => getOperators());
  const [submitting, setSubmitting] = useState(false);

  const products = getProducts(category);
  const selectedProduct = products.find((p) => p.id === productId);
  const isAlimentaire = category === "alimentaire";
  const { data: units } = useProductUnits();
  const selectedUnit = (units?.[productId] as UnitType) || "PIECE";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !quantity || Number(quantity) <= 0) {
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
      await saveMovement({
        date,
        productId,
        productName: selectedProduct?.name || "",
        category,
        type,
        quantity: Number(quantity),
        performedBy: operatorName,
      });
      setOperators(rememberOperator(operatorName));

      if (isAlimentaire) {
        if (type === "entree") {
          await addLotEntry({
            productId,
            lotNumber,
            expiryDate,
            quantity: Number(quantity),
            entryDate: date,
          });
          toast.success(`Entrée de ${quantity} ${selectedProduct?.name} (Lot: ${lotNumber}) enregistrée`);
        } else {
          const consumed = await consumeFromLots(productId, Number(quantity));
          if (consumed.length > 0) {
            const lotInfo = consumed.map((c) => `${c.lotNumber}: ${c.consumed}`).join(", ");
            toast.success(`Sortie FIFO de ${quantity} ${selectedProduct?.name} — Lots: ${lotInfo}`);
          } else {
            toast.success(`Sortie de ${quantity} ${selectedProduct?.name} enregistrée (aucun lot disponible)`);
          }
        }
      } else {
        toast.success(`${type === "entree" ? "Entrée" : "Sortie"} de ${quantity} ${selectedProduct?.name} enregistrée`);
      }

      setProductId("");
      setQuantity("");
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
          <div className="flex gap-2">
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <VoiceButton
              title="Dicter le nom du produit"
              onResult={(spoken) => {
                const id = findProductByVoice(spoken, products);
                if (id) {
                  setProductId(id);
                  const p = products.find((x) => x.id === id);
                  toast.success(`Produit : ${p?.name}`);
                } else {
                  toast.error(`Aucun produit trouvé pour "${spoken}"`);
                }
              }}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Quantité {productId && <span className="text-primary">({UNIT_LABELS[selectedUnit]})</span>}
          </label>
          <div className="flex gap-2">
            <Input type="number" min="1" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="font-mono" />
            <VoiceButton
              title="Dicter la quantité"
              parseNumber
              onResult={(value) => setQuantity(value)}
            />
          </div>
        </div>

        {isAlimentaire && type === "entree" && (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">N° de Lot</label>
              <div className="flex gap-2">
                <Input type="text" placeholder="Ex: LOT-2026-001" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
                <VoiceButton
                  title="Dicter le numéro de lot"
                  onResult={(value) => setLotNumber(value.toUpperCase().replace(/\s+/g, "-"))}
                />
              </div>
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
