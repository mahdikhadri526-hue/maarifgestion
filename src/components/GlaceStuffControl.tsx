import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Snowflake, Printer } from "lucide-react";
import { toast } from "sonner";
import { useManagers } from "@/lib/roster";
import { cn, formatDateFR } from "@/lib/utils";
import { printStructuredPdf } from "@/lib/printExport";
import { GLACE_PARFUMS, fetchGlaceFifoLots } from "@/lib/glaceLotFifo";

const SLOTS = ["08h00", "10h00", "12h00", "14h00", "16h00", "18h00", "20h00", "22h00", "00h00"];
const MAX_LINES = 12;
const ZONES = ["Salle", "Emporter"] as const;
type Zone = (typeof ZONES)[number];
const ANOMALIES = ["Fissure", "Cassure"] as const;

type Row = {
  slot: string;
  line_index: number;
  non_conformite: boolean | null;
  parfum: string;
  lot_number: string;
  anomalie: string;
  plastique: boolean | null;
  action_corrective: string;
  visa_manager: string;
};

const emptyRow = (slot: string, line_index: number): Row => ({
  slot,
  line_index,
  non_conformite: null,
  parfum: "",
  lot_number: "",
  anomalie: "",
  plastique: null,
  action_corrective: "",
  visa_manager: "",
});

const keyOf = (slot: string, line: number) => `${slot}#${line}`;

