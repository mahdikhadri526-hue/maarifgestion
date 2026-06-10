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
import { Thermometer, Save, AlertTriangle, CheckCircle2, FileDown } from "lucide-react";
import { EQUIPMENTS, SLOTS, ZONES, formatDisplayTemp, parseDisplayTemp, type FridgeSlot, type FridgeZone } from "@/lib/fridgeData";
import { OPERATORS } from "@/lib/operators";
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MANAGERS = ["Mr Mahdi Khadri", "Mr Hamza Fadlou"] as const;

interface RowState {
  id?: string;
  temperature: string;
  conformite: "" | "conforme" | "non_conforme";
  commentaire: string;
  action_corrective: string;
  performed_by: string;
  visa_manager: string;
}

function emptyRow(): RowState {
  return { temperature: "", conformite: "conforme", commentaire: "", action_corrective: "", performed_by: "", visa_manager: "" };
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

function getSign(value: string, type: string): "+" | "-" {
  const v = value.trim();
  if (v.startsWith("+")) return "+";
  if (v.startsWith("-")) return "-";
  if (type.startsWith("Frigo négatif") || type.startsWith("Congélateur") || type === "Chambre négative") return "-";
  return "+";
}

function applySign(value: string, sign: "+" | "-"): string {
  const cleaned = value.trim().replace(/^[+-]/, "");
  return `${sign}${cleaned}`;
}

function formatWithSign(value: string, sign: "+" | "-"): string {
  const cleaned = value.trim().replace(/^[+-]/, "").replace(",", ".");
  if (cleaned === "") return "";
  const num = Number(cleaned);
  if (Number.isNaN(num)) return value;
  return `${sign}${Math.abs(num)}`;
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
  const [slotOperator, setSlotOperator] = useState<string>("");
  const [savingZone, setSavingZone] = useState<FridgeZone | null>(null);
  const [zoneVisa, setZoneVisa] = useState<Record<string, string>>({});

  const visibleEquipments = useMemo(
    () => EQUIPMENTS.filter((e) => zoneFilter === "Toutes" || e.zone === zoneFilter),
    [zoneFilter]
  );

  const equipmentsByZone = useMemo(() => {
    const groups: Record<string, typeof EQUIPMENTS> = {};
    visibleEquipments.forEach((e) => {
      (groups[e.zone] ||= []).push(e);
    });
    return groups;
  }, [visibleEquipments]);

  const zonesMissingVisa = useMemo(() => {
    const missing = new Set<string>();
    Object.entries(equipmentsByZone).forEach(([zone, equips]) => {
      const hasSaved = equips.some((eq) => rows[eq.code]?.id);
      if (hasSaved && !zoneVisa[zone]) missing.add(zone);
    });
    return Array.from(missing);
  }, [equipmentsByZone, rows, zoneVisa]);

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
    let detectedOperator = "";
    (data ?? []).forEach((r: any) => {
      const eq = EQUIPMENTS.find((e) => e.code === r.equipment_code);
      const rawTemp = r.temperature_haut ?? r.temperature_bas;
      map[r.equipment_code] = {
        id: r.id,
        temperature: rawTemp !== null && rawTemp !== undefined ? formatDisplayTemp(rawTemp, eq?.type) : "",
        conformite: (r.conformite as RowState["conformite"]) ?? "",
        commentaire: r.commentaire ?? "",
        action_corrective: r.action_corrective ?? "",
        performed_by: r.performed_by ?? "",
        visa_manager: r.visa_manager ?? "",
      };
      if (!detectedOperator && r.performed_by) detectedOperator = r.performed_by;
    });
    setRows(map);
    setSlotOperator(detectedOperator);
    // Pré-remplir le visa par zone à partir des saisies existantes
    const visaByZone: Record<string, string> = {};
    (data ?? []).forEach((r: any) => {
      if (r.visa_manager && !visaByZone[r.zone]) visaByZone[r.zone] = r.visa_manager;
    });
    setZoneVisa(visaByZone);
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
    const tVal = parseDisplayTemp(row.temperature);
    if (tVal === null) {
      toast({ title: "Saisir la température", variant: "destructive" });
      return;
    }
    const operator = slotOperator || row.performed_by;
    if (!operator) {
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
      temperature_haut: tVal,
      temperature_bas: null,
      conformite: row.conformite || null,
      commentaire: row.commentaire?.trim() ? row.commentaire : "RAS",
      action_corrective: row.action_corrective?.trim() ? row.action_corrective : "RAS",
      performed_by: operator,
      visa_manager: row.visa_manager || null,
    } as any;
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
    updateRow(code, {
      id: data.id,
      performed_by: operator,
      commentaire: payload.commentaire,
      action_corrective: payload.action_corrective,
    });
    toast({ title: "Enregistré", description: `${eq.name} (${slot})` });
  }

  async function saveZone(zone: FridgeZone) {
    if (!slotOperator) {
      toast({ title: "Opérateur requis", description: "Sélectionnez « Effectué par » pour ce créneau", variant: "destructive" });
      return;
    }
    const visa = zoneVisa[zone] || "";
    const zoneEquips = (equipmentsByZone[zone] || []).filter((eq) => {
      const r = rows[eq.code];
      return r && r.temperature.trim() !== "";
    });
    if (zoneEquips.length === 0) {
      toast({ title: "Aucune température saisie dans cette zone" });
      return;
    }
    setSavingZone(zone);
    let ok = 0, ko = 0;
    for (const eq of zoneEquips) {
      const r = rows[eq.code];
      const tVal = parseDisplayTemp(r.temperature);
      if (tVal === null) { ko++; continue; }
      const payload = {
        control_date: date, slot, zone: eq.zone,
        equipment_code: eq.code, equipment_name: eq.name, equipment_type: eq.type,
        temperature_haut: tVal, temperature_bas: null,
        conformite: r.conformite || null,
        commentaire: r.commentaire?.trim() ? r.commentaire : "RAS",
        action_corrective: r.action_corrective?.trim() ? r.action_corrective : "RAS",
        performed_by: slotOperator,
        visa_manager: visa || null,
      } as any;
      const { data, error } = await supabase
        .from("fridge_temperatures")
        .upsert(payload, { onConflict: "control_date,slot,equipment_code" })
        .select().single();
      if (error) { ko++; } else {
        ok++;
        updateRow(eq.code, {
          id: data.id,
          performed_by: slotOperator,
          visa_manager: visa,
          commentaire: payload.commentaire,
          action_corrective: payload.action_corrective,
        });
      }
    }
    setSavingZone(null);
    toast({ title: `Zone ${zone} enregistrée`, description: `${ok} ligne(s) enregistrée(s)${ko ? `, ${ko} erreur(s)` : ""}` });
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("Prise de température des frigos (HACCP)", 14, 14);
    doc.setFontSize(10);
    doc.text(`Date : ${date}   Créneau : ${slot}   Zone : ${zoneFilter}   Effectué par : ${slotOperator || "—"}`, 14, 21);
    const body = visibleEquipments.map((eq) => {
      const r = rows[eq.code] ?? emptyRow();
      return [
        eq.code,
        `${eq.name}\n${eq.type}`,
        eq.zone,
        r.temperature || "—",
        r.conformite === "conforme" ? "Conforme" : r.conformite === "non_conforme" ? "Non conforme" : "—",
        r.action_corrective || "—",
        r.commentaire || "—",
        r.visa_manager || "—",
      ];
    });
    autoTable(doc, {
      startY: 26,
      head: [["Code", "Équipement", "Zone", "Temp (°C)", "Conforme", "Action si non conforme", "Commentaire", "Visa manager"]],
      body,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 64, 175] },
    });
    doc.save(`temperatures_${date}_${slot}.pdf`);
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
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mt-3 items-end">
            <div>
              <Label>Effectué par (créneau {slot}) *</Label>
              <Select value={slotOperator} onValueChange={setSlotOperator} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Sélectionner l'opérateur" /></SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={exportPdf}>
              <FileDown className="h-4 w-4 mr-1" /> Exporter PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Chargement…</CardContent></Card>
      ) : (
        Object.entries(equipmentsByZone).map(([zone, equips], zoneIndex) => {
          // Conserver l'ordre fixe des équipements pour éviter que les lignes
          // ne se déplacent pendant la saisie.
          const sortedEquips = equips;
          return (
          <Card key={zone}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Zone : {zone}</CardTitle>
              {zoneIndex === 0 && zonesMissingVisa.length > 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Visa manager manquant</div>
                    <div className="text-xs opacity-90">
                      Aucun visa enregistré pour&nbsp;: {zonesMissingVisa.join(", ")}
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
            {/* Desktop / tablet table */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[110px]">Code</TableHead>
                  <TableHead className="min-w-[180px] sticky left-0 z-20 bg-background shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">Équipement</TableHead>
                  <TableHead className="min-w-[120px]">Température (°C)</TableHead>
                  <TableHead className="min-w-[100px]">Conforme</TableHead>
                  <TableHead className="min-w-[200px]">Commentaire</TableHead>
                  <TableHead className="min-w-[220px]">Action en cas non conforme</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEquips.map((eq) => {
                  const row = rows[eq.code] ?? emptyRow();
                  const locked = !!row.id;
                  const editable = canEdit;
                  return (
                    <TableRow key={eq.code} className={row.id ? "bg-success/5" : ""}>
                      <TableCell className="font-mono text-xs">{eq.code}</TableCell>
                      <TableCell className={`sticky left-0 z-10 bg-card ${row.id ? "border-l-4 border-l-success" : ""} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]`}>
                        <div className="font-medium">{eq.name}</div>
                        <div className="text-xs text-muted-foreground">{eq.type}</div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={row.temperature}
                          onChange={(e) => updateRow(eq.code, { temperature: e.target.value })}
                          onBlur={() => {
                            const sign = getSign(row.temperature, eq.type);
                            const formatted = formatWithSign(row.temperature, sign);
                            if (formatted !== row.temperature) updateRow(eq.code, { temperature: formatted });
                          }}
                          disabled={!editable}
                          className="h-9 w-28"
                          placeholder={eq.type.startsWith("Frigo positif") || eq.type === "Chambre positive" ? "+" : "-"}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.conformite || "__none"}
                          onValueChange={(v) => updateRow(eq.code, { conformite: v === "__none" ? "" : (v as RowState["conformite"]) })}
                          disabled={!editable}
                        >
                          <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            <SelectItem value="conforme">Conforme</SelectItem>
                            <SelectItem value="non_conforme">Non conforme</SelectItem>
                          </SelectContent>
                        </Select>
                        {row.conformite === "conforme" && (
                          <Badge className="mt-1 bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>
                        )}
                        {row.conformite === "non_conforme" && (
                          <Badge className="mt-1" variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Non conforme</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Textarea
                          rows={1}
                          value={row.commentaire}
                          onChange={(e) => updateRow(eq.code, { commentaire: e.target.value })}
                          disabled={!editable}
                          placeholder="Observations…"
                          className="min-h-9"
                        />
                      </TableCell>
                      <TableCell>
                          <Textarea
                            rows={1}
                            value={row.action_corrective}
                            onChange={(e) => updateRow(eq.code, { action_corrective: e.target.value })}
                            disabled={!editable}
                            placeholder={row.conformite === "non_conforme" ? "Action corrective…" : "—"}
                            className="min-h-9 w-full"
                          />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Mobile card list */}
            <div className="md:hidden divide-y">
              {sortedEquips.map((eq) => {
                const row = rows[eq.code] ?? emptyRow();
                const locked = !!row.id;
                const editable = canEdit;
                const status = row.conformite;
                const borderClass =
                  status === "non_conforme"
                    ? "border-l-4 border-l-destructive"
                    : status === "conforme"
                    ? "border-l-4 border-l-success"
                    : locked
                    ? "border-l-4 border-l-success/60"
                    : "border-l-4 border-l-muted";
                return (
                  <div key={eq.code} className={`p-3 ${borderClass} ${locked ? "bg-success/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm leading-tight truncate">{eq.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{eq.code} · {eq.type}</div>
                      </div>
                      {status === "conforme" && (
                        <Badge className="bg-success text-success-foreground shrink-0"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>
                      )}
                      {status === "non_conforme" && (
                        <Badge variant="destructive" className="shrink-0"><AlertTriangle className="h-3 w-3 mr-1" />Non conforme</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Température (°C)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={row.temperature}
                          onChange={(e) => updateRow(eq.code, { temperature: e.target.value })}
                          onBlur={() => {
                            const sign = getSign(row.temperature, eq.type);
                            const formatted = formatWithSign(row.temperature, sign);
                            if (formatted !== row.temperature) updateRow(eq.code, { temperature: formatted });
                          }}
                          disabled={!editable}
                          className="h-10 text-base font-semibold w-full"
                          placeholder={eq.type.startsWith("Frigo positif") || eq.type === "Chambre positive" ? "+" : "-"}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Conforme</Label>
                        <Select
                          value={row.conformite || "__none"}
                          onValueChange={(v) => updateRow(eq.code, { conformite: v === "__none" ? "" : (v as RowState["conformite"]) })}
                          disabled={!editable}
                        >
                          <SelectTrigger className="h-10"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            <SelectItem value="conforme">Conforme</SelectItem>
                            <SelectItem value="non_conforme">Non conforme</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Label className="text-[11px] text-muted-foreground">Commentaire</Label>
                      <Textarea
                        rows={1}
                        value={row.commentaire}
                        onChange={(e) => updateRow(eq.code, { commentaire: e.target.value })}
                        disabled={!editable}
                        placeholder="Observations…"
                        className="min-h-9 text-sm"
                      />
                    </div>
                    {status === "non_conforme" && (
                      <div className="mt-2">
                        <Label className="text-[11px] text-destructive">Action corrective</Label>
                        <Textarea
                          rows={1}
                          value={row.action_corrective}
                          onChange={(e) => updateRow(eq.code, { action_corrective: e.target.value })}
                          disabled={!editable}
                          placeholder="Action corrective…"
                          className="min-h-9 text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-end justify-end p-4 border-t">
              <div className="min-w-[200px]">
                <Label className="text-xs">Visa manager (zone)</Label>
                <Select
                  value={zoneVisa[zone] || "__none"}
                  onValueChange={(v) => setZoneVisa((p) => ({ ...p, [zone]: v === "__none" ? "" : v }))}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {MANAGERS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {canEdit && (
                <Button onClick={() => saveZone(zone as FridgeZone)} disabled={savingZone === zone}>
                  <Save className="h-4 w-4 mr-1" />
                  {savingZone === zone ? "Enregistrement…" : "Enregistrer la zone"}
                </Button>
              )}
            </div>
            </CardContent>
          </Card>
        );
      }))}
    </div>
  );
}

export default FridgeTemperatureManager;