import { useState } from "react";
import { Category, getProducts, saveMovement, DEFAULT_UNIT_CONFIG, PAQUET_LABEL_OVERRIDES, HIDE_PIECE_PRODUCTS, getPieceLabelForProduct, getProductAvailableStockInBasePieces, formatQuantityForProduct } from "@/lib/stockData";
import { addLotEntry } from "@/lib/lotData";
import { useProductUnitConfigs } from "@/hooks/useStockData";
import { getOperators, rememberOperator } from "@/lib/operators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Send } from "lucide-react";
import { toast } from "sonner";
import { MultiUnitInput, MultiUnitValues, EMPTY_MULTI, totalPieces, dominantUnit } from "./MultiUnitInput";
import { ENABLE_TRANSFERTS } from "@/lib/featureFlags";

interface MovementFormProps {
  onMovementAdded: () => void;
}

export function MovementForm({ onMovementAdded }: MovementFormProps) {
  const [type, setType] = useState<"entree" | "sortie" | "transfert" | "hassan">("entree");
  const [category, setCategory] = useState<Category>("alimentaire");
  const [productId, setProductId] = useState("");
  const [multi, setMulti] = useState<MultiUnitValues>(EMPTY_MULTI);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [destination, setDestination] = useState("");
  const [operators, setOperators] = useState<string[]>(() => getOperators());
  const [submitting, setSubmitting] = useState(false);

  const products = getProducts(category);
  const selectedProduct = products.find((p) => p.id === productId);
  const isAlimentaire = category === "alimentaire";
  const { data: configs } = useProductUnitConfigs();
  const config = configs?.[productId] || DEFAULT_UNIT_CONFIG;
  const totalQty = totalPieces(multi, config);
  const unitLabel = selectedProduct
    ? getPieceLabelForProduct(selectedProduct.id, selectedProduct.name, selectedProduct.category).plural
    : "Pièces";
  const paquetLabel = productId ? (PAQUET_LABEL_OVERRIDES[productId] || "Paquets") : "Paquets";

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

    if (type === "transfert" && !destination.trim()) {
      toast.error("Veuillez saisir la destination du transfert");
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
      // Les transferts et "Direction" sont stockés comme des sorties pour que le calcul du stock reste correct
      const movementType: "entree" | "sortie" =
        type === "transfert" || type === "hassan" ? "sortie" : type;
      // Bloquer toute sortie qui dépasserait le stock disponible
      if (movementType === "sortie") {
        const available = await getProductAvailableStockInBasePieces(productId);
        if (totalQty > available) {
          const availableLabel = formatQuantityForProduct(productId, available, config);
          toast.error(`Stock insuffisant : seulement ${availableLabel} disponible(s) pour ${selectedProduct?.name}`);
          setSubmitting(false);
          return;
        }
      }
      const destinationValue =
        type === "transfert" ? destination.trim() : type === "hassan" ? "Direction" : undefined;
      await saveMovement({
        date,
        productId,
        productName: selectedProduct?.name || "",
        category,
        type: movementType,
        quantity: totalQty,
        performedBy: operatorName,
        unitUsed,
        destination: destinationValue,
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
        } else if (type === "sortie") {
          toast.success(`Sortie FIFO de ${totalQty} pièces ${selectedProduct?.name} enregistrée`);
        } else if (type === "transfert") {
          toast.success(`Transfert FIFO de ${totalQty} pièces ${selectedProduct?.name} → ${destination.trim()} enregistré`);
        } else {
          toast.success(`Sortie Direction de ${totalQty} pièces ${selectedProduct?.name} enregistrée`);
        }
      } else {
        const label =
          type === "entree"
            ? "Entrée"
            : type === "sortie"
            ? "Sortie"
            : type === "transfert"
            ? `Transfert → ${destination.trim()}`
            : "Sortie Direction";
        toast.success(`${label} de ${totalQty} pièces ${selectedProduct?.name} enregistré`);
      }

      setProductId("");
      setMulti(EMPTY_MULTI);
      setLotNumber("");
      setExpiryDate("");
      setDestination("");
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
      
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          type="button"
          onClick={() => setType("entree")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md text-xs font-medium transition-colors ${
            type === "entree" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Plus className="h-4 w-4" /> Entrée
        </button>
        <button
          type="button"
          onClick={() => setType("sortie")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md text-xs font-medium transition-colors ${
            type === "sortie" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Minus className="h-4 w-4" /> Sortie
        </button>
        {ENABLE_TRANSFERTS && (
          <>
            <button
              type="button"
              onClick={() => setType("transfert")}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md text-xs font-medium transition-colors ${
                type === "transfert" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <Send className="h-3.5 w-3.5" /> Transfert
            </button>
            <button
              type="button"
              onClick={() => setType("hassan")}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md text-xs font-medium transition-colors ${
                type === "hassan" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <Send className="h-3.5 w-3.5" /> Direction
            </button>
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Effectué par</label>
          <Select value={performedBy} onValueChange={setPerformedBy}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un opérateur" /></SelectTrigger>
            <SelectContent>
              {operators.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            <MultiUnitInput config={config} values={multi} onChange={setMulti} pieceLabel={unitLabel} paquetLabel={paquetLabel} showTotal={false} hidePiece={HIDE_PIECE_PRODUCTS.has(productId)} />
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

        {type === "transfert" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Destination du transfert
            </label>
            <Input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
            {isAlimentaire && (
              <p className="text-[11px] text-primary mt-1">
                ℹ️ FIFO : déduit des lots les plus anciens.
              </p>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </form>
    </div>
  );
}
