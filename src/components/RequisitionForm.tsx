import { useState } from "react";
import { getProducts } from "@/lib/stockData";
import { saveRequisition, REQUISITION_SALLE_IDS, REQUISITION_EMPORTER_IDS, getRequisitionsByDate } from "@/lib/requisitionData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ClipboardList, Search } from "lucide-react";
import logo from "@/assets/logo.jpeg";

interface Props {
  onUpdated: () => void;
}

export function RequisitionForm({ onUpdated }: Props) {
  const [reqType, setReqType] = useState<"salle" | "emporter">("salle");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const allProducts = getProducts();
  const productIds = reqType === "salle" ? REQUISITION_SALLE_IDS : REQUISITION_EMPORTER_IDS;
  const products = productIds
    .map((id) => allProducts.find((p) => p.id === id))
    .filter(Boolean) as typeof allProducts;

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const existing = getRequisitionsByDate(date, reqType);
  const existingMap: Record<string, number> = {};
  existing.forEach((r) => { existingMap[r.productId] = (existingMap[r.productId] || 0) + r.quantity; });

  const handleSubmitAll = () => {
    const entries = Object.entries(quantities).filter(([, v]) => Number(v) > 0);
    if (entries.length === 0) {
      toast.error("Aucune quantité saisie");
      return;
    }

    entries.forEach(([productId, qty]) => {
      const product = allProducts.find((p) => p.id === productId);
      if (!product) return;
      saveRequisition({
        date,
        type: reqType,
        productId,
        productName: product.name,
        quantity: Number(qty),
      });
    });

    toast.success(`${entries.length} réquisition(s) enregistrée(s) — sorties créées automatiquement`);
    setQuantities({});
    onUpdated();
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
                reqType === "salle"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              🏪 Salle
            </button>
            <button
              onClick={() => { setReqType("emporter"); setQuantities({}); }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                reqType === "emporter"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              🛍️ Emporter
            </button>
          </div>

          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">Déjà saisi</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32">Qté demandée</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="p-3 text-sm font-medium">{p.name}</td>
                <td className="p-3 text-right font-mono text-sm text-muted-foreground">
                  {existingMap[p.id] || 0}
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    min="0"
                    value={quantities[p.id] || ""}
                    onChange={(e) => setQuantities((q) => ({ ...q, [p.id]: e.target.value }))}
                    className="font-mono text-right w-28 ml-auto"
                    placeholder="0"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t">
        <Button onClick={handleSubmitAll} className="w-full">
          Enregistrer la réquisition
        </Button>
      </div>
    </div>
  );
}
