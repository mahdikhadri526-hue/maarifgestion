import { useMemo, useState } from "react";
import { supabase } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Plus, Trash2, Save } from "lucide-react";
import { EQUIPMENTS, ZONES, type FridgeZone } from "@/lib/fridgeData";
import { EQUIPMENT_TYPES, generateEquipmentCode, type CustomEquipmentRow } from "@/lib/fridgeEquipments";
import { useAuth } from "@/contexts/AuthContext";

export function FridgeEquipmentManager({
  custom,
  onChanged,
}: {
  custom: CustomEquipmentRow[];
  onChanged: () => void;
}) {
  const { can, isAdmin } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [zone, setZone] = useState<FridgeZone>("Salle");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(EQUIPMENT_TYPES[0].value);
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, { name: string; type: string }>>({});

  const canView = isAdmin || can("view_equipments");
  const canEdit = isAdmin || can("edit_equipments");
  const canDelete = isAdmin || can("delete_equipments");

  const usedCodes = useMemo(
    () => [...EQUIPMENTS.map((e) => e.code), ...custom.map((c) => c.code)],
    [custom],
  );

  if (!canView) return null;

  async function addEquipment() {
    if (!name.trim()) {
      toast({ title: "Nom requis", variant: "destructive" });
      return;
    }
    setBusy(true);
    const code = generateEquipmentCode(zone, type, usedCodes);
    const { error } = await supabase.from("fridge_equipments" as any).insert({
      code,
      name: name.trim(),
      type,
      zone,
      sort_order: custom.length + 1,
    } as any);
    setBusy(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Matériel ajouté", description: `Code ${code}` });
    setName("");
    onChanged();
  }

  async function saveEquipment(row: CustomEquipmentRow) {
    const patch = edits[row.id];
    if (!patch) return;
    setBusy(true);
    const { error } = await supabase
      .from("fridge_equipments" as any)
      .update({ name: patch.name.trim() || row.name, type: patch.type } as any)
      .eq("id", row.id);
    setBusy(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    setEdits((p) => {
      const n = { ...p };
      delete n[row.id];
      return n;
    });
    toast({ title: "Matériel modifié" });
    onChanged();
  }

  async function removeEquipment(row: CustomEquipmentRow) {
    const isTombstone = row.active === false;
    const msg = isTombstone
      ? `Restaurer le matériel d'origine « ${row.name} » (${row.code}) ?`
      : `Supprimer le matériel « ${row.name} » (${row.code}) ?`;
    if (!confirm(msg)) return;
    setBusy(true);
    const { error } = await supabase.from("fridge_equipments" as any).delete().eq("id", row.id);
    setBusy(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isTombstone ? "Matériel restauré" : "Matériel supprimé" });
    onChanged();
  }

  /** Masque un matériel d'origine : on insère une ligne inactive avec le même code. */
  async function removeBuiltin(eq: { code: string; name: string; type: string; zone: FridgeZone }) {
    if (!confirm(`Supprimer le matériel d'origine « ${eq.name} » (${eq.code}) ?`)) return;
    setBusy(true);
    const { error } = await supabase.from("fridge_equipments" as any).insert({
      code: eq.code,
      name: eq.name,
      type: eq.type,
      zone: eq.zone,
      sort_order: -1,
      active: false,
    } as any);
    setBusy(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Matériel supprimé" });
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-1" /> Matériels
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestion des matériels — Température</DialogTitle>
        </DialogHeader>

        {canEdit && (
          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="text-sm font-medium">Ajouter un matériel</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Zone</Label>
                <Select value={zone} onValueChange={(v) => setZone(v as FridgeZone)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nom</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Congélateur 10" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Code attribué automatiquement : {generateEquipmentCode(zone, type, usedCodes)}
              </p>
              <Button size="sm" onClick={addEquipment} disabled={busy}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter
              </Button>
            </div>
          </div>
        )}

        {canDelete && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Matériels d'origine</div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {EQUIPMENTS.filter((e) => !custom.some((c) => c.code === e.code && !c.active)).map((eq) => (
                <div key={eq.code} className="flex items-center gap-2 rounded-md border border-border p-2">
                  <Badge variant="outline">{eq.code}</Badge>
                  <span className="flex-1 text-sm truncate">{eq.name}</span>
                  <span className="text-xs text-muted-foreground">{eq.zone}</span>
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => removeBuiltin(eq)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-sm font-medium">Matériels ajoutés</div>
          {custom.filter((c) => c.active).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun matériel ajouté. Les matériels d'origine restent inchangés.</p>
          )}
          {custom.filter((c) => c.active).map((row) => {
            const patch = edits[row.id] ?? { name: row.name, type: row.type };
            const dirty = patch.name !== row.name || patch.type !== row.type;
            return (
              <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto] gap-2 items-center rounded-md border border-border p-2">
                <Badge variant="outline">{row.code}</Badge>
                <Input
                  value={patch.name}
                  disabled={!canEdit}
                  onChange={(e) => setEdits((p) => ({ ...p, [row.id]: { ...patch, name: e.target.value } }))}
                />
                <Select
                  value={patch.type}
                  disabled={!canEdit}
                  onValueChange={(v) => setEdits((p) => ({ ...p, [row.id]: { ...patch, type: v } }))}
                >
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  {canEdit && (
                    <Button size="sm" variant="outline" disabled={!dirty || busy} onClick={() => saveEquipment(row)}>
                      <Save className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => removeEquipment(row)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground sm:col-span-4">Zone : {row.zone}</div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
