import { supabase } from "@/integrations/supabase/client";

export type FicheType =
  | "Oranges/Bigarreaux confits"
  | "Décoration"
  | "Panaché"
  | "Cornet/Tulipe/Gaufrette"
  | "Autre";

export const FICHE_TYPES: FicheType[] = [
  "Oranges/Bigarreaux confits",
  "Décoration",
  "Panaché",
  "Cornet/Tulipe/Gaufrette",
  "Autre",
];

export interface IngredientLine {
  name: string;
  lot: string;
  quantity: string;
}

export type ConformityStatus = "conforme" | "non_conforme" | null;

export interface PanacheMatiere {
  name: string;
  lot: string;
}

export interface CtgExtraData {
  ingredients?: IngredientLine[];
  matieresPremieres?: PanacheMatiere[];
  cleaning?: {
    lavageMachine: ConformityStatus | boolean;
    lavageTorchons: ConformityStatus | boolean;
    desinfection: ConformityStatus | boolean;
    rangementUstensiles: ConformityStatus | boolean;
    notes?: string;
  };
  managerControl?: {
    etiquettes?: ConformityStatus | boolean;
    cuisson?: ConformityStatus | boolean;
    forme?: ConformityStatus | boolean;
    nettoyage?: ConformityStatus | boolean;
    etiquettesInterneExterne?: ConformityStatus;
    conformiteDecoration?: ConformityStatus;
    etatEmballage?: ConformityStatus;
    poids?: ConformityStatus;
    remplissage?: ConformityStatus;
    notes?: string;
  };
}

export interface AutocontrolEntry {
  id: string;
  ficheType: FicheType;
  controlDate: string;
  collaborateur: string;
  article: string;
  lotNumber: string | null;
  quantity: number | null;
  dlc: string | null;
  visaManager: string | null;
  notes: string | null;
  createdAt: string;
  extraData: CtgExtraData | null;
}

function mapRow(row: any): AutocontrolEntry {
  return {
    id: row.id,
    ficheType: row.fiche_type,
    controlDate: row.control_date,
    collaborateur: row.collaborateur,
    article: row.article,
    lotNumber: row.lot_number,
    quantity: row.quantity !== null ? Number(row.quantity) : null,
    dlc: row.dlc,
    visaManager: row.visa_manager,
    notes: row.notes,
    createdAt: row.created_at,
    extraData: (row.extra_data as CtgExtraData) ?? null,
  };
}

export async function getAutocontrols(): Promise<AutocontrolEntry[]> {
  const { data, error } = await supabase
    .from("autocontrols")
    .select("*")
    .order("control_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function addAutocontrol(entry: Omit<AutocontrolEntry, "id" | "createdAt">) {
  const { error } = await supabase.from("autocontrols").insert({
    fiche_type: entry.ficheType,
    control_date: entry.controlDate,
    collaborateur: entry.collaborateur,
    article: entry.article,
    lot_number: entry.lotNumber,
    quantity: entry.quantity,
    dlc: entry.dlc,
    visa_manager: entry.visaManager,
    notes: entry.notes,
    extra_data: entry.extraData as any,
  });
  if (error) throw error;
}

export async function deleteAutocontrol(id: string) {
  const { error } = await supabase.from("autocontrols").delete().eq("id", id);
  if (error) throw error;
}

export async function updateAutocontrol(
  id: string,
  patch: Partial<Pick<AutocontrolEntry, "visaManager" | "extraData" | "notes">>,
) {
  const payload: Record<string, unknown> = {};
  if (patch.visaManager !== undefined) payload.visa_manager = patch.visaManager;
  if (patch.extraData !== undefined) payload.extra_data = patch.extraData as any;
  if (patch.notes !== undefined) payload.notes = patch.notes;
  const { error } = await supabase.from("autocontrols").update(payload).eq("id", id);
  if (error) throw error;
}
