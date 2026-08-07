import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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

export type RosterKind = "operator" | "manager";

export interface RosterName {
  id: string;
  kind: RosterKind;
  name: string;
}

// Noms personnalisés du PDV courant (table roster_names), gérables avec la
// permission `manage_roster`.
export function usePdvRoster() {
  const { pdvId } = useAuth();
  const [rows, setRows] = useState<RosterName[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!pdvId) {
      setRows([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("roster_names" as any)
      .select("id, kind, name")
      .eq("pdv_id", pdvId)
      .order("name");
    setRows(((data ?? []) as any[]).map((r) => ({ id: r.id, kind: r.kind, name: r.name })));
    setLoading(false);
  }, [pdvId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (kind: RosterKind, name: string) => {
      const clean = name.trim();
      if (!pdvId || !clean) return false;
      const { error } = await supabase
        .from("roster_names" as any)
        .insert({ pdv_id: pdvId, kind, name: clean });
      if (error) return false;
      await load();
      return true;
    },
    [pdvId, load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("roster_names" as any).delete().eq("id", id);
      if (error) return false;
      await load();
      return true;
    },
    [load],
  );

  return { rows, loading, reload: load, add, remove };
}

function useRosterList(kind: RosterKind, base: string[]): string[] {
  const allowed = useRosterAllowed();
  const { rows } = usePdvRoster();
  const custom = rows.filter((r) => r.kind === kind).map((r) => r.name);
  const merged = allowed ? [...base, ...custom] : custom;
  return Array.from(new Set(merged));
}

export function useOperators(): string[] {
  return useRosterList("operator", OPERATORS);
}

export function useManagers(): string[] {
  return useRosterList("manager", MANAGERS);
}
