import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Clock, Plus, Trash2, Save } from "lucide-react";
import type { FridgeSlotDef } from "@/lib/fridgeSlots";

const toTime = (s: FridgeSlotDef) => `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
const labelOf = (h: number, m: number) => `${String(h).padStart(2, "0")}h${m ? String(m).padStart(2, "0") : ""}`;

export function FridgeSlotsAdmin({ slots, onChanged }: { slots: FridgeSlotDef[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [newTime, setNewTime] = useState("");

  async function run(p: PromiseLike<{ error: any }>, ok: string) {
    const { error } = await p;
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: ok }); setEdits({}); onChanged(); }
  }
  const parse = (t: string) => { const [h, m] = t.split(":").map(Number); return { hour: h, minute: m || 0 }; };

  return (
    <div className="mt-3 rounded-md border p-3">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <Clock className="h-4 w-4 mr-1" /> Gérer les créneaux horaires (tous les PDV)
      </Button>
      {open && (
        <div className="mt-3 space-y-2">
          {slots.map((s) => {
            const v = edits[s.id!] ?? toTime(s);
            return (
              <div key={s.id ?? s.label} className="flex items-center gap-2">
                <span className="w-14 text-sm font-semibold">{s.label}</span>
                <Input type="time" className="w-32" value={v} onChange={(e) => setEdits({ ...edits, [s.id!]: e.target.value })} />
                <Button size="sm" variant="outline" disabled={!s.id || v === toTime(s)}
                  onClick={() => { const t = parse(v); run(supabase.from("fridge_slots").update({ ...t, label: labelOf(t.hour, t.minute) }).eq("id", s.id!), "Créneau modifié"); }}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={!s.id || slots.length <= 1}
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
              run(supabase.from("fridge_slots").insert({ ...t, label: labelOf(t.hour, t.minute), sort_order: slots.length + 1 }), "Créneau ajouté");
              setNewTime("");
            }}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
          </div>
          <p className="text-xs text-muted-foreground">Une modification renomme le créneau pour les nouvelles saisies ; les relevés déjà enregistrés gardent leur ancien nom.</p>
        </div>
      )}
    </div>
  );
}
