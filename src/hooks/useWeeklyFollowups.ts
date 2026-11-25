import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseFollowupArticles, type WeeklyFollowup } from "@/lib/weeklyFollowups";

export const weeklyFollowupsQueryKey = (pdvId: string | null) => ["weekly-followups", pdvId];

export function useWeeklyFollowups(pdvId: string | null) {
  return useQuery({
    queryKey: weeklyFollowupsQueryKey(pdvId),
    enabled: !!pdvId,
    refetchOnWindowFocus: "always",
    queryFn: async (): Promise<WeeklyFollowup[]> => {
      if (!pdvId) return [];
      const { data, error } = await supabase.from("weekly_followups").select("id,pdv_id,name,active,articles").eq("pdv_id", pdvId).order("created_at");
      if (error) throw error;
      return (data ?? []).map(row => ({ ...row, articles: parseFollowupArticles(row.articles) }));
    },
  });
}
export const BUILTIN_FOLLOWUP_OFF_PREFIX = "weekly_followup_off:";
export const BUILTIN_FOLLOWUPS = [
  { key: "creme", label: "Crème fraîche" },
  { key: "glace", label: "Mouvement glaces" },
  { key: "tarte", label: "Mouvement tartes" },
  { key: "fruits", label: "Fruits" },
  { key: "nettoyant", label: "Mouvement produits nettoyants" },
  { key: "materiel", label: "Suivi matériel" },
] as const;
export const builtinFollowupsOffQueryKey = (pdvId: string | null) => ["weekly-builtin-followups-off", pdvId];

/** Built-in weekly followups hidden for a PDV (flag in pdv_permissions; absence = shown). Data is kept. */
export function useBuiltinFollowupsOff(pdvId: string | null) {
  return useQuery({
    queryKey: builtinFollowupsOffQueryKey(pdvId),
    enabled: !!pdvId,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from("pdv_permissions" as any).select("permission_key, allowed")
        .eq("pdv_id", pdvId).like("permission_key", `${BUILTIN_FOLLOWUP_OFF_PREFIX}%`);
      if (error) throw error;
      return new Set(((data ?? []) as any[]).filter(r => r.allowed).map(r => String(r.permission_key).slice(BUILTIN_FOLLOWUP_OFF_PREFIX.length)));
    },
  });
}
