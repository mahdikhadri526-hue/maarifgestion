import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canDisplayAdminTable } from "@/lib/adminTableVisibility";
import { resolveWeeklyArticles, validateWeeklyArticle, WEEKLY_CATEGORY_LABELS, type WeeklyCategory } from "@/lib/weeklyArticleSettings";
import { useWeeklyArticleSettings, weeklyArticleQueryKey } from "@/hooks/useWeeklyArticleSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListPlus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function WeeklyArticlesAdmin({ category }: { category: WeeklyCategory }) {
  const { user, hasAdminRole, pdvId } = useAuth();
  const allowed = canDisplayAdminTable(user?.email, hasAdminRole);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<string | null>(pdvId);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const settingsQuery = useWeeklyArticleSettings(open && allowed ? scope : null);
  const settings = settingsQuery.data ?? [];
  const pdvsQuery = useQuery({
    queryKey: ["weekly-articles-admin-pdvs"], enabled: open && allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("pdvs").select("id,name").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const articles = resolveWeeklyArticles(scope, category, settings, true);
  const disabled = busy || settingsQuery.isLoading || settingsQuery.isError || !scope;

  async function save(article: string, active: boolean, adding = false) {
    if (!allowed || !scope || disabled) return;
    const selectedPdv = scope;
    if (adding) {
      const error = validateWeeklyArticle(article, category, selectedPdv, settings);
      if (error) { toast.error(error); return; }
    } else if (!active && !window.confirm(`Supprimer « ${article} » du suivi de ce PDV ? Les relevés et transferts restent conservés.`)) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("weekly_article_settings").upsert({ pdv_id: selectedPdv, category, article: article.trim(), active }, { onConflict: "pdv_id,category,article" }).select("article,active").single();
      if (error) throw error;
      if (!data || data.active !== active) throw new Error("La modification n’a pas été enregistrée.");
      await queryClient.invalidateQueries({ queryKey: weeklyArticleQueryKey(selectedPdv) });
      if (adding) setName("");
      toast.success(adding ? "Article ajouté à ce PDV" : active ? "Article restauré" : "Article retiré de ce PDV — historique conservé");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Impossible d’enregistrer l’article"); }
    finally { setBusy(false); }
  }

  if (!allowed) return null;
  return <>
    <Button size="sm" variant="outline" onClick={() => { setScope(pdvId); setName(""); setOpen(true); }}>
      <ListPlus className="h-4 w-4 mr-2" /> Gérer les articles par PDV
    </Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Articles — {WEEKLY_CATEGORY_LABELS[category]}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Point de vente</Label>
          <Select value={scope ?? ""} disabled={busy} onValueChange={value => { setScope(value); setName(""); }}>
            <SelectTrigger><SelectValue placeholder="Choisir un PDV" /></SelectTrigger>
            <SelectContent>{(pdvsQuery.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          {pdvsQuery.isError && <p className="text-sm text-destructive">Impossible de charger les points de vente.</p>}
        </div>
        {settingsQuery.isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : settingsQuery.isError ? <div className="flex items-center gap-2"><p className="text-sm text-destructive">Articles indisponibles.</p><Button variant="outline" onClick={() => settingsQuery.refetch()}>Réessayer</Button></div> : scope && <>
          <div className="max-h-[45vh] overflow-y-auto divide-y">
            {articles.map(article => {
              const removed = settings.find(s => s.category === category && s.article === article)?.active === false;
              return <div key={article} className="flex items-center gap-3 py-2">
                <span className={`flex-1 min-w-0 break-words text-sm ${removed ? "text-muted-foreground line-through" : "text-foreground"}`}>{article}</span>
                {removed ? <Button size="sm" variant="outline" disabled={disabled} onClick={() => save(article, true)}><RotateCcw className="h-4 w-4 mr-1" /> Restaurer</Button> : <Button size="icon" variant="ghost" disabled={disabled} title={`Supprimer ${article} de ce PDV`} aria-label={`Supprimer ${article} de ce PDV`} onClick={() => save(article, false)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>;
            })}
          </div>
          <form className="flex flex-wrap items-end gap-2 border-t pt-3" onSubmit={e => { e.preventDefault(); void save(name, true, true); }}>
            <div className="flex-1 min-w-0 space-y-1"><Label htmlFor={`new-weekly-${category}`}>Nouvel article</Label><Input id={`new-weekly-${category}`} maxLength={120} value={name} disabled={disabled} onChange={e => setName(e.target.value)} /></div>
            <Button type="submit" disabled={disabled || !name.trim()}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
          </form>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}