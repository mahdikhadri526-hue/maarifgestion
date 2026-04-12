import { useState } from "react";
import { getMovements, deleteMovement } from "@/lib/stockData";
import { isRequisitionProduct } from "@/lib/requisitionData";
import { ArrowDownCircle, ArrowUpCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.jpeg";
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const movements = getMovements().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const movementToDelete = movements.find((m) => m.id === deleteId);

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMovement(deleteId);
    toast.success("Mouvement supprimé");
    setDeleteId(null);
    setRefreshKey((k) => k + 1);
    onMovementDeleted?.();
  };

  return (
    <div className="bg-card rounded-lg border animate-fade-in" key={refreshKey}>
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          Historique des Mouvements
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{movements.length} mouvements enregistrés</p>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Catégorie</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qté</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                isRequisitionProduct(m.productId) ? "bg-amber-50 dark:bg-amber-950/20" : ""
              }`}>
                <td className="p-3 text-sm font-mono">{new Date(m.date).toLocaleDateString("fr-FR")}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                    m.type === "entree" ? "text-success" : "text-destructive"
                  }`}>
                    {m.type === "entree" ? (
                      <ArrowDownCircle className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpCircle className="h-3.5 w-3.5" />
                    )}
                    {m.type === "entree" ? "Entrée" : "Sortie"}
                  </span>
                </td>
                <td className="p-3 text-sm">{m.productName}</td>
                <td className="p-3 hidden sm:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    m.category === "alimentaire"
                      ? "bg-primary/10 text-primary"
                      : "bg-accent/10 text-accent-foreground"
                  }`}>
                    {m.category === "alimentaire" ? "Alim." : "Emb."}
                  </span>
                </td>
                <td className="p-3 text-right font-mono text-sm font-semibold">{m.quantity}</td>
                <td className="p-2">
                  <button
                    onClick={() => setDeleteId(m.id)}
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
        {movements.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Aucun mouvement enregistré</p>
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
                  {movementToDelete.type === "entree" ? "Entrée" : "Sortie"} de {movementToDelete.quantity} × {movementToDelete.productName}
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
    </div>
  );
}
