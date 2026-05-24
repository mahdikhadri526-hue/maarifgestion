import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Thermometer, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { EQUIPMENTS, SLOTS, ZONES, type FridgeSlot, type FridgeZone, isTemperatureOk, getTargetRange } from "@/lib/fridgeData";
import { OPERATORS } from "@/lib/operators";
import { useAuth } from "@/contexts/AuthContext";

interface RowState {
  id?: string;
  temperature_haut: string;
  temperature_bas: string;
  commentaire: string;
  performed_by: string;
  visa_manager: string;
}

function emptyRow(): RowState {
  return { temperature_haut: "", temperature_bas: "", commentaire: "", performed_by: "", visa_manager: "" };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function currentSlot(): FridgeSlot {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "07h";
  if (h >= 12 && h < 20) return "16h";
  return "00h";
}

export function FridgeTemperatureManager() {
  const { can } = useAuth();
  const canEdit = can("edit_temperatures");
  const canDelete = can("delete_temperatures");
  const { toast } = useToast();

  const [date, setDate] = useState<string>(todayStr());
  const [slot, setSlot] = useState<FridgeSlot>(currentSlot());
  const [zoneFilter, setZoneFilter] = useState<FridgeZone | "Toutes">("Toutes");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const visibleEquipments = useMemo(
    () => EQUIPMENTS.filter((e) => zoneFilter === "Toutes" || e.zone === zoneFilter),
    [zoneFilter]
  );

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("fridge_temperatures")
      .select("*")
      .eq("control_date", date)
      .eq("slot", slot);
    setLoading(false);
    if (error) {
      toast({ title: "Erreur de chargement", description: error.message, variant: "destructive" });
      return;
    }
    const map: Record<string, RowState> = {};
    EQUIPMENTS.forEach((e) => (map[e.code] = emptyRow()));
    (data ?? []).forEach((r: any) => {
      map[r.equipment_code] = {
        id: r.id,
        temperature_haut: r.temperature_haut?.toString() ?? "",
        temperature_bas: r.temperature_bas?.toString() ?? "",
        commentaire: r.commentaire ?? "",
        performed_by: r.performed_by ?? "",
        visa_manager: r.visa_manager ?? "",
      };
    });
    setRows(map);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, slot]);

  function updateRow(code: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [code]: { ...(prev[code] ?? emptyRow()), ...patch } }));
  }

  async function saveRow(code: string) {
    const eq = EQUIPMENTS.find((e) => e.code === code);
    if (!eq) return;
    const row = rows[code] ?? emptyRow();
    const tHaut = row.temperature_haut.trim() === "" ? null : Number(row.temperature_haut.replace(",", "."));
    const tBas = row.temperature_bas.trim() === "" ? null : Number(row.temperature_bas.replace(",", "."));
    if (tHaut === null && tBas === null) {
      toast({ title: "Saisir au moins une température", variant: "destructive" });
      return;
    }
    if ((tHaut !== null && Number.isNaN(tHaut)) || (tBas !== null && Number.isNaN(tBas))) {
      toast({ title: "Température invalide", variant: "destructive" });
      return;
    }
    if (!row.performed_by) {
      toast({ title: "Opérateur requis", description: "Sélectionnez l'opérateur (Effectué par)", variant: "destructive" });
      return;
    }
    setSaving(code);
    const payload = {
      control_date: date,
      slot,
      zone: eq.zone,
      equipment_code: eq.code,
      equipment_name: eq.name,
      equipment_type: eq.type,
      temperature_haut: tHaut,
      temperature_bas: tBas,
      commentaire: row.commentaire || null,
      performed_by: row.performed_by,
      visa_manager: row.visa_manager || null,
    };
    const { data, error } = await supabase
      .from("fridge_temperatures")
      .upsert(payload, { onConflict: "control_date,slot,equipment_code" })
      .select()
      .single();
    setSaving(null);
    if (error) {
      toast({ title: "Erreur d'enregistrement", description: error.message, variant: "destructive" });
      return;
    }
    updateRow(code, { id: data.id });
    toast({ title: "Enregistré", description: `${eq.name} (${slot})` });
  }

  async function deleteRow(code: string) {
    const row = rows[code];
    if (!row?.id) return;
    if (!confirm("Supprimer cette saisie ?")) return;
    const { error } = await supabase.from("fridge_temperatures").delete().eq("id", row.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => ({ ...prev, [code]: emptyRow() }));
    toast({ title: "Saisie supprimée" });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-primary" />
            Prise de température des frigos (HACCP)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            3 contrôles par jour&nbsp;: <strong>07h</strong>, <strong>16h</strong>, <strong>00h</strong>.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Date du contrôle</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Créneau</Label>
              <Select value={slot} onValueChange={(v) => setSlot(v as FridgeSlot)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Zone</Label>
              <Select value={zoneFilter} onValueChange={(v) => setZoneFilter(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Toutes">Toutes les zones</SelectItem>
                  {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[110px]">Code</TableHead>
                  <TableHead className="min-w-[160px]">Équipement</TableHead>
                  <TableHead className="min-w-[110px]">Zone</TableHead>
                  <TableHead className="min-w-[120px]">T° Haut (°C)</TableHead>
                  <TableHead className="min-w-[120px]">T° Bas (°C)</TableHead>
                  <TableHead className="min-w-[100px]">Conforme</TableHead>
                  <TableHead className="min-w-[180px]">Effectué par *</TableHead>
                  <TableHead className="min-w-[180px]">Visa manager</TableHead>
                  <TableHead className="min-w-[200px]">Commentaire</TableHead>
                  <TableHead className="min-w-[160px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEquipments.map((eq) => {
                  const row = rows[eq.code] ?? emptyRow();
                  const range = getTargetRange(eq.type);
                  const tH = row.temperature_haut ? Number(row.temperature_haut.replace(",", ".")) : null;
                  const tB = row.temperature_bas ? Number(row.temperature_bas.replace(",", ".")) : null;
                  const okH = isTemperatureOk(eq.type, tH);
                  const okB = isTemperatureOk(eq.type, tB);
                  const anyOk = okH === false || okB === false ? false : okH === true || okB === true ? true : null;
                  return (
                    <TableRow key={eq.code} className={row.id ? "bg-success/5" : ""}>
                      <TableCell className="font-mono text-xs">{eq.code}</TableCell>
                      <TableCell>
                        <div className="font-medium">{eq.name}</div>
                        <div className="text-xs text-muted-foreground">{eq.type}</div>
                        {range && <div className="text-[10px] text-muted-foreground">Cible: {range.min}…{range.max}°C</div>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{eq.zone}</Badge></TableCell>
                      <TableCell>
                        <Input
                          type="number" step="0.1" inputMode="decimal"
                          value={row.temperature_haut}
                          onChange={(e) => updateRow(eq.code, { temperature_haut: e.target.value })}
                          disabled={!canEdit}
                          className="h-9 w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" step="0.1" inputMode="decimal"
                          value={row.temperature_bas}
                          onChange={(e) => updateRow(eq.code, { temperature_bas: e.target.value })}
                          disabled={!canEdit}
                          className="h-9 w-24"
                        />
                      </TableCell>
                      <TableCell>
                        {anyOk === true && <Badge className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>}
                        {anyOk === false && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Hors plage</Badge>}
                        {anyOk === null && <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Select value={row.performed_by} onValueChange={(v) => updateRow(eq.code, { performed_by: v })} disabled={!canEdit}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Opérateur" /></SelectTrigger>
                          <SelectContent>
                            {OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={row.visa_manager || "__none"} onValueChange={(v) => updateRow(eq.code, { visa_manager: v === "__none" ? "" : v })} disabled={!canEdit}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Manager" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            {OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Textarea
                          rows={1}
                          value={row.commentaire}
                          onChange={(e) => updateRow(eq.code, { commentaire: e.target.value })}
                          disabled={!canEdit}
                          placeholder="Observations…"
                          className="min-h-9"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit && (
                            <Button size="sm" onClick={() => saveRow(eq.code)} disabled={saving === eq.code}>
                              <Save className="h-3.5 w-3.5 mr-1" />
                              {row.id ? "Mettre à jour" : "Enregistrer"}
                            </Button>
                          )}
                          {canDelete && row.id && (
                            <Button size="sm" variant="outline" onClick={() => deleteRow(eq.code)}>Supprimer</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default FridgeTemperatureManager;