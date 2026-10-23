import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CustomZoneKind = "cleaning" | "fridge";

export interface CustomZone {
  id: string;
  pdvId: string;
  kind: CustomZoneKind;
  key: string;
  label: string;
  tasks: string[];
}

const table = () => (supabase as any).from("pdv_custom_zones");

export async function fetchCustomZones(pdvId: string, kind?: CustomZoneKind): Promise<CustomZone[]> {
  let q = table().select("*").eq("pdv_id", pdvId).order("created_at");
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id, pdvId: r.pdv_id, kind: r.kind, key: r.zone_key, label: r.label,
    tasks: Array.isArray(r.tasks) ? r.tasks.map(String) : [],
  }));
}

export function slugZoneKey(label: string): string {
  return "custom_" + label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export async function addCustomZone(pdvId: string, kind: CustomZoneKind, label: string, tasks: string[] = []) {
  const clean = label.trim();
  const key = kind === "fridge" ? clean : slugZoneKey(clean);
  const { error } = await table().insert({ pdv_id: pdvId, kind, zone_key: key, label: clean, tasks });
  if (error) throw error;
}

export async function deleteCustomZone(id: string) {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
}

export function useCustomZones(pdvId: string | null | undefined, kind: CustomZoneKind) {
  const [zones, setZones] = useState<CustomZone[]>([]);
  const reload = useCallback(async () => {
    if (!pdvId) { setZones([]); return; }
    try { setZones(await fetchCustomZones(pdvId, kind)); } catch { setZones([]); }
  }, [pdvId, kind]);
  useEffect(() => { void reload(); }, [reload]);
  return { zones, reload };
}
