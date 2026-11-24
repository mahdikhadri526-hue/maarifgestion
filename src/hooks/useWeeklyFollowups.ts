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