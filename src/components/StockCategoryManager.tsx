import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStockCategories } from "@/hooks/useStockCategories";
import { supabase } from "@/integrations/supabase/client";
import { canDisplayAdminTable } from "@/lib/adminTableVisibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Layers, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { StockCategory } from "@/lib/stockCategories";

export function StockCategoryManager() {
  const { user, hasAdminRole } = useAuth();
  const { categories, pdvId, refresh } = useStockCategories();
  const [name, setName] = useState("");
  const [base, setBase] = useState("alimentaire");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (!canDisplayAdminTable(user?.email, hasAdminRole)) return null;
  const write = async (row: StockCategory) => {
    if (!pdvId || busy) return;
    const label = row.name.trim();
    if (!label) { toast.error("Nom de catégorie obligatoire"); return; }
    if (categories.some(c => c.category_key !== row.category_key && c.name.trim().toLocaleLowerCase("fr") === label.toLocaleLowerCase("fr"))) {
      toast.error("Ce nom de catégorie existe déjà"); return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("stock_categories").upsert({ ...row, name: label, pdv_id: pdvId }, { onConflict: "pdv_id,category_key" });
      if (error) throw error;
      await refresh();
      setName("");
      setDrafts({});
      toast.success("Catégories enregistrées");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible"); }
    finally { setBusy(false); }
  };
  return <Dialog><DialogTrigger asChild><Button variant="outline" size="sm" className="gap-2"><Layers className="h-4 w-4" />Catégories</Button></DialogTrigger>
    <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Gérer les catégories</DialogTitle></DialogHeader>
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Nouvelle catégorie" placeholder="Nom de catégorie" value={name} onChange={e => setName(e.target.value)} className="min-w-0 flex-1" />
        <Select value={base} onValueChange={setBase}><SelectTrigger className="w-36" aria-label="Type de catégorie"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="alimentaire">Alimentaire</SelectItem><SelectItem value="emballage">Emballage</SelectItem></SelectContent></Select>
        <Button size="icon" aria-label="Ajouter la catégorie" title="Ajouter la catégorie" disabled={busy || !name.trim()} onClick={() => void write({ category_key: `stock:${crypto.randomUUID()}`, name, base_category: base === "alimentaire" ? "alimentaire" : "emballage", active: true })}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-2">{categories.map(row => <div key={row.category_key} className="flex items-center gap-2">
        <Input aria-label={`Nom : ${row.name}`} value={drafts[row.category_key] ?? row.name} onChange={e => setDrafts(d => ({ ...d, [row.category_key]: e.target.value }))} disabled={busy} className={!row.active ? "text-muted-foreground" : ""} />
        <Button variant="ghost" size="icon" disabled={busy} aria-label={`Enregistrer ${row.name}`} title="Enregistrer" onClick={() => void write({ ...row, name: drafts[row.category_key] ?? row.name })}><Save className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" disabled={busy} aria-label={`${row.active ? "Supprimer" : "Restaurer"} ${row.name}`} title={row.active ? "Supprimer" : "Restaurer"} onClick={() => { if (!row.active || confirm(`Retirer « ${row.name} » des tables ? Les produits, stocks et historiques seront conservés et restaurables.`)) void write({ ...row, active: !row.active }); }}>
          {row.active ? <Trash2 className="h-4 w-4 text-destructive" /> : <Undo2 className="h-4 w-4" />}
        </Button>
      </div>)}</div>
    </DialogContent>
  </Dialog>;
}