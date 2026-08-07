import { useAuth } from "@/contexts/AuthContext";
import { OPERATORS } from "@/lib/operators";
import { MANAGERS } from "@/lib/managers";

// Les listes de noms (Effectué par / Collaborateur / Visa manager) ne sont
// visibles que pour l'admin principal et le compte gestionmaarif1@gmail.com.
// Pour tous les autres PDV/comptes, les listes sont vides.
const ALLOWED_EMAILS = ["khadri1982@gmail.com", "gestionmaarif1@gmail.com"];

export function useRosterAllowed(): boolean {
  const { user, isAdmin } = useAuth();
  const email = (user?.email ?? "").toLowerCase();
  return isAdmin || ALLOWED_EMAILS.includes(email);
}

export function useOperators(): string[] {
  return useRosterAllowed() ? OPERATORS : [];
}

export function useManagers(): string[] {
  return useRosterAllowed() ? MANAGERS : [];
}
