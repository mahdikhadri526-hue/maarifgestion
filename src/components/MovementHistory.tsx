import { useState } from "react";
import { useMovements, useProductUnitConfigs } from "@/hooks/useStockData";
import { deleteMovement, formatQuantityForProduct } from "@/lib/stockData";
import { isRequisitionProduct } from "@/lib/requisitionData";
import { ArrowDownCircle, ArrowUpCircle, Trash2, Filter, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.jpeg";
import { PinPromptDialog } from "./PinPromptDialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MovementHistoryProps {
  onMovementDeleted?: () => void;
}

export function MovementHistory({ onMovementDeleted }: MovementHistoryProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPerformedBy, setFilterPerformedBy] = useState<string>("all");
  const { data: movements, loading } = useMovements();
  const { data: configs } = useProductUnitConfigs();

  const sorted = [...(movements || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Unique products & operators for select options
  const productOptions = Array.from(
    new Map(sorted.map((m) => [m.productId, m.productName])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));
  const operatorOptions = Array.from(
    new Set(sorted.map((m) => m.performedBy).filter((v): v is string => !!v))
  ).sort();

  const filtered = sorted.filter((m) => {
    const mDate = m.date.slice(0, 10);
    if (filterDate && mDate !== filterDate) return false;
    if (filterStartDate && mDate < filterStartDate) return false;
    if (filterEndDate && mDate > filterEndDate) return false;
    if (filterProduct !== "all" && m.productId !== filterProduct) return false;
    if (filterType !== "all" && m.type !== filterType) return false;
    if (filterPerformedBy !== "all" && (m.performedBy || "") !== filterPerformedBy) return false;
    return true;
  });

  const hasFilters =
    !!filterDate ||
    !!filterStartDate ||
    !!filterEndDate ||
    filterProduct !== "all" ||
    filterType !== "all" ||
    filterPerformedBy !== "all";

  const resetFilters = () => {
    setFilterDate("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterProduct("all");
    setFilterType("all");
    setFilterPerformedBy("all");
  };

  const movementToDelete = filtered.find((m) => m.id === deleteId);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMovement(deleteId);
    toast.success("Mouvement supprimé");
    setDeleteId(null);
    onMovementDeleted?.();
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;

  return (
    <div className="bg-card rounded-lg border animate-fade-in">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          Historique Mouvements
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {filtered.length} / {sorted.length} mouvements
        </p>
      </div>

      {/* Filters */}
      <div className="p-4 border-b bg-muted/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4 text-primary" />
            Filtres
          </div>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Réinitialiser
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Date précise</label>
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Période — du</label>
            <Input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Période — au</label>
            <Input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Produit</label>
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent className="max-h-72 bg-popover z-50">
                <SelectItem value="all">Tous les produits</SelectItem>
                {productOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Type</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Entrées + Sorties</SelectItem>
                <SelectItem value="entree">Entrées uniquement</SelectItem>
                <SelectItem value="sortie">Sorties uniquement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Effectué par</label>
            <Select value={filterPerformedBy} onValueChange={setFilterPerformedBy}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent className="max-h-72 bg-popover z-50">
                <SelectItem value="all">Tout le monde</SelectItem>
                {operatorOptions.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
               <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Catégorie</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quantité</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Effectué par</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                isRequisitionProduct(m.productId) ? "bg-amber-50 dark:bg-amber-950/20" : ""
              }`}>
                <td className="p-3 text-sm font-mono">{new Date(m.date).toLocaleDateString("fr-FR")}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                    m.type === "entree" ? "text-success" : "text-destructive"
                  }`}>
                    {m.type === "entree" ? <ArrowDownCircle className="h-3.5 w-3.5" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
                    {m.type === "entree" ? "Entrée" : "Sortie"}
                  </span>
                </td>
                <td className="p-3 text-sm">{m.productName}</td>
                <td className="p-3 hidden sm:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    m.category === "alimentaire" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent-foreground"
                  }`}>
                    {m.category === "alimentaire" ? "Alim." : "Emb."}
                  </span>
                </td>
                <td className="p-3 text-right font-mono text-sm font-semibold">{formatQuantityForProduct(m.productId, m.quantity, configs?.[m.productId])}</td>
                <td className="p-3 text-sm">
                  {m.performedBy ? (
                    <span className="text-foreground">{m.performedBy}</span>
                  ) : (
                    <span className="text-muted-foreground italic text-xs">—</span>
                  )}
                </td>
                <td className="p-2">
                  <button
                    onClick={() => setPendingDeleteId(m.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {sorted.length === 0 ? "Aucun mouvement enregistré" : "Aucun mouvement ne correspond aux filtres"}
          </p>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer ce mouvement ?
              {movementToDelete && (
                <span className="block mt-2 font-medium text-foreground">
                  {movementToDelete.type === "entree" ? "Entrée" : "Sortie"} de {formatQuantityForProduct(movementToDelete.productId, movementToDelete.quantity, configs?.[movementToDelete.productId])} × {movementToDelete.productName}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PinPromptDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Supprimer un mouvement"
        description="Entrez le code à 4 chiffres pour autoriser la suppression."
        onConfirm={() => {
          setDeleteId(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}
