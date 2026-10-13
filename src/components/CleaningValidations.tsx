import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CleaningLog } from "@/lib/cleaningData";

export type CleaningValidation = Pick<CleaningLog, "visaManager" | "qualityValidator" | "qualityConformity">;

export function CleaningValidations({ value, managerOptions, onChange }: {
  value: CleaningValidation;
  managerOptions: string[];
  onChange?: (value: CleaningValidation) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[580px] text-sm border-collapse">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="border p-2 text-left w-1/3">Validation manager</th>
            <th className="border p-2 text-left w-1/3">Validation service qualité</th>
            <th className="border p-2 text-left w-1/3">Conformité service qualité</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-2 align-top">
              {onChange ? (
                <Select value={value.visaManager || "__none__"} onValueChange={(v) => onChange({ ...value, visaManager: v === "__none__" ? null : v })}>
                  <SelectTrigger aria-label="Validation manager"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Aucun —</SelectItem>
                    {Array.from(new Set([...managerOptions, ...(value.visaManager ? [value.visaManager] : [])])).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : value.visaManager || "—"}
            </td>
            <td className="border p-2 align-top">
              {onChange ? <Input aria-label="Validation service qualité" placeholder="Nom du validateur" value={value.qualityValidator ?? ""} onChange={(e) => onChange({ ...value, qualityValidator: e.target.value || null })} /> : value.qualityValidator || "—"}
            </td>
            <td className="border p-2 align-top">
              {onChange ? (
                <Select value={value.qualityConformity || "__none__"} onValueChange={(v) => onChange({ ...value, qualityConformity: v === "C" || v === "NC" ? v : null })}>
                  <SelectTrigger aria-label="Conformité service qualité"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Non évaluée —</SelectItem>
                    <SelectItem value="C">Conforme</SelectItem>
                    <SelectItem value="NC">Non conforme</SelectItem>
                  </SelectContent>
                </Select>
              ) : <span className={value.qualityConformity === "NC" ? "text-destructive font-semibold" : "font-medium"}>{value.qualityConformity === "C" ? "Conforme" : value.qualityConformity === "NC" ? "Non conforme" : "—"}</span>}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}