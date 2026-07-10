import { useState } from "react";
import { useMovements, useProductUnitConfigs, useAllRequisitions } from "@/hooks/useStockData";
import { deleteMovement, formatQuantityForProduct, saveMovement } from "@/lib/stockData";
import { isRequisitionProduct } from "@/lib/requisitionData";
import { ArrowDownCircle, ArrowUpCircle, Trash2, Filter, X, ChevronDown, Send, Undo2, CheckCircle2, ClipboardList, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpeg";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { ENABLE_TRANSFERTS, ENABLE_REQUISITION_BADGE, ENABLE_MOVEMENT_TIME } from "@/lib/featureFlags";
import { formatDateFR } from "@/lib/utils";
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
  const [reintegratingId, setReintegratingId] = useState<string | null>(null);
  const { can } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDestination, setFilterDestination] = useState<string>("all");
  const [filterPerformedBy, setFilterPerformedBy] = useState<string>("all");

  const { data: movements, loading } = useMovements();
  const { data: configs } = useProductUnitConfigs();
  const { data: requisitions } = useAllRequisitions();

  // Set des clés "date|productId|category" pour identifier les sorties issues
  // d'une réquisition (la sortie est créée avec la même date et le même produit
  // par saveRequisition / setRequisitionTotal).
  const requisitionKeys = new Set<string>(
    (requisitions || []).map((r) => {
      const category = r.type === "salle" ? "alimentaire" : "emballage";
      return `${r.date}|${r.productId}|${category}`;
    })
  );
  const isFromRequisition = (m: { date: string; productId: string; category: string; type: string; destination?: string | null }) => {
    if (m.type !== "sortie") return false;
    if (m.destination) return false; // exclut transferts / Direction
    return requisitionKeys.has(`${m.date.slice(0, 10)}|${m.productId}|${m.category}`);
  };

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
  const destinationOptions = Array.from(
    new Set(
      sorted
        .map((m) => m.destination)
        .filter((d): d is string => !!d && !d.startsWith("✓"))
        .map((d) => d.replace(/^Retour\s+/, "").replace(/^Reçu de\s+/, "").replace(/^Renvoi →\s+/, ""))
    )
  ).sort();

  const normalizeDestination = (d: string) =>
    d.replace(/^✓\s*/, "").replace(/^Retour\s+/, "").replace(/^Reçu de\s+/, "").replace(/^Renvoi →\s+/, "");

  const filtered = sorted.filter((m) => {
    const mDate = m.date.slice(0, 10);
    if (filterDate && mDate !== filterDate) return false;
    if (filterStartDate && mDate < filterStartDate) return false;
    if (filterEndDate && mDate > filterEndDate) return false;
    if (filterProduct !== "all" && m.productId !== filterProduct) return false;
    if (filterType !== "all") {
      if (filterType === "transfert") {
        // Transferts en cours uniquement : sorties vers une destination ou reçus d'une destination,
        // excluant les transferts clôturés (✓), les retours de prêts (Retour X) et les retours d'emprunts (Renvoi → X).
        if (!m.destination || m.destination === "Mr Hassan" || m.destination === "Direction" || m.destination.startsWith("✓")) return false;
        if (m.destination.startsWith("Retour ") || m.destination.startsWith("Renvoi → ")) return false;
      } else if (filterType === "hassan") {
        if (m.destination !== "Mr Hassan" && m.destination !== "Direction") return false;
      } else if (filterType === "sortie") {
        // Sorties "pures" (hors transferts, hors renvois, hors Direction)
        if (m.type !== "sortie" || m.destination) return false;
      } else if (filterType === "renvoi") {
        // Renvois : retour de produits que j'ai empruntés (sortie « Renvoi → X »)
        if (m.type !== "sortie" || !(m.destination || "").startsWith("Renvoi")) return false;
      } else if (filterType === "recu") {
        // Reçus : retour de produits que j'ai prêtés (entrée « Retour X »)
        if (m.type !== "entree" || !(m.destination || "").startsWith("Retour ")) return false;
      } else if (m.type !== filterType) {
        return false;
      }
    }
    if (filterDestination !== "all") {
      if (!m.destination) return false;
      const nd = normalizeDestination(m.destination);
      if (nd !== filterDestination) return false;
    }
    if (filterPerformedBy !== "all" && (m.performedBy || "") !== filterPerformedBy) return false;
    return true;
  });


  const hasFilters =
    !!filterDate ||
    !!filterStartDate ||
    !!filterEndDate ||
    filterProduct !== "all" ||
    filterType !== "all" ||
    filterDestination !== "all" ||
    filterPerformedBy !== "all";

  const resetFilters = () => {
    setFilterDate("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterProduct("all");
    setFilterType("all");
    setFilterDestination("all");
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

  const handleReintegrate = async (m: typeof filtered[number]) => {
    if (!m.destination) return;
    if (m.destination.startsWith("✓")) {
      toast.info("Ce mouvement a déjà été traité");
      return;
    }
    setReintegratingId(m.id);
    try {
      const isReceived = m.type === "entree" && m.destination.startsWith("Reçu de ");
      if (isReceived) {
        // Renvoyer un produit reçu = créer une sortie équivalente
        const origin = m.destination.replace(/^Reçu de\s+/, "");
        await saveMovement({
          date: new Date().toISOString().split("T")[0],
          productId: m.productId,
          productName: m.productName,
          category: m.category,
          type: "sortie",
          quantity: m.quantity,
          performedBy: m.performedBy,
          unitUsed: m.unitUsed,
          destination: `Renvoi → ${origin}`,
        });
        toast.success(`Produit renvoyé à ${origin} (-${formatQuantityForProduct(m.productId, m.quantity, configs?.[m.productId])})`);
      } else {
        // Recevoir un produit transféré = créer une entrée équivalente
        await saveMovement({
          date: new Date().toISOString().split("T")[0],
          productId: m.productId,
          productName: m.productName,
          category: m.category,
          type: "entree",
          quantity: m.quantity,
          performedBy: m.performedBy,
          unitUsed: m.unitUsed,
          destination: `Retour ${m.destination}`,
        });
        toast.success(`Quantité réintégrée au stock (+${formatQuantityForProduct(m.productId, m.quantity, configs?.[m.productId])})`);
      }
      // Marque le mouvement d'origine comme traité
      const { error } = await supabase
        .from("stock_movements")
        .update({ destination: `✓ ${m.destination}` })
        .eq("id", m.id);
      if (error) throw error;
      onMovementDeleted?.();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'opération");
    } finally {
      setReintegratingId(null);
    }
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
      {ENABLE_TRANSFERTS && (
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between gap-2">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
            <Filter className="h-4 w-4 text-primary" />
            Filtres
            {hasFilters && (
              <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-semibold">
                actifs
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                filtersOpen ? "rotate-180" : ""
              }`}
            />
          </CollapsibleTrigger>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Réinitialiser
            </button>
          )}
        </div>
        <CollapsibleContent>
          <div className="p-3 border-b bg-muted/20 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Date</label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Du</label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Au</label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Produit</label>
              <Select value={filterProduct} onValueChange={setFilterProduct}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent className="max-h-72 bg-popover z-50">
                  <SelectItem value="all">Tous</SelectItem>
                  {productOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="entree">Entrées</SelectItem>
                  <SelectItem value="sortie">Sorties</SelectItem>
                  {ENABLE_TRANSFERTS && (
                    <>
                      <SelectItem value="transfert">Transferts (en cours)</SelectItem>
                      <SelectItem value="recu">Retours de prêts (reçus)</SelectItem>
                      <SelectItem value="renvoi">Retours d'emprunts (renvoyés)</SelectItem>
                      <SelectItem value="hassan">Direction</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Destination des transferts</label>
              <Select value={filterDestination} onValueChange={setFilterDestination}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent className="max-h-72 bg-popover z-50">
                  <SelectItem value="all">Toutes les destinations</SelectItem>
                  {destinationOptions.map((dest) => (
                    <SelectItem key={dest} value={dest}>
                      {dest}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Par</label>
              <Select value={filterPerformedBy} onValueChange={setFilterPerformedBy}>
                <SelectTrigger className="h-8 text-xs">

                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent className="max-h-72 bg-popover z-50">
                  <SelectItem value="all">Tous</SelectItem>
                  {operatorOptions.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      )}

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
                <td className="p-3 text-sm font-mono">
                  <div className="flex flex-col leading-tight">
                    <span>{formatDateFR(m.date)}</span>
                    {ENABLE_MOVEMENT_TIME && m.createdAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(m.createdAt).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  {m.source === "regularisation" ? (
                    <div className="flex flex-col gap-0.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        m.type === "entree" ? "text-success" : "text-destructive"
                      }`}>
                        <Settings2 className="h-3.5 w-3.5" />
                        Régularisation des stocks
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {m.type === "entree" ? "Sorties − " : "Sorties + "}{m.quantity}
                      </span>
                    </div>
                  ) : m.destination ? (
                    <div className="flex flex-col">
                      {m.type === "entree" && m.destination.startsWith("Retour ") ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <Undo2 className="h-3 w-3" />
                            Retour
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            ← {m.destination.replace(/^Retour\s+/, "").replace(/^✓\s*/, "")}
                          </span>
                        </>
                      ) : m.type === "entree" && m.destination.replace(/^✓\s*/, "").startsWith("Reçu de ") ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <ArrowDownCircle className="h-3 w-3" />
                            Reçu
                            {m.destination.startsWith("✓") && (
                              <CheckCircle2 className="h-3 w-3 text-primary" />
                            )}
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            ← {m.destination.replace(/^✓\s*/, "").replace(/^Reçu de\s+/, "")}
                          </span>
                        </>
                      ) : m.type === "sortie" && m.destination.replace(/^✓\s*/, "").startsWith("Renvoi → ") ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                            <Undo2 className="h-3 w-3" />
                            Renvoi
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            → {m.destination.replace(/^✓\s*/, "").replace(/^Renvoi →\s+/, "")}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                            <Send className="h-3 w-3" />
                            {(m.destination.replace(/^✓\s*/, "")) === "Mr Hassan" || (m.destination.replace(/^✓\s*/, "")) === "Direction" ? "Direction" : "Transfert"}
                            {m.destination.startsWith("✓") && (
                              <CheckCircle2 className="h-3 w-3 text-success" />
                            )}
                          </span>
                          {m.destination.replace(/^✓\s*/, "") !== "Mr Hassan" && m.destination.replace(/^✓\s*/, "") !== "Direction" && (
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              → {m.destination.replace(/^✓\s*/, "")}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        m.type === "entree" ? "text-success" : "text-destructive"
                      }`}>
                        {m.type === "entree" ? <ArrowDownCircle className="h-3.5 w-3.5" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
                        {m.type === "entree" ? "Entrée" : "Sortie"}
                      </span>
                      {ENABLE_REQUISITION_BADGE && isFromRequisition(m) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded w-fit">
                          <ClipboardList className="h-3 w-3" />
                          Réquisition
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-3 text-sm">{m.productName}</td>
                <td className="p-3 hidden sm:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    m.category === "alimentaire" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent-foreground"
                  }`}>
                    {m.category === "alimentaire" ? "Alim." : "Emb."}
                  </span>
                </td>
                <td className="p-3 text-right font-mono text-sm font-semibold">
                  {formatQuantityForProduct(m.productId, m.quantity, configs?.[m.productId])}
                </td>
                <td className="p-3 text-sm">
                  {m.performedBy ? (
                    <span className="text-foreground">{m.performedBy}</span>
                  ) : (
                    <span className="text-muted-foreground italic text-xs">—</span>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex items-center justify-end gap-1">
                  {ENABLE_TRANSFERTS && m.destination && (
                    (m.type === "sortie" && !m.destination.replace(/^✓\s*/, "").startsWith("Renvoi → ")) ||
                    (m.type === "entree" && m.destination.replace(/^✓\s*/, "").startsWith("Reçu de "))
                  ) && (
                    <button
                      onClick={() => handleReintegrate(m)}
                      disabled={m.destination.startsWith("✓") || reintegratingId === m.id}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-success hover:bg-success/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                      title={
                        m.destination.startsWith("✓")
                          ? "Déjà traité"
                          : m.type === "entree"
                          ? "Renvoyer le produit à sa provenance"
                          : "Recevoir / réintégrer la quantité au stock"
                      }
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (can("delete_movements")) {
                        setDeleteId(m.id);
                      } else {
                        toast.error("Opération non autorisée");
                      }
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  </div>
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
                  Mouvement : {movementToDelete.type === "entree" ? "Entrée" : "Sortie"} — {movementToDelete.productName} ({formatQuantityForProduct(movementToDelete.productId, movementToDelete.quantity, configs?.[movementToDelete.productId])})
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
