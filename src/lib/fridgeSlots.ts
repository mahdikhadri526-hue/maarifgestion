import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FridgeSlotDef { id?: string; label: string; hour: number; minute: number; sort_order: number }

export const DEFAULT_FRIDGE_SLOTS: FridgeSlotDef[] = [
  { label: "07h", hour: 7, minute: 0, sort_order: 1 },
  { label: "16h", hour: 16, minute: 0, sort_order: 2 },
  { label: "00h", hour: 0, minute: 0, sort_order: 3 },
];

/** Les créneaux avant 5h appartiennent à la fin du service (jour civil suivant). */
export const SERVICE_DAY_START_HOUR = 5;

export function slotServiceMinutes(s: Pick<FridgeSlotDef, "hour" | "minute">) {
  const h = s.hour < SERVICE_DAY_START_HOUR ? s.hour + 24 : s.hour;
  return h * 60 + s.minute;
}

export function sortSlots(list: FridgeSlotDef[]) {
  return [...list].sort((a, b) => slotServiceMinutes(a) - slotServiceMinutes(b));
}

/** Créneau courant : le dernier créneau déjà commencé dans le service. */
export function pickCurrentSlot(list: FridgeSlotDef[], d = new Date()): string {
  const sorted = sortSlots(list);
  if (!sorted.length) return "";
  const nowH = d.getHours() < SERVICE_DAY_START_HOUR ? d.getHours() + 24 : d.getHours();
  const nowM = nowH * 60 + d.getMinutes();
  let current = sorted[0];
  for (const s of sorted) if (slotServiceMinutes(s) - 60 <= nowM) current = s;
  return current.label;
}

export async function fetchFridgeSlots(): Promise<FridgeSlotDef[]> {
  const { data, error } = await supabase.from("fridge_slots").select("id,label,hour,minute,sort_order");
  if (error || !data?.length) return DEFAULT_FRIDGE_SLOTS;
  return sortSlots(data as FridgeSlotDef[]);
}

export function useFridgeSlots() {
  const [slots, setSlots] = useState<FridgeSlotDef[]>(DEFAULT_FRIDGE_SLOTS);
  const reload = useCallback(async () => setSlots(await fetchFridgeSlots()), []);
  useEffect(() => { void reload(); }, [reload]);
  return { slots, reload };
}
