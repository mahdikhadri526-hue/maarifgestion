import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { mergeStockCategories, productCategoryKey, matchesStockCategory } from "@/lib/stockCategories";
import { useSharedCatalogRevision } from "@/hooks/useSharedCatalogRevision";
import { useEffect, useMemo } from "react";

export function useStockCategories() {
  const { pdvId } = useAuth();
  const queryClient = useQueryClient();
  const revision = useSharedCatalogRevision(["stock_categories", "product_catalog"], pdvId);
  const queryKey = ["stock-categories", pdvId];
  useEffect(() => { void queryClient.invalidateQueries({ queryKey: ["stock-categories", pdvId] }); }, [revision, pdvId, queryClient]);
  const query = useQuery({
    queryKey, enabled: !!pdvId, refetchOnWindowFocus: "always",
    queryFn: async () => {
      if (!pdvId) return { rows: [], assignments: {} };
      const [categories, products] = await Promise.all([
        supabase.from("stock_categories").select("category_key,name,base_category,active").eq("pdv_id", pdvId).order("created_at"),
        supabase.from("product_catalog").select("product_id,stock_category_key").eq("pdv_id", pdvId),
      ]);
      if (categories.error) throw categories.error;
      if (products.error) throw products.error;
      return { rows: categories.data, assignments: Object.fromEntries(products.data.filter(row => row.stock_category_key).map(row => [row.product_id, row.stock_category_key as string])) };
    },
  });
  const categories = useMemo(() => mergeStockCategories((query.data?.rows ?? []) as import("@/lib/stockCategories").StockCategory[]), [query.data?.rows]);
  const assignments = useMemo(() => query.data?.assignments ?? {}, [query.data?.assignments]);
  return {
    categories, activeCategories: categories.filter(row => row.active), assignments, pdvId,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
    keyFor: (id: string, base: string) => productCategoryKey(id, base, assignments),
    labelFor: (id: string, base: string) => categories.find(row => row.category_key === productCategoryKey(id, base, assignments))?.name ?? base,
    matches: (id: string, base: string, selected = "all") => matchesStockCategory(id, base, selected, categories, assignments),
  };
}