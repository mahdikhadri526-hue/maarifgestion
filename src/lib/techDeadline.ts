import { TECH_ACCOUNT_EMAILS } from "@/lib/techFeature";

export function canExtendTechDeadline(email: string | null | undefined, canManage: boolean): boolean {
  return canManage && TECH_ACCOUNT_EMAILS.includes((email ?? "").toLowerCase());
}

export function isLaterDeadline(current: string | null, next: string): boolean {
  return !!current && /^\d{4}-\d{2}-\d{2}$/.test(next) && next > current;
}