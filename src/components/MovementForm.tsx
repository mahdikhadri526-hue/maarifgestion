import { useState } from "react";
import { Category, getProducts, saveMovement } from "@/lib/stockData";
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

  const products = getProducts(category);
  const selectedProduct = products.find((p) => p.id === productId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !quantity || Number(quantity) <= 0) {
      toast.error("Veuillez remplir tous les champs correctement");
      return;
    }

    saveMovement({
      date,
      productId,
      productName: selectedProduct?.name || "",
      category,
      type,
      quantity: Number(quantity),
    });

    toast.success(
      `${type === "entree" ? "Entrée" : "Sortie"} de ${quantity} ${selectedProduct?.name} enregistrée`
    );
    setProductId("");
    setQuantity("");
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

        <Button type="submit" className="w-full">
          Enregistrer
        </Button>
      </form>
    </div>
  );
}
