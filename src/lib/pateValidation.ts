import type { ConformityStatus, IngredientLine } from "@/lib/autocontrolData";
export const PATE_MANAGER_CONTROLS = [
  { key: "etiquettes", label: "Étiquette" },
  { key: "aspectOdeur", label: "Aspect / odeur" },
  { key: "conservation", label: "Conservation" },
] as const;
export function validatePateIngredients(ingredients: IngredientLine[]): string[] {
  return ingredients.flatMap((i) => {
    const errors: string[] = [];
    if (!(Number(i.quantity) > 0)) errors.push(`${i.name} : quantité (g) obligatoire`);
    if (i.name !== "Œuf" && !i.lot.trim()) errors.push(`${i.name} : N° de lot obligatoire`);
    return errors;
  });
}
export function validatePateManager(visa: string, controls: Record<string, ConformityStatus | boolean | undefined>): string[] {
  if (!visa.trim()) return [];
  return PATE_MANAGER_CONTROLS.filter((c) => !controls[c.key]).map((c) => `${c.label} : cocher C ou NC`);
}
