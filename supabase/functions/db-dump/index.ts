import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-dump-token",
};

const TABLES = [
  "pdvs", "profiles", "user_roles", "user_pdvs", "user_permissions", "pdv_permissions",
  "roster_names", "product_catalog", "finished_products", "recipes", "recipe_ingredients",
  "stock_ref_conversions", "glace_grammage", "glace_storage_capacity",
  "initial_stocks", "stock_movements", "requisitions", "lot_entries", "production_entries",
  "saved_orders", "order_placed_products", "mise_en_place_stocks",
  "weekly_tracking", "weekly_transfers", "autocontrols", "claims_returns",
  "cleaning_logs", "fridge_equipments", "fridge_temperatures", "glace_stuff_controls",
  "inventory_sessions", "inventory_counts", "inventory_lines", "inventory_resolutions",
  "ecart_entries", "ecart_lines",
  "pep_tasks", "pep_holidays", "pep_occurrences", "pep_postponements",
  "tech_issues", "tech_issue_events",
  "attendance_agents", "attendance_punches",
];

function lit(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return "'" + s.replace(/'/g, "''") + "'";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const token = req.headers.get("x-dump-token");
  if (token !== Deno.env.get("DB_DUMP_KEY")) {
    return new Response("forbidden", { status: 403, headers: corsHeaders });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const w = (s: string) => controller.enqueue(enc.encode(s));
      w("-- Données de l'application (généré automatiquement)\nSET session_replication_role = replica;\n\n");
      for (const table of TABLES) {
        let from = 0;
        const size = 1000;
        let wrote = false;
        for (;;) {
          const { data, error } = await supabase.from(table).select("*").range(from, from + size - 1);
          if (error) { w(`-- ${table}: ${error.message}\n`); break; }
          if (!data || data.length === 0) break;
          if (!wrote) { w(`\n-- ${table}\n`); wrote = true; }
          const cols = Object.keys(data[0]);
          for (const row of data) {
            w(
              `INSERT INTO public.${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (` +
                cols.map((c) => lit((row as Record<string, unknown>)[c])).join(", ") +
                ") ON CONFLICT DO NOTHING;\n",
            );
          }
          if (data.length < size) break;
          from += size;
        }
      }
      const { data: authSql } = await supabase.rpc("export_auth_sql");
      if (authSql) w("\n-- comptes utilisateurs\n" + authSql + "\n");
      w("\nSET session_replication_role = DEFAULT;\n");
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
});
