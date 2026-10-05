import { supabase } from "@/integrations/supabase/client";

// The kiosk code is verified server-side; it is never sent to the browser.
export async function checkKioskPin(pin: string): Promise<boolean> {
  try {
    const { data, error } = await (supabase.rpc as any)("verify_kiosk_pin", { _pin: pin });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export async function setKioskPin(newPin: string): Promise<boolean> {
  const { error } = await supabase
    .from("app_settings")
    .update({ value: newPin, updated_at: new Date().toISOString() })
    .eq("key", "kiosk_pin");
  return !error;
}
