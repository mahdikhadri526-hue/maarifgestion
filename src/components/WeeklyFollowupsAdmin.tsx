import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { canDisplayAdminTable } from "@/lib/adminTableVisibility";
import { validateFollowupName, type WeeklyFollowup, type FollowupArticle } from "@/lib/weeklyFollowups";
import { useWeeklyFollowups, weeklyFollowupsQueryKey, useBuiltinFollowupsOff, builtinFollowupsOffQueryKey, BUILTIN_FOLLOWUPS, BUILTIN_FOLLOWUP_OFF_PREFIX } from "@/hooks/useWeeklyFollowups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function WeeklyFollowupsAdmin() {
  const { pdvId, user, hasAdminRole } = useAuth();
  const allowed = canDisplayAdminTable(user?.email, hasAdminRole);
  const query = useWeeklyFollowups(pdvId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [article, setArticle] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const offQuery = useBuiltinFollowupsOff(pdvId);
  const offSet = offQuery.data ?? new Set<string>();
  const rows = query.data ?? [];
  const selected = rows.find(row => row.id === selectedId);
  const disabled = busy || !pdvId || query.isLoading || query.isError;

  async function mutate(action: () => PromiseLike<{ error: unknown }>): Promise<boolean> {
    if (!allowed || disabled) return false;
    setBusy(true);
    try {
      const result = await action();
      if (result.error) throw result.error;
      await queryClient.invalidateQueries({ queryKey: weeklyFollowupsQueryKey(pdvId) });
      toast.success("Modification enregistrée");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’enregistrer la modification.");
      return false;
    } finally { setBusy(false); }
  }

  async function addFollowup() {
    if (!pdvId || disabled) return;
    const error = validateFollowupName(name, [...rows.map(row => row.name), "Crème fraîche", "Mouvement glaces", "Mouvement tartes", "Fruits", "Mouvement produits nettoyants", "Suivi matériel"]);
    if (error) { toast.error(error); return; }
    await mutate(async () => {
      const result = await supabase.from("weekly_followups").insert({ pdv_id: pdvId, name: name.trim() }).select("id").single();
      if (!result.error && result.data) { setSelectedId(result.data.id); setName(""); }
      return result;
    });
  }

  function toggleFollowup(row: WeeklyFollowup) {
    if (row.active && !window.confirm(`Retirer « ${row.name} » ? Ses articles, relevés et transferts seront conservés.`)) return;
    void mutate(() => supabase.from("weekly_followups").update({ active: !row.active }).eq("id", row.id).eq("pdv_id", row.pdv_id).select("id").single());
  }

  async function toggleBuiltin(key: string, label: string) {
    if (!pdvId || !allowed || busy) return;
    const off = offSet.has(key);
    if (!off && !window.confirm(`Retirer « ${label} » de ce PDV ? Ses relevés et calculs sont conservés.`)) return;
    setBusy(true);
    const { error } = await supabase.from("pdv_permissions" as any).upsert({ pdv_id: pdvId, permission_key: BUILTIN_FOLLOWUP_OFF_PREFIX + key, allowed: !off }, { onConflict: "pdv_id,permission_key" });
    setBusy(false);
    if (error) { toast.error("Impossible d’enregistrer : " + error.message); return; }
    await queryClient.invalidateQueries({ queryKey: builtinFollowupsOffQueryKey(pdvId) });
    toast.success("Modification enregistrée");
  }

  async function saveArticles(items: FollowupArticle[]) {
    if (!selected || !selected.active) return false;
    return mutate(() => supabase.from("weekly_followups").update({ articles: items }).eq("id", selected.id).eq("pdv_id", selected.pdv_id).select("id").single());
  }

  if (!allowed) return null;
  return <>
    <Button variant="outline" size="sm" onClick={() => { setOpen(true); setName(""); setArticle(""); setSelectedId(""); }}><Settings2 className="h-4 w-4 mr-2" /> Gérer les suivis</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Suivis hebdomadaires — ce PDV</DialogTitle></DialogHeader>
        {query.isError ? <div><p className="text-destructive">Suivis indisponibles.</p><Button variant="outline" onClick={() => query.refetch()}>Réessayer</Button></div> : <>
          <div className="divide-y">
            {BUILTIN_FOLLOWUPS.map(b => { const off = offSet.has(b.key); return <div key={b.key} className="flex items-center gap-2 py-2">
              <span className={`flex-1 min-w-0 break-words text-sm ${off ? "text-muted-foreground line-through" : "text-foreground"}`}>{b.label}</span>
              <Button variant="ghost" size="icon" disabled={busy || !pdvId || offQuery.isLoading} title={`${off ? "Restaurer" : "Retirer"} ${b.label}`} aria-label={`${off ? "Restaurer" : "Retirer"} ${b.label}`} onClick={() => void toggleBuiltin(b.key, b.label)}>{off ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4 text-destructive" />}</Button>
            </div>; })}
            {rows.map(row => <div key={row.id} className="flex items-center gap-2 py-2">
              <span className={`flex-1 min-w-0 break-words text-sm ${row.active ? "text-foreground" : "text-muted-foreground line-through"}`}>{row.name}</span>
              <Button variant="ghost" size="icon" disabled={disabled} title={`${row.active ? "Retirer" : "Restaurer"} ${row.name}`} aria-label={`${row.active ? "Retirer" : "Restaurer"} ${row.name}`} onClick={() => toggleFollowup(row)}>{row.active ? <Trash2 className="h-4 w-4 text-destructive" /> : <RotateCcw className="h-4 w-4" />}</Button>
            </div>)}
          </div>
          <form className="flex items-end gap-2 border-t pt-3" onSubmit={event => { event.preventDefault(); void addFollowup(); }}>
            <div className="flex-1 min-w-0 space-y-1"><Label htmlFor="weekly-followup-name">Nouveau suivi</Label><Input id="weekly-followup-name" maxLength={120} value={name} disabled={disabled} onChange={event => setName(event.target.value)} /></div>
            <Button type="submit" disabled={disabled || !name.trim()} size="icon" title="Ajouter un suivi" aria-label="Ajouter un suivi"><Plus className="h-4 w-4" /></Button>
          </form>
          <div className="border-t pt-3 space-y-2">
            <Label>Articles du suivi</Label>
            <Select value={selected?.active ? selectedId : ""} onValueChange={value => { setSelectedId(value); setArticle(""); }} disabled={disabled}>
              <SelectTrigger><SelectValue placeholder="Choisir un suivi" /></SelectTrigger>
              <SelectContent>{rows.filter(row => row.active).map(row => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent>
            </Select>
            {selected?.active && <>
              <div className="divide-y max-h-48 overflow-y-auto">{selected.articles.map(item => <div key={item.name} className="flex gap-2 items-center py-2">
                <span className={`flex-1 min-w-0 break-words text-sm ${item.active ? "text-foreground" : "text-muted-foreground line-through"}`}>{item.name}</span>
                <Button variant="ghost" size="icon" disabled={disabled} title={`${item.active ? "Retirer" : "Restaurer"} ${item.name}`} aria-label={`${item.active ? "Retirer" : "Restaurer"} ${item.name}`} onClick={() => {
                  if (item.active && !window.confirm(`Retirer « ${item.name} » de ce suivi ? Les relevés restent conservés.`)) return;
                  void saveArticles(selected.articles.map(existing => existing.name === item.name ? { ...existing, active: !item.active } : existing));
                }}>{item.active ? <Trash2 className="h-4 w-4 text-destructive" /> : <RotateCcw className="h-4 w-4" />}</Button>
              </div>)}</div>
              <form className="flex items-end gap-2" onSubmit={event => {
                event.preventDefault();
                const error = validateFollowupName(article, selected.articles.map(item => item.name));
                if (error) { toast.error(error); return; }
                void saveArticles([...selected.articles, { name: article.trim(), active: true }]).then(saved => { if (saved) setArticle(""); });
              }}>
                <div className="flex-1 min-w-0 space-y-1"><Label htmlFor="weekly-followup-article">Nouvel article</Label><Input id="weekly-followup-article" maxLength={120} value={article} disabled={disabled} onChange={event => setArticle(event.target.value)} /></div>
                <Button type="submit" size="icon" disabled={disabled || !article.trim()} title="Ajouter un article" aria-label="Ajouter un article"><Plus className="h-4 w-4" /></Button>
              </form>
            </>}
          </div>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}