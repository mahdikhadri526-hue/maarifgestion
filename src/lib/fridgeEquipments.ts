import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/db";
import { EQUIPMENTS, ZONES, type FridgeEquipment, type FridgeZone } from "@/lib/fridgeData";

export interface CustomEquipmentRow extends FridgeEquipment {
  id: string;
  sort_order: number;
  active: boolean;
}

export const EQUIPMENT_TYPES = [
  { value: "Frigo négatif", label: "Négatif" },
  { value: "Frigo positif", label: "Positif" },
] as const;

const ZONE_PREFIX: Record<FridgeZone, string> = {
  Salle: "SAL",
  Emporter: "EMP",
  "Entre-sol": "ETS",
  Passe: "PAS",
};

/** Génère un code unique du même style que les matériels existants (ex: SAL-N04). */
export function generateEquipmentCode(zone: FridgeZone, type: string, existing: string[]): string {
  const prefix = ZONE_PREFIX[zone] ?? "MAT";
  const letter = type.includes("négatif") || type === "Chambre négative" ? "N" : "P";
  const base = `${prefix}-${letter}`;
  const used = new Set(existing);
  let n = 1;
  while (used.has(`${base}${String(n).padStart(2, "0")}`)) n += 1;
  return `${base}${String(n).padStart(2, "0")}`;
}

export async function fetchCustomEquipments(): Promise<CustomEquipmentRow[]> {
  const { data, error } = await supabase
    .from("fridge_equipments" as any)
    .select("id, code, name, type, zone, sort_order, active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    zone: r.zone as FridgeZone,
    sort_order: r.sort_order ?? 0,
    active: r.active !== false,
  }));
}

/** Liste complète : matériels d'origine + matériels ajoutés par l'admin. */
export function mergeEquipments(custom: CustomEquipmentRow[]): FridgeEquipment[] {
  const extras = custom.filter((c) => c.active);
  const list: FridgeEquipment[] = [];
  ZONES.forEach((z) => {
    EQUIPMENTS.filter((e) => e.zone === z).forEach((e) => list.push(e));
    extras.filter((e) => e.zone === z).forEach((e) => list.push({ code: e.code, name: e.name, type: e.type, zone: e.zone }));
  });
  return list;
}

export function useFridgeEquipments() {
  const [custom, setCustom] = useState<CustomEquipmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setCustom(await fetchCustomEquipments());
    } catch {
      setCustom([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { custom, equipments: mergeEquipments(custom), loading, reload };
}
