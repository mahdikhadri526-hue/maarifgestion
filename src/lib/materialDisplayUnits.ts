/** Display-only unit choices for the material variance table; never feeds calculations. */
const families: { base: string; aliases: string[]; units: { label: string; factor: number }[] }[] = [
  { base: "KG", aliases: ["KG", "KILO", "KILOGRAMME"], units: [{ label: "kg", factor: 1 }, { label: "g", factor: 1000 }] },
  { base: "G", aliases: ["G", "GR", "GRAMME", "GRAMMES"], units: [{ label: "g", factor: 1 }, { label: "kg", factor: 0.001 }] },
  { base: "L", aliases: ["L", "LITRE", "LITRES"], units: [{ label: "L", factor: 1 }, { label: "cl", factor: 100 }, { label: "ml", factor: 1000 }] },
  { base: "ML", aliases: ["ML"], units: [{ label: "ml", factor: 1 }, { label: "cl", factor: 0.1 }, { label: "L", factor: 0.001 }] },
];
const key = (unit: string) => unit.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

export function displayUnitOptions(unit: string): { label: string; factor: number }[] {
  const family = families.find(f => f.aliases.includes(key(unit)));
  return family ? family.units : [{ label: unit, factor: 1 }];
}

export function convertForDisplay(value: number | null, unit: string, chosen: string | undefined) {
  const options = displayUnitOptions(unit);
  const option = options.find(o => o.label === chosen) ?? options[0];
  return { value: value === null ? null : Math.round(value * option.factor * 10000) / 10000, label: option.label, options };
}

/** Actual usage already carries the Stock restant reference quantity and unit. */
export function materialUsageDisplay(kind: "actual" | "theo", value: number | null, unit: string, chosen?: string) {
  if (kind === "actual") return { value, label: unit, options: [{ label: unit, factor: 1 }] };
  return convertForDisplay(value, unit, chosen);
}
