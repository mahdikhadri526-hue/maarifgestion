import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string (ISO yyyy-mm-dd, dd/mm/yyyy, or any Date-parsable string)
 * to French short format dd/mm/yyyy. Returns the original string if invalid.
 */
export function formatDateFR(value?: string | null): string {
  if (!value) return "";
  // already dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  // yyyy-mm-dd (avoid timezone shift)
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}