export function GlaceStuffControl() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [zone, setZone] = useState<Zone>("Salle");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(false);
  const managerOptions = useManagers();
  const [fifoLots, setFifoLots] = useState<Record<string, string>>({});
  const [lineCounts, setLineCounts] = useState<Record<string, number>>({});

  const linesOf = useCallback(
    (slot: string) => Array.from({ length: lineCounts[slot] ?? 1 }, (_, i) => i),
    [lineCounts],
  );

  useEffect(() => {
    let active = true;
    fetchGlaceFifoLots().then((m) => {
      if (active) setFifoLots(m);
    });
    return () => {
      active = false;
    };
  }, [date]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("glace_stuff_controls" as any)
      .select("*")
      .eq("control_date", date)
      .eq("zone", zone);
    setLoading(false);
    if (error) {
      toast.error("Erreur de chargement", { description: error.message });
      return;
    }
    const next: Record<string, Row> = {};
    const counts: Record<string, number> = {};
    for (const slot of SLOTS) {
      counts[slot] = 1;
      next[keyOf(slot, 0)] = emptyRow(slot, 0);
    }
    for (const r of (data ?? []) as any[]) {
      const k = keyOf(r.slot, r.line_index);
      if (!SLOTS.includes(r.slot)) continue;
      counts[r.slot] = Math.max(counts[r.slot] ?? 1, (r.line_index ?? 0) + 1);
      next[k] = {
        slot: r.slot,
        line_index: r.line_index,
        non_conformite: r.non_conformite,
        parfum: r.parfum ?? "",
        lot_number: r.lot_number ?? "",
        anomalie: r.anomalie ?? "",
        plastique: r.plastique,
        action_corrective: r.action_corrective ?? "",
        visa_manager: r.visa_manager ?? "",
      };
    }
    setRows(next);
    setLineCounts(counts);
  }, [date, zone]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (row: Row) => {
      const { error } = await supabase.from("glace_stuff_controls" as any).upsert(
        {
          control_date: date,
          zone,
          slot: row.slot,
          line_index: row.line_index,
          non_conformite: row.non_conformite,
          parfum: row.parfum || null,
          lot_number: row.lot_number || null,
          anomalie: row.anomalie || null,
          plastique: row.plastique,
          action_corrective: row.action_corrective || null,
          visa_manager: row.visa_manager || null,
        },
        { onConflict: "control_date,zone,slot,line_index" },
      );
      if (error) toast.error("Enregistrement impossible", { description: error.message });
    },
    [date, zone],
  );

  const update = (slot: string, line: number, patch: Partial<Row>, persist = true) => {
    const k = keyOf(slot, line);
    setRows((prev) => {
      const current = prev[k] ?? emptyRow(slot, line);
      const next = { ...current, ...patch };
      if (persist) void save(next);
      return { ...prev, [k]: next };
    });
  };

  const get = (slot: string, line: number) => rows[keyOf(slot, line)] ?? emptyRow(slot, line);

  const filledCount = useMemo(
    () =>
      Object.values(rows).filter(
        (r) => r.parfum || r.lot_number || r.anomalie || r.non_conformite !== null || r.plastique !== null,
      ).length,
    [rows],
  );

  const handlePrint = async () => {
    await printStructuredPdf({
      filename: `controle-stuffs-glace-${date}-${zone}`,
      title: "Contrôle des STUFFS de glace",
      subtitle: `${formatDateFR(date)} — ${zone}`,
      meta: [`Lignes renseignées : ${filledCount}`],
      sections: [
        {
          title: "Prévenir tout risque de contamination par des corps étrangers",
          columns: [
            { header: "Heure", dataKey: "slot", width: 18, halign: "center" },
            { header: "Non-conformité", dataKey: "nc", width: 26, halign: "center" },
            { header: "Parfum", dataKey: "parfum" },
            { header: "N° de Lot", dataKey: "lot" },
            { header: "Anomalie", dataKey: "anomalie" },
            { header: "Morceau de plastique", dataKey: "plastique", width: 30, halign: "center" },
            { header: "Action corrective", dataKey: "action", width: 30, halign: "center" },
            { header: "Signature manager", dataKey: "visa", width: 32 },
          ],
          rows: SLOTS.flatMap((slot) =>
            LINES.map((l) => {
              const r = get(slot, l);
              return {
                slot: l === 0 ? slot : "",
                nc: r.non_conformite === null ? "" : r.non_conformite ? "Oui" : "Non",
                parfum: r.parfum,
                lot: r.lot_number,
                anomalie: r.anomalie,
                plastique: r.plastique === null ? "" : r.plastique ? "Oui" : "Non",
                action: r.action_corrective,
                visa: r.visa_manager,
              };
            }),
          ),
        },
      ],
    });
  };

  const YesNo = ({
    value,
    onChange,
  }: {
    value: boolean | null;
    onChange: (v: boolean | null) => void;
  }) => (
    <div className="flex gap-1 justify-center">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(value === v ? null : v)}
          className={cn(
            "px-2 py-0.5 rounded border text-[11px] leading-4",
            value === v
              ? v
                ? "bg-destructive text-destructive-foreground border-destructive"
                : "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground",
          )}
        >
          {v ? "Oui" : "Non"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-4 border-b">
        <Snowflake className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold mr-auto">Contrôle des STUFFS de glace</h2>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 w-[150px]"
        />
        <Select value={zone} onValueChange={(v) => setZone(v as Zone)}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ZONES.map((z) => (
              <SelectItem key={z} value={z}>
                {z}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" /> Imprimer
        </Button>
      </div>

      <p className="px-4 py-2 text-xs text-muted-foreground border-b">
        Objectif : prévenir tout risque de contamination par des corps étrangers.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[900px]">
          <thead className="bg-muted/60">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/60 border p-2 w-[70px]">Heure</th>
              <th className="border p-2 w-[110px]">Non-conformité</th>
              <th className="border p-2">Parfum</th>
              <th className="border p-2 w-[130px]">N° de Lot</th>
              <th className="border p-2">Anomalie</th>
              <th className="border p-2 w-[110px]">Morceau de plastique</th>
              <th className="border p-2 w-[140px]">Action corrective</th>
              <th className="border p-2 w-[150px]">Signature manager</th>
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot) =>
              LINES.map((l) => {
                const r = get(slot, l);
                return (
                  <tr key={keyOf(slot, l)} className={l === 0 ? "border-t-2 border-t-primary/30" : ""}>
                    {l === 0 && (
                      <td
                        rowSpan={LINES.length}
                        className="sticky left-0 z-10 bg-card border p-2 text-center font-semibold"
                      >
                        {slot}
                      </td>
                    )}
                    {l === 0 && (
                      <td rowSpan={LINES.length} className="border p-2">
                        <YesNo
                          value={get(slot, 0).non_conformite}
                          onChange={(v) => update(slot, 0, { non_conformite: v })}
                        />
                      </td>
                    )}
                    <td className="border p-1">
                      <Select
                        value={r.parfum}
                        onValueChange={(v) =>
                          update(slot, l, { parfum: v, lot_number: fifoLots[v] ?? "" })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Parfum" />
                        </SelectTrigger>
                        <SelectContent>
                          {GLACE_PARFUMS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="border p-1">
                      <Input
                        className="h-8 text-xs bg-muted/50"
                        readOnly
                        placeholder={r.parfum ? "Aucun lot dispo" : "Choisir un parfum"}
                        value={r.lot_number}
                      />
                    </td>
                    <td className="border p-1">
                      <div className="flex gap-1 justify-center">
                        {ANOMALIES.map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => update(slot, l, { anomalie: r.anomalie === a ? "" : a })}
                            className={cn(
                              "px-2 py-0.5 rounded border text-[11px] leading-4",
                              r.anomalie === a
                                ? "bg-destructive text-destructive-foreground border-destructive"
                                : "bg-background text-muted-foreground",
                            )}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="border p-1">
                      <YesNo value={r.plastique} onChange={(v) => update(slot, l, { plastique: v })} />
                    </td>
                    <td className="border p-1">
                      <div className="flex gap-1 justify-center">
                        {["Changer", "Isoler"].map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() =>
                              update(slot, l, { action_corrective: r.action_corrective === a ? "" : a })
                            }
                            className={cn(
                              "px-2 py-0.5 rounded border text-[11px] leading-4",
                              r.action_corrective === a
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground",
                            )}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </td>
                    {l === 0 && (
                      <td rowSpan={LINES.length} className="border p-1">
                        {managerOptions.length > 0 ? (
                          <Select
                            value={get(slot, 0).visa_manager}
                            onValueChange={(v) => update(slot, 0, { visa_manager: v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Visa" />
                            </SelectTrigger>
                            <SelectContent>
                              {managerOptions.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className="h-8 text-xs"
                            value={get(slot, 0).visa_manager}
                            onChange={(e) => update(slot, 0, { visa_manager: e.target.value }, false)}
                            onBlur={() => save(get(slot, 0))}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      {loading && <p className="p-3 text-xs text-muted-foreground">Chargement…</p>}
    </div>
  );
}

export default GlaceStuffControl;