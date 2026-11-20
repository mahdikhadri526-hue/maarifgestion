import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Clock, Plus, Trash2, Save, Copy } from "lucide-react";
import { fetchSlotsForScope, type FridgeSlotDef } from "@/lib/fridgeSlots";

const DEFAULT_SCOPE = "__default__";
const toTime = (s: FridgeSlotDef) => `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
const labelOf = (h: number, m: number) => `${String(h).padStart(2, "0")}h${m ? String(m).padStart(2, "0") : ""}`;
const parse = (t: string) => { const [h, m] = t.split(":").map(Number); return { hour: h, minute: m || 0 }; };

export function FridgeSlotsAdmin({ currentPdvId, onChanged }: { currentPdvId: string | null; onChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pdvs, setPdvs] = useState<{ id: string; name: string }[]>([]);
  const [scope, setScope] = useState<string>(currentPdvId ?? DEFAULT_SCOPE);
  const [slots, setSlots] = useState<FridgeSlotDef[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [newTime, setNewTime] = useState("");
  const pdvId = scope === DEFAULT_SCOPE ? null : scope;

  useEffect(() => {
    supabase.from("pdvs").select("id,name").eq("active", true).order("name").then(({ data }) => setPdvs(data ?? []));
  }, []);
  const load = useCallback(async () => { setSlots(await fetchSlotsForScope(pdvId)); setEdits({}); }, [pdvId]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  async function run(p: PromiseLike<{ error: any }>, ok: string) {
    const { error } = await p;
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: ok }); await load(); onChanged(); }
  }

  async function copyDefaults() {
    const defs = await fetchSlotsForScope(null);
    await run(supabase.from("fridge_slots").insert(defs.map((d) => ({ label: d.label, hour: d.hour, minute: d.minute, sort_order: d.sort_order, pdv_id: pdvId }))), "Créneaux personnalisés créés");
  }

  return (
    <div className="mt-3 rounded-md border p-3">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <Clock className="h-4 w-4 mr-1" /> Gérer les créneaux horaires
      </Button>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="max-w-xs">
            <Label>Point de vente</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_SCOPE}>Par défaut (tous les PDV)</SelectItem>
                {pdvs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {pdvId && slots.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Ce PDV utilise les créneaux par défaut.</p>
              <Button size="sm" onClick={copyDefaults}><Copy className="h-4 w-4 mr-1" /> Personnaliser pour ce PDV</Button>
            </div>
          ) : (
            <>
              {slots.map((s) => {
                const v = edits[s.id!] ?? toTime(s);
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="w-14 text-sm font-semibold">{s.label}</span>
                    <Input type="time" className="w-32" value={v} onChange={(e) => setEdits({ ...edits, [s.id!]: e.target.value })} />
                    <Button size="sm" variant="outline" disabled={v === toTime(s)}
                      onClick={() => { const t = parse(v); run(supabase.from("fridge_slots").update({ ...t, label: labelOf(t.hour, t.minute) }).eq("id", s.id!), "Créneau modifié"); }}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" disabled={!pdvId && slots.length <= 1}
                      onClick={() => { if (confirm(`Supprimer le créneau ${s.label} ? L'historique reste conservé.`)) run(supabase.from("fridge_slots").delete().eq("id", s.id!), "Créneau supprimé"); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <div className="flex items-center gap-2 pt-2 border-t">
                <Input type="time" className="w-32" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                <Button size="sm" disabled={!newTime} onClick={() => {
                  const t = parse(newTime);
                  run(supabase.from("fridge_slots").insert({ ...t, label: labelOf(t.hour, t.minute), sort_order: slots.length + 1, pdv_id: pdvId }), "Créneau ajouté");
                  setNewTime("");
                }}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
              </div>
              {pdvId && <p className="text-xs text-muted-foreground">Supprimer tous les créneaux de ce PDV le remet sur les créneaux par défaut.</p>}
            </>
          )}
          <p className="text-xs text-muted-foreground">Les relevés déjà enregistrés gardent le nom de leur créneau.</p>
        </div>
      )}
    </div>
  );
}
