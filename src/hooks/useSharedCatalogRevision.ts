import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invalidateTables } from "@/lib/requestCache";

/** Re-fetch shared catalog data on authorized changes and when returning to the app. */
export function useSharedCatalogRevision(tables: string[], pdvId?: string | null) {
  const [revision, setRevision] = useState(0);
  const key = tables.join(",");
  useEffect(() => {
    const names = key.split(",").filter(Boolean);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        invalidateTables(names);
        setRevision(value => value + 1);
      }, 400);
    };
    const channel = supabase.channel(`shared-catalog-${crypto.randomUUID()}`);
    names.forEach(table => {
      channel.on("postgres_changes", {
        event: "*", schema: "public", table,
        ...(pdvId && table === "product_catalog" ? { filter: `pdv_id=eq.${pdvId}` } : {}),
      }, refresh);
    });
    channel.subscribe();
    window.addEventListener("focus", refresh);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      void supabase.removeChannel(channel);
    };
  }, [key, pdvId]);
  return revision;
}