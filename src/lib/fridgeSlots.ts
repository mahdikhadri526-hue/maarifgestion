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

/** Créneaux exacts d'une portée : pdvId = null → créneaux par défaut (tous les PDV). */
export async function fetchSlotsForScope(pdvId: string | null): Promise<FridgeSlotDef[]> {
  let q = supabase.from("fridge_slots").select("id,label,hour,minute,sort_order");
  q = pdvId ? q.eq("pdv_id", pdvId) : q.is("pdv_id", null);
  const { data, error } = await q;
  if (error) return [];
  return sortSlots((data ?? []) as FridgeSlotDef[]);
}

/** Créneaux effectifs d'un PDV : les siens s'il en a, sinon ceux par défaut. */
export async function fetchFridgeSlots(pdvId?: string | null): Promise<FridgeSlotDef[]> {
  if (pdvId) {
    const own = await fetchSlotsForScope(pdvId);
    if (own.length) return own;
  }
  const def = await fetchSlotsForScope(null);
  return def.length ? def : DEFAULT_FRIDGE_SLOTS;
}

export function useFridgeSlots(pdvId?: string | null) {
  const [slots, setSlots] = useState<FridgeSlotDef[]>(DEFAULT_FRIDGE_SLOTS);
  const reload = useCallback(async () => setSlots(await fetchFridgeSlots(pdvId)), [pdvId]);
  useEffect(() => { void reload(); }, [reload]);
  return { slots, reload };
}
