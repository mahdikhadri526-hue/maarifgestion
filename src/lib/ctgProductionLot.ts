import { formatDateFR } from "@/lib/utils";

// Use the same automatic production lot for the fiche and both weekly entries.
export function getCtgProductionLot(controlDate: string): string {
  return formatDateFR(controlDate.slice(0, 10));
}