import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CleaningLog } from "@/lib/cleaningData";

export type CleaningValidation = Pick<CleaningLog, "visaManager" | "qualityValidator" | "qualityConformity">;

/** Visa manager simple (le service qualité valide tâche par tâche dans la colonne de droite). */
export function CleaningValidations({ value, managerOptions, onChange }: {
  value: CleaningValidation;
  managerOptions: string[];
  onChange?: (value: CleaningValidation) => void;
}) {
  if (!onChange) {
    return value.visaManager ? (
      <div className="text-xs border-t pt-2"><span className="font-semibold">Visa manager :</span> {value.visaManager}</div>
    ) : null;
  }
  return (
    <div>
      <Label>Visa manager</Label>
      <Select value={value.visaManager || "__none__"} onValueChange={(v) => onChange({ ...value, visaManager: v === "__none__" ? null : v })}>
        <SelectTrigger aria-label="Visa manager"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Aucun —</SelectItem>
          {Array.from(new Set([...managerOptions, ...(value.visaManager ? [value.visaManager] : [])])).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
