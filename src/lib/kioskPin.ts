import { supabase } from "@/integrations/supabase/client";

const DEFAULT_PIN = "1975";
let cachedPin: string | null = null;

export async function getKioskPin(): Promise<string> {
  if (cachedPin) return cachedPin;
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "kiosk_pin")
      .maybeSingle();
    cachedPin = data?.value || DEFAULT_PIN;
  } catch {
    cachedPin = DEFAULT_PIN;
  }
  return cachedPin;
}

export async function checkKioskPin(pin: string): Promise<boolean> {
  return pin === (await getKioskPin());
}

export async function setKioskPin(newPin: string): Promise<boolean> {
  const { error } = await supabase
    .from("app_settings")
    .update({ value: newPin, updated_at: new Date().toISOString() })
    .eq("key", "kiosk_pin");
  if (error) return false;
  cachedPin = newPin;
  return true;
}
