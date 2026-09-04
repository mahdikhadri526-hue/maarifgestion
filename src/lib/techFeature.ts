/**
 * Module « Suivi Technique » : visible en aperçu (preview / localhost) et,
 * sur les domaines publiés, uniquement pour le compte du responsable technique.
 * Masqué pour tous les autres comptes tant que le signal « go » n'a pas été donné.
 */
export const TECH_ACCOUNT_EMAILS = ["gestion-technique@oliveri.com"];

export function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.startsWith("id-preview--") && host.endsWith(".lovable.app")) return true;
  if (host.endsWith(".lovableproject.com")) return true;
  return false;
}

export function isTechEnabled(email?: string | null): boolean {
  if (isPreviewHost()) return true;
  return !!email && TECH_ACCOUNT_EMAILS.includes(email.trim().toLowerCase());
}

/** @deprecated préférer isTechEnabled(user?.email) */
export const TECH_ENABLED = isPreviewHost();
