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

// Date du « service » : entre 00h et 04h59, on rattache à la journée de travail
// précédente (le créneau 00h correspond à la fin du service de la veille).
function serviceDateStr(d: Date = new Date()) {
  const ref = new Date(d);
  if (ref.getHours() < 5) ref.setDate(ref.getDate() - 1);
  // format YYYY-MM-DD en local
  const y = ref.getFullYear();
  const m = String(ref.getMonth() + 1).padStart(2, "0");
  const day = String(ref.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const { can, user } = useAuth();
  const isReadOnlyUser = user?.email === "gestionmaarif1@gmail.com";
  const canEdit = can("edit_temperatures") && !isReadOnlyUser;
  const canDelete = can("delete_temperatures") && !isReadOnlyUser;
  const { toast } = useToast();

  const [date, setDate] = useState<string>(serviceDateStr());
  const [slot, setSlot] = useState<FridgeSlot>(currentSlot());
  const [zoneFilter, setZoneFilter] = useState<FridgeZone | "Toutes">("Toutes");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [slotOperator, setSlotOperator] = useState<string>("");
  const [savingZone, setSavingZone] = useState<FridgeZone | null>(null);
  const [zoneVisa, setZoneVisa] = useState<Record<string, string>>({});
  const [zoneOperator, setZoneOperator] = useState<Record<string, string>>({});

  // Historique
  const [historyDate, setHistoryDate] = useState<string>("");
  const [historyZone, setHistoryZone] = useState<FridgeZone | "Toutes">("Toutes");
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  // Alerte: températures non remplies 30 min après le créneau programmé
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const missingTempEquipments = useMemo(() => {
    if (date !== serviceDateStr(now)) return [] as typeof EQUIPMENTS;
    const slotHour = slot === "07h" ? 7 : slot === "16h" ? 16 : 0;
    const slotStart = new Date(now);
    slotStart.setHours(slotHour, 0, 0, 0);
    // Pour le créneau 00h, l'heure de référence est minuit du jour civil suivant la date de service
    if (slot === "00h") {
      slotStart.setDate(slotStart.getDate() + 1);
    }
    const diffMin = (now.getTime() - slotStart.getTime()) / 60000;
    if (diffMin < 30) return [];
    return EQUIPMENTS.filter((eq) => {
      const r = rows[eq.code];
      return !r || (!r.id && r.temperature.trim() === "");
    });
  }, [date, slot, rows, now]);

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
        temperature: rawTemp !== null && rawTemp !== undefined ? formatDisplayTemp(rawTemp, eq?.type) : (r.commentaire === "OFF" ? "OFF" : ""),
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
    const opByZone: Record<string, string> = {};
    (data ?? []).forEach((r: any) => {
      if (r.visa_manager && !visaByZone[r.zone]) visaByZone[r.zone] = r.visa_manager;
      if (r.performed_by && !opByZone[r.zone]) opByZone[r.zone] = r.performed_by;
    });
    setZoneVisa(visaByZone);
    setZoneOperator(opByZone);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, slot]);

  async function loadHistory() {
    if (!historyDate) { setHistoryRows([]); return; }
    setHistoryLoading(true);
    let q = supabase
      .from("fridge_temperatures")
      .select("*")
      .eq("control_date", historyDate)
      .order("zone", { ascending: true })
      .order("slot", { ascending: true })
      .order("equipment_code", { ascending: true });
    if (historyZone !== "Toutes") q = q.eq("zone", historyZone);
    const { data, error } = await q;
    setHistoryLoading(false);
    if (error) {
      toast({ title: "Erreur historique", description: error.message, variant: "destructive" });
      return;
    }
    setHistoryRows(data ?? []);
  }

  useEffect(() => { loadHistory(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyDate, historyZone]);

  function updateRow(code: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [code]: { ...(prev[code] ?? emptyRow()), ...patch } }));
  }

  async function saveRow(code: string) {
    const eq = EQUIPMENTS.find((e) => e.code === code);
    if (!eq) return;
    const row = rows[code] ?? emptyRow();
    const isOff = row.temperature.trim().toUpperCase() === "OFF";
    const tVal = isOff ? null : parseDisplayTemp(row.temperature);
    if (!isOff && tVal === null) {
      toast({ title: "Saisir la température", variant: "destructive" });
      return;
    }
    const operator = zoneOperator[eq.zone] || slotOperator || row.performed_by;
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
      temperature_haut: isOff ? null : tVal,
      temperature_bas: null,
      conformite: row.conformite || null,
      commentaire: isOff ? "OFF" : (row.commentaire?.trim() ? row.commentaire : "RAS"),
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
    const operator = zoneOperator[zone] || slotOperator;
    if (!operator) {
      toast({ title: "Opérateur requis", description: `Sélectionnez « Effectué par » pour la zone ${zone}`, variant: "destructive" });
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
      const isOff = r.temperature.trim().toUpperCase() === "OFF";
      const tVal = isOff ? null : parseDisplayTemp(r.temperature);
      if (!isOff && tVal === null) { ko++; continue; }
      const payload = {
        control_date: date, slot, zone: eq.zone,
        equipment_code: eq.code, equipment_name: eq.name, equipment_type: eq.type,
        temperature_haut: isOff ? null : tVal, temperature_bas: null,
        conformite: r.conformite || null,
        commentaire: isOff ? "OFF" : (r.commentaire?.trim() ? r.commentaire : "RAS"),
        action_corrective: r.action_corrective?.trim() ? r.action_corrective : "RAS",
        performed_by: operator,
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
          performed_by: operator,
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
        r.temperature === "OFF" ? "OFF" : (r.temperature || "—"),
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
        <>
        {(zonesMissingVisa.length > 0 || missingTempEquipments.length > 0) && (
          <Card>
            <CardContent className="p-4 space-y-2">
              {missingTempEquipments.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">
                      Températures non saisies (créneau {slot} dépassé de plus de 30 min)
                    </div>
                    <div className="text-xs opacity-90 mt-1">
                      {missingTempEquipments.length} équipement(s) en attente&nbsp;: {missingTempEquipments.map((e) => `${e.zone} – ${e.name}`).join(", ")}
                    </div>
                  </div>
                </div>
              )}
              {zonesMissingVisa.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Visa manager manquant</div>
                    <div className="text-xs opacity-90">
                      Aucun visa enregistré pour&nbsp;: {zonesMissingVisa.join(", ")}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {Object.entries(equipmentsByZone).map(([zone, equips], zoneIndex) => {
          // Conserver l'ordre fixe des équipements pour éviter que les lignes
          // ne se déplacent pendant la saisie.
          const sortedEquips = equips;
          return (
          <Card key={zone}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Zone : {zone}</CardTitle>
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
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (row.temperature === "OFF") return;
                              const cleaned = row.temperature.trim().replace(/^[+-]/, "");
                              updateRow(eq.code, { temperature: `+${cleaned}` });
                            }}
                            className={`h-9 w-7 rounded-md border text-sm font-bold flex items-center justify-center transition-colors ${row.temperature.startsWith("+") ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-input hover:bg-muted/80"}`}
                            disabled={!editable || row.temperature === "OFF"}
                          >+</button>
                          <button
                            type="button"
                            onClick={() => {
                              if (row.temperature === "OFF") return;
                              const cleaned = row.temperature.trim().replace(/^[+-]/, "");
                              updateRow(eq.code, { temperature: `-${cleaned}` });
                            }}
                            className={`h-9 w-7 rounded-md border text-sm font-bold flex items-center justify-center transition-colors ${row.temperature.startsWith("-") ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-input hover:bg-muted/80"}`}
                            disabled={!editable || row.temperature === "OFF"}
                          >-</button>
                          <button
                            type="button"
                            onClick={() => {
                              if (row.temperature === "OFF") {
                                updateRow(eq.code, { temperature: "", conformite: "", commentaire: "", action_corrective: "" });
                              } else {
                                updateRow(eq.code, { temperature: "OFF", conformite: "", commentaire: row.commentaire || "Matériel arrêté", action_corrective: "RAS" });
                              }
                            }}
                            className={`h-9 w-10 rounded-md border text-[10px] font-bold flex items-center justify-center transition-colors ${row.temperature === "OFF" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-input hover:bg-muted/80"}`}
                            disabled={!editable}
                          >OFF</button>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={row.temperature}
                            onChange={(e) => updateRow(eq.code, { temperature: e.target.value })}
                            onBlur={() => {
                              if (row.temperature.trim().toUpperCase() === "OFF") return;
                              const sign = getSign(row.temperature, eq.type);
                              const formatted = formatWithSign(row.temperature, sign);
                              if (formatted !== row.temperature) updateRow(eq.code, { temperature: formatted });
                            }}
                            disabled={!editable || row.temperature === "OFF"}
                            className="h-9 w-20"
                            placeholder={eq.type.startsWith("Frigo positif") || eq.type === "Chambre positive" ? "+" : "-"}
                          />
                        </div>
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
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (row.temperature === "OFF") return;
                              const cleaned = row.temperature.trim().replace(/^[+-]/, "");
                              updateRow(eq.code, { temperature: `+${cleaned}` });
                            }}
                            className={`h-10 w-8 rounded-md border text-sm font-bold flex items-center justify-center transition-colors ${row.temperature.startsWith("+") ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-input hover:bg-muted/80"}`}
                            disabled={!editable || row.temperature === "OFF"}
                          >+</button>
                          <button
                            type="button"
                            onClick={() => {
                              if (row.temperature === "OFF") return;
                              const cleaned = row.temperature.trim().replace(/^[+-]/, "");
                              updateRow(eq.code, { temperature: `-${cleaned}` });
                            }}
                            className={`h-10 w-8 rounded-md border text-sm font-bold flex items-center justify-center transition-colors ${row.temperature.startsWith("-") ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-input hover:bg-muted/80"}`}
                            disabled={!editable || row.temperature === "OFF"}
                          >-</button>
                          <button
                            type="button"
                            onClick={() => {
                              if (row.temperature === "OFF") {
                                updateRow(eq.code, { temperature: "", conformite: "", commentaire: "", action_corrective: "" });
                              } else {
                                updateRow(eq.code, { temperature: "OFF", conformite: "", commentaire: row.commentaire || "Matériel arrêté", action_corrective: "RAS" });
                              }
                            }}
                            className={`h-10 w-10 rounded-md border text-[10px] font-bold flex items-center justify-center transition-colors ${row.temperature === "OFF" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-input hover:bg-muted/80"}`}
                            disabled={!editable}
                          >OFF</button>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={row.temperature}
                            onChange={(e) => updateRow(eq.code, { temperature: e.target.value })}
                            onBlur={() => {
                              if (row.temperature.trim().toUpperCase() === "OFF") return;
                              const sign = getSign(row.temperature, eq.type);
                              const formatted = formatWithSign(row.temperature, sign);
                              if (formatted !== row.temperature) updateRow(eq.code, { temperature: formatted });
                            }}
                            disabled={!editable || row.temperature === "OFF"}
                            className="h-10 text-base font-semibold flex-1"
                            placeholder={eq.type.startsWith("Frigo positif") || eq.type === "Chambre positive" ? "+" : "-"}
                          />
                        </div>
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
                <Label className="text-xs">Effectué par (zone) *</Label>
                <Select
                  value={zoneOperator[zone] || "__none"}
                  onValueChange={(v) => setZoneOperator((p) => ({ ...p, [zone]: v === "__none" ? "" : v }))}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Opérateur" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
      })}
        </>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historique des températures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Filtrer par date</Label>
              <Input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} />
            </div>
            <div>
              <Label>Zone</Label>
              <Select value={historyZone} onValueChange={(v) => setHistoryZone(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Toutes">Toutes les zones</SelectItem>
                  {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!historyDate ? (
            <p className="text-sm text-muted-foreground">Sélectionnez une date pour afficher l'historique.</p>
          ) : historyLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : historyRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune saisie pour ces filtres.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead>Créneau</TableHead>
                    <TableHead>Équipement</TableHead>
                    <TableHead>Temp.</TableHead>
                    <TableHead>Conforme</TableHead>
                    <TableHead>Effectué par</TableHead>
                    <TableHead>Visa</TableHead>
                    <TableHead>Commentaire</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRows.map((r: any) => {
                    const t = r.temperature_haut ?? r.temperature_bas;
                    const temp = t !== null && t !== undefined ? formatDisplayTemp(t, r.equipment_type) : (r.commentaire === "OFF" ? "OFF" : "—");
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{r.zone}</TableCell>
                        <TableCell className="text-xs">{r.slot}</TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">{r.equipment_name}</div>
                          <div className="text-muted-foreground font-mono">{r.equipment_code}</div>
                        </TableCell>
                        <TableCell className="text-xs font-semibold">{temp}</TableCell>
                        <TableCell className="text-xs">
                          {r.conformite === "conforme" ? "✓" : r.conformite === "non_conforme" ? "✗" : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{r.performed_by || "—"}</TableCell>
                        <TableCell className="text-xs">{r.visa_manager || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{r.commentaire || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default FridgeTemperatureManager;