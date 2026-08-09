import { supabase as rawSupabase } from "@/integrations/supabase/client";
import { requireCurrentPdvId } from "@/lib/pdvStore";

/**
 * Tables cloisonnées par point de vente (PDV).
 * Les tables de référence partagées (produits finis, recettes, grammages,
 * capacités, conversions, profils, rôles) ne sont volontairement PAS listées.
 */
const PDV_SCOPED_TABLES = new Set<string>([
  "autocontrols",
  "cleaning_logs",
  "fridge_temperatures",
  "glace_stuff_controls",
  "initial_stocks",
  "inventory_counts",
  "inventory_lines",
  "inventory_resolutions",
  "inventory_sessions",
  "lot_entries",
  "order_placed_products",
  "production_entries",
  "requisitions",
  "saved_orders",
  "stock_movements",
  "weekly_tracking",
]);

function attachPdv(values: any, pdvId: string) {
  if (Array.isArray(values)) return values.map((v) => ({ ...v, pdv_id: pdvId }));
  return { ...values, pdv_id: pdvId };
}

function scopeConflict(options: any) {
  if (!options?.onConflict) return options;
  const cols = String(options.onConflict)
    .split(",")
    .map((c) => c.trim());
  if (cols.includes("pdv_id")) return options;
  return { ...options, onConflict: ["pdv_id", ...cols].join(",") };
}

function wrapQueryBuilder(builder: any) {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (typeof original !== "function") return original;

      switch (prop) {
        case "select":
        case "update":
        case "delete":
          return (...args: any[]) => original.apply(target, args).eq("pdv_id", requireCurrentPdvId());
        case "insert":
          return (values: any, options?: any) =>
            original.call(target, attachPdv(values, requireCurrentPdvId()), options);
        case "upsert":
          return (values: any, options?: any) =>
            original.call(target, attachPdv(values, requireCurrentPdvId()), scopeConflict(options));
        default:
          return original.bind(target);
      }
    },
  });
}

/**
 * Client Supabase qui applique automatiquement le filtre du PDV courant
 * (lecture) et renseigne `pdv_id` (écriture) sur les tables cloisonnées.
 */
export const supabase: typeof rawSupabase = new Proxy(rawSupabase, {
  get(target, prop, receiver) {
    if (prop === "from") {
      return (table: string) => {
        const builder = (target as any).from(table);
        return PDV_SCOPED_TABLES.has(table) ? wrapQueryBuilder(builder) : builder;
      };
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as typeof rawSupabase;

export { PDV_SCOPED_TABLES };
