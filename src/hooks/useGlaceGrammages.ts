import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSharedCatalogRevision } from "@/hooks/useSharedCatalogRevision";

export const glaceGrammagesQueryKey = ["glace-grammages"];

/** Shared weights in grams; never scoped to a PDV. */
export function useGlaceGrammages() {
  const revision = useSharedCatalogRevision(["glace_grammage"]);
  const query = useQuery({
    queryKey: glaceGrammagesQueryKey,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("glace_grammage").select("article, grammage_grams");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map(row => [row.article, Number(row.grammage_grams) || 0]));
    },
    refetchOnWindowFocus: "always",
  });
  const { refetch } = query;
  useEffect(() => {
    if (revision > 0) void refetch();
  }, [revision, refetch]);
  return query;
}