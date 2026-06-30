import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Thermometer, Save, AlertTriangle, CheckCircle2, FileDown, Volume2, VolumeX } from "lucide-react";
import { EQUIPMENTS, SLOTS, ZONES, formatDisplayTemp, parseDisplayTemp, type FridgeSlot, type FridgeZone } from "@/lib/fridgeData";
import { OPERATORS } from "@/lib/operators";
import { MANAGERS } from "@/lib/managers";
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface RowState {
  id?: string;
  temperature: string;
  conformite: "" | "conforme" | "non_conforme";
  commentaire: string;
  action_corrective: string;
  performed_by: string;
  visa_manager: string;
  created_at?: string;
}

interface MissingTemperatureAlert {
  slot: FridgeSlot;
  equipments: typeof EQUIPMENTS;
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

function formatTime(ts?: string): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function FridgeTemperatureManager() {
  const { can, user } = useAuth();
  const isNoDeleteUser = user?.email === "gestionmaarif1@gmail.com";
  const canEdit = can("edit_temperatures");
  const canDelete = can("delete_temperatures") && !isNoDeleteUser;
  const { toast } = useToast();

  const [date, setDate] = useState<string>(serviceDateStr());
  const [slot, setSlot] = useState<FridgeSlot>(currentSlot());
  const [zoneFilter, setZoneFilter] = useState<FridgeZone | "">("Salle");

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [slotOperator, setSlotOperator] = useState<string>("");
  const [savingZone, setSavingZone] = useState<FridgeZone | null>(null);
  const [zoneVisa, setZoneVisa] = useState<Record<string, string>>({});
  const [zoneOperator, setZoneOperator] = useState<Record<string, string>>({});
  const [savedTodayBySlot, setSavedTodayBySlot] = useState<Record<FridgeSlot, Set<string>>>(() => ({
    "07h": new Set<string>(),
    "16h": new Set<string>(),
    "00h": new Set<string>(),
  }));

  // Historique
  const [historyDate, setHistoryDate] = useState<string>("");
  const [historyZone, setHistoryZone] = useState<FridgeZone | "Toutes">("Toutes");
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const visibleEquipments = useMemo(
    () => (zoneFilter === "" ? [] : EQUIPMENTS.filter((e) => e.zone === zoneFilter)),
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

  const currentServiceDate = serviceDateStr(now);

  const getSlotDeadline = useCallback((targetSlot: FridgeSlot, serviceDateValue: string) => {
    const [year, month, day] = serviceDateValue.split("-").map(Number);
    const deadline = new Date(year, month - 1, day, targetSlot === "07h" ? 7 : targetSlot === "16h" ? 16 : 0, 30, 0, 0);
    // Le créneau 00h appartient à la fin du service, donc au jour civil suivant.
    if (targetSlot === "00h") deadline.setDate(deadline.getDate() + 1);
    return deadline;
  }, []);

  const overdueSlots = useMemo(() => {
    return SLOTS.filter((targetSlot) => now >= getSlotDeadline(targetSlot, currentServiceDate));
  }, [currentServiceDate, getSlotDeadline, now]);

  const missingTempAlerts = useMemo<MissingTemperatureAlert[]>(() => {
    if (date !== currentServiceDate) return [];

    return overdueSlots
      .map((targetSlot) => {
        const savedCodes = new Set(savedTodayBySlot[targetSlot]);

        if (targetSlot === slot) {
          EQUIPMENTS.forEach((eq) => {
            const row = rows[eq.code];
            if (row?.id || row?.temperature.trim()) savedCodes.add(eq.code);
          });
        }

        return {
          slot: targetSlot,
          equipments: EQUIPMENTS.filter((eq) => !savedCodes.has(eq.code)),
        };
      })
      .filter((alert) => alert.equipments.length > 0);
  }, [currentServiceDate, date, overdueSlots, rows, savedTodayBySlot, slot]);

  const missingTempCount = useMemo(
    () => missingTempAlerts.reduce((total, alert) => total + alert.equipments.length, 0),
    [missingTempAlerts]
  );

  // Alerte sonore quand des températures sont manquantes après le créneau
  const [soundMuted, setSoundMuted] = useState<boolean>(() => {
    try { return localStorage.getItem("fridge_alert_muted") === "1"; } catch { return false; }
  });
  const audioContextRef = useRef<AudioContext | null>(null);

  const playAlertBeep = useCallback(() => {
    try {
      const AC: typeof AudioContext | undefined =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!audioContextRef.current) audioContextRef.current = new AC();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const start = ctx.currentTime + 0.03;
      [880, 1046, 880].forEach((frequency, i) => {
        const t0 = start + i * 0.28;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.24);
      });
    } catch {}
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      if (!soundMuted && missingTempCount > 0) playAlertBeep();
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [missingTempCount, playAlertBeep, soundMuted]);

  useEffect(() => {
    try { localStorage.setItem("fridge_alert_muted", soundMuted ? "1" : "0"); } catch {}
  }, [soundMuted]);

  useEffect(() => {
    if (soundMuted) return;
    if (missingTempCount === 0) return;
    playAlertBeep();
    const id = setInterval(playAlertBeep, 8000);
    return () => {
      clearInterval(id);
    };
  }, [missingTempCount, playAlertBeep, soundMuted]);

  useEffect(() => {
    return () => {
      try { audioContextRef.current?.close(); } catch {}
    };
  }, []);

  async function loadSavedTodayBySlot() {
    const serviceDate = serviceDateStr();
    const { data, error } = await supabase
      .from("fridge_temperatures")
      .select("slot,equipment_code")
      .eq("control_date", serviceDate);
    if (error) return;

    const next: Record<FridgeSlot, Set<string>> = {
      "07h": new Set<string>(),
      "16h": new Set<string>(),
      "00h": new Set<string>(),
    };
    (data ?? []).forEach((r: any) => {
      if (SLOTS.includes(r.slot as FridgeSlot) && r.equipment_code) {
        next[r.slot as FridgeSlot].add(r.equipment_code);
      }
    });
    setSavedTodayBySlot(next);
  }

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
        created_at: r.created_at,
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
    void loadSavedTodayBySlot();
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
      created_at: data.created_at,
    });
    setSavedTodayBySlot((prev) => ({
      ...prev,
      [slot]: new Set(prev[slot]).add(code),
    }));
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
    const savedCodes: string[] = [];
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
        savedCodes.push(eq.code);
        updateRow(eq.code, {
          id: data.id,
          performed_by: operator,
          visa_manager: visa,
          commentaire: payload.commentaire,
          action_corrective: payload.action_corrective,
          created_at: data.created_at,
        });
      }
    }
    if (ok > 0) {
      setSavedTodayBySlot((prev) => {
        const nextSlot = new Set(prev[slot]);
        savedCodes.forEach((code) => nextSlot.add(code));
        return { ...prev, [slot]: nextSlot };
      });
    }
    setSavingZone(null);
    toast({ title: `Zone ${zone} enregistrée`, description: `${ok} ligne(s) enregistrée(s)${ko ? `, ${ko} erreur(s)` : ""}` });
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("Prise de température des frigos (HACCP)", 14, 14);
    doc.setFontSize(10);
    doc.text(`Date : ${date}   Créneau : ${slot}   Zone : ${zoneFilter || "—"}   Effectué par : ${slotOperator || "—"}`, 14, 21);

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
    setSavedTodayBySlot((prev) => {
      const nextSlot = new Set(prev[slot]);
      nextSlot.delete(code);
      return { ...prev, [slot]: nextSlot };
    });
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
              <Select value={zoneFilter} onValueChange={(v) => setZoneFilter(v as FridgeZone)}>
                <SelectTrigger><SelectValue placeholder="Choisir une zone..." /></SelectTrigger>
                <SelectContent>
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
          <div className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <div className="font-medium">Alerte sonore températures</div>
              <div className="text-xs text-muted-foreground">
                {missingTempCount > 0
                  ? `${missingTempCount} température(s) en retard aujourd'hui`
                  : "Aucune température en retard aujourd'hui"}
              </div>
            </div>
            <Button
              type="button"
              variant={soundMuted ? "outline" : "default"}
              size="sm"
              onClick={() => {
                setSoundMuted((m) => !m);
                if (soundMuted) playAlertBeep();
              }}
            >
              {soundMuted ? <VolumeX className="h-4 w-4 mr-1" /> : <Volume2 className="h-4 w-4 mr-1" />}
              {soundMuted ? "Activer le son" : "Couper le son"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Chargement…</CardContent></Card>
      ) : (
        <>
        {(zonesMissingVisa.length > 0 || missingTempCount > 0) && (
          <Card>
            <CardContent className="p-4 space-y-2">
              {missingTempCount > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium">
                      Températures non saisies à l'heure prévue
                    </div>
                    <div className="space-y-1 text-xs opacity-90 mt-1">
                      {missingTempAlerts.map((alert) => (
                        <div key={alert.slot}>
                          <strong>{alert.slot}</strong>&nbsp;: {alert.equipments.length} équipement(s) en attente&nbsp;: {alert.equipments.map((e) => `${e.zone} – ${e.name}`).join(", ")}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    onClick={() => setSoundMuted((m) => !m)}
                    title={soundMuted ? "Activer le son" : "Couper le son"}
                  >
                    {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
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
        {zoneFilter === "" ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Sélectionnez une zone dans le filtre ci-dessus pour afficher la check-list des équipements.
            </CardContent>
          </Card>
        ) : (
          Object.entries(equipmentsByZone).map(([zone, equips]) => {
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
                            <TableCell className="font-mono text-xs">
                              {eq.code}
                              {row.created_at && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">{formatTime(row.created_at)}</div>
                              )}
                            </TableCell>
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
                          {row.created_at && (
                            <div className="mt-2 text-[10px] text-muted-foreground">
                              Prise à {formatTime(row.created_at)}
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
          })
        )}
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
                    <TableHead>Heure</TableHead>
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
                        <TableCell className="text-xs">{formatTime(r.created_at) || "—"}</TableCell>
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