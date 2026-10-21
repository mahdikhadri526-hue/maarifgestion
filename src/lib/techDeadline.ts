import { TECH_ACCOUNT_EMAILS } from "@/lib/techFeature";

export function canCorrectTechDeadline(email: string | null | undefined, canManage: boolean): boolean {
  return canManage && TECH_ACCOUNT_EMAILS.includes((email ?? "").toLowerCase());
}

export function isChangedDeadline(current: string | null, next: string): boolean {
  if (!current || !/^\d{4}-\d{2}-\d{2}$/.test(next) || next === current) return false;
  const date = new Date(`${next}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === next;
}