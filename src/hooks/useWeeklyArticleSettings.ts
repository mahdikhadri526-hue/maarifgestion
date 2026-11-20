import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type WeeklyArticleSetting, type WeeklyCategory } from "@/lib/weeklyArticleSettings";

export const weeklyArticleQueryKey = (pdvId: string | null) => ["weekly-article-settings", pdvId];

export function useWeeklyArticleSettings(pdvId: string | null) {
  return useQuery({
    queryKey: weeklyArticleQueryKey(pdvId),
    enabled: !!pdvId,
    queryFn: async (): Promise<WeeklyArticleSetting[]> => {
      if (!pdvId) return [];
      const { data, error } = await supabase.from("weekly_article_settings").select("pdv_id,category,article,active").eq("pdv_id", pdvId).order("created_at");
      if (error) throw error;
      return (data ?? []).map(row => ({ ...row, category: row.category as WeeklyCategory }));
    },
    refetchOnWindowFocus: "always",
  });
}