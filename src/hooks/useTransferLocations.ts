import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mergeTransferLocations, validateTransferLocation } from "@/lib/transferLocations";

const queryKey = ["transfer-locations"];

export function useTransferLocations() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("transfer_locations").select("name").order("name");
      if (error) throw error;
      return data.map(row => row.name);
    },
    refetchOnWindowFocus: "always",
  });
  const locations = mergeTransferLocations(query.data ?? []);
  const add = useMutation({
    mutationFn: async (name: string) => {
      const clean = name.trim();
      const validation = validateTransferLocation(clean, locations);
      if (validation) throw new Error(validation);
      const { error } = await supabase.from("transfer_locations").insert({ name: clean });
      if (error) {
        if (error.code === "23505") throw new Error("Ce site existe déjà");
        throw new Error("Impossible d’ajouter ce site");
      }
      queryClient.setQueryData<string[]>(queryKey, previous => [...(previous ?? []), clean]);
      await queryClient.invalidateQueries({ queryKey });
      return clean;
    },
  });
  return { locations, add, isLoading: query.isLoading, error: query.error };
}