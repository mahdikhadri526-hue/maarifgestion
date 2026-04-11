import { getMovements } from "@/lib/stockData";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export function MovementHistory() {
  const movements = getMovements().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="bg-card rounded-lg border animate-fade-in">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Historique des Mouvements</h2>
        <p className="text-xs text-muted-foreground mt-1">{movements.length} mouvements enregistrés</p>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produit</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Catégorie</th>
              <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quantité</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
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
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    m.category === "alimentaire"
                      ? "bg-primary/10 text-primary"
                      : "bg-accent/10 text-accent-foreground"
                  }`}>
                    {m.category === "alimentaire" ? "Alim." : "Emb."}
                  </span>
                </td>
                <td className="p-3 text-right font-mono text-sm font-semibold">{m.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {movements.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Aucun mouvement enregistré</p>
        )}
      </div>
    </div>
  );
}
