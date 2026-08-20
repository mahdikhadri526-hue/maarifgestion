import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/db";
import { setProductCatalog, type Category, type ProductCatalogRow } from "@/lib/stockData";

export type { ProductCatalogRow };

export async function fetchProductCatalog(): Promise<ProductCatalogRow[]> {
  const { data, error } = await supabase
    .from("product_catalog" as any)
    .select("id, product_id, category, name, conditionnement, hidden, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id as string,
    productId: r.product_id as string,
    category: r.category as Category,
    name: r.name as string,
    conditionnement: r.conditionnement ?? "",
    hidden: r.hidden === true,
    sortOrder: r.sort_order ?? 0,
  }));
}

/** Charge le catalogue (overrides + produits ajoutés) dans le cache synchrone. */
export async function loadProductCatalog(): Promise<ProductCatalogRow[]> {
  try {
    const rows = await fetchProductCatalog();
    setProductCatalog(rows);
    return rows;
  } catch {
    return [];
  }
}

export function newCustomProductId(category: Category): string {
  const prefix = category === "alimentaire" ? "cali" : "cemb";
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function useProductCatalog() {
  const [rows, setRows] = useState<ProductCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await loadProductCatalog();
    setRows(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, loading, reload };
}
