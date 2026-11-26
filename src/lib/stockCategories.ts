import type { Category } from "@/lib/stockData";

export interface StockCategory {
  category_key: string;
  name: string;
  base_category: Category;
  active: boolean;
}
export const DEFAULT_STOCK_CATEGORIES: StockCategory[] = [
  { category_key: "alimentaire", name: "Alimentaire", base_category: "alimentaire", active: true },
  { category_key: "emballage", name: "Emballage", base_category: "emballage", active: true },
];
export function mergeStockCategories(rows: StockCategory[]): StockCategory[] {
  const merged = new Map(DEFAULT_STOCK_CATEGORIES.map(row => [row.category_key, row]));
  rows.forEach(row => merged.set(row.category_key, row));
  return [...merged.values()];
}
export function productCategoryKey(productId: string, base: string, assignments: Record<string, string>): string {
  return assignments[productId] || base;
}
export function matchesStockCategory(productId: string, base: string, selected: string, categories: StockCategory[], assignments: Record<string, string>): boolean {
  const key = productCategoryKey(productId, base, assignments);
  const category = categories.find(row => row.category_key === key);
  return category?.active !== false && (selected === "all" || key === selected);
}