/**
 * Module « Suivi Technique » : visible uniquement en aperçu (preview / localhost).
 * Masqué sur les domaines publiés tant que le signal « go » n'a pas été donné.
 */
export function isTechEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.startsWith("id-preview--") && host.endsWith(".lovable.app")) return true;
  if (host.endsWith(".lovableproject.com")) return true;
  return false;
}

export const TECH_ENABLED = isTechEnabled();
