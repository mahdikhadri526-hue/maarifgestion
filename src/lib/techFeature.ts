/**
 * Module « Suivi Technique » : visible partout (aperçu ET domaines publiés).
 * Modules « Pointage », « RH » et « Planning » : visibles uniquement en
 * aperçu (preview / localhost), masqués sur les domaines publiés
 * tant que le signal « go » n'a pas été donné (voir isPreviewHost).
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

export function isTechEnabled(_email?: string | null): boolean {
  // Suivi Technique publié : visible pour tous les comptes, partout.
  return true;
}

/** @deprecated préférer isTechEnabled(user?.email) */
export const TECH_ENABLED = true;
