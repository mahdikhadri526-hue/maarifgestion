// Données de référence pour le module HACCP - Prise de température des frigos

export type FridgeZone = "Salle" | "Emporter" | "Entre-sol" | "Passe";

export type FridgeSlot = "07h" | "16h" | "00h";
export const SLOTS: FridgeSlot[] = ["07h", "16h", "00h"];

export interface FridgeEquipment {
  code: string;
  name: string;
  type: string;
  zone: FridgeZone;
}

export const ZONES: FridgeZone[] = ["Salle", "Emporter", "Entre-sol", "Passe"];

export const EQUIPMENTS: FridgeEquipment[] = [
  { code: "SAL-N01", name: "Frigo négatif 1", type: "Frigo négatif", zone: "Salle" },
  { code: "SAL-N02", name: "Frigo négatif 2", type: "Frigo négatif", zone: "Salle" },
  { code: "SAL-P03", name: "Frigo négatif 3", type: "Frigo négatif", zone: "Salle" },
  { code: "SAL-P01", name: "Frigo positif 1", type: "Frigo positif", zone: "Salle" },
  { code: "SAL-P02", name: "Frigo positif 2", type: "Frigo positif", zone: "Salle" },

  { code: "EMP-N01", name: "Frigo négatif 1", type: "Frigo négatif", zone: "Emporter" },
  { code: "EMP-N02", name: "Frigo négatif 2", type: "Frigo négatif", zone: "Emporter" },
  { code: "EMP-N03", name: "Frigo négatif 3", type: "Frigo négatif", zone: "Emporter" },
  { code: "EMP-N04", name: "Frigo négatif 4", type: "Frigo négatif", zone: "Emporter" },
  { code: "EMP-N05", name: "Frigo négatif 5", type: "Frigo négatif", zone: "Emporter" },
  { code: "EMP-P01", name: "Frigo topping", type: "Frigo positif", zone: "Emporter" },
  { code: "EMP-C01", name: "Congélateur blanc", type: "Congélateur", zone: "Emporter" },
  { code: "ETS-C01", name: "Congélateur 1", type: "Congélateur", zone: "Entre-sol" },
  { code: "ETS-C02", name: "Congélateur 2", type: "Congélateur", zone: "Entre-sol" },
  { code: "ETS-C03", name: "Congélateur 3", type: "Congélateur", zone: "Entre-sol" },
  { code: "ETS-C04", name: "Congélateur 4", type: "Congélateur", zone: "Entre-sol" },
  { code: "ETS-C05", name: "Congélateur 5", type: "Congélateur", zone: "Entre-sol" },
  { code: "ETS-C06", name: "Congélateur 6", type: "Congélateur", zone: "Entre-sol" },
  { code: "ETS-C07", name: "Congélateur 7", type: "Congélateur", zone: "Entre-sol" },
  { code: "ETS-C08", name: "Congélateur 8", type: "Congélateur", zone: "Entre-sol" },
  { code: "ETS-I01", name: "Congélateur inox 1", type: "Congélateur inox", zone: "Entre-sol" },
  { code: "ETS-I02", name: "Congélateur inox 2", type: "Congélateur inox", zone: "Entre-sol" },
  { code: "PAS-CP01", name: "Chambre positive", type: "Chambre positive", zone: "Passe" },
  { code: "PAS-CN01", name: "Chambre négative", type: "Chambre négative", zone: "Passe" },
];

// Plages de température recommandées (HACCP)
export function getTargetRange(type: string): { min: number; max: number } | null {
  if (type.startsWith("Frigo positif") || type === "Chambre positive") return { min: 0, max: 4 };
  if (type.startsWith("Frigo négatif")) return { min: -22, max: -15 };
  if (type.startsWith("Congélateur") || type === "Chambre négative") return { min: -30, max: -18 };
  return null;
}

export function isTemperatureOk(type: string, temp: number | null | undefined): boolean | null {
  if (temp === null || temp === undefined || Number.isNaN(temp)) return null;
  const range = getTargetRange(type);
  if (!range) return null;
  return temp >= range.min && temp <= range.max;
}

export function formatDisplayTemp(value: number | string, type?: string): string {
  const num = typeof value === "string" ? Number(value.replace(/^\+/, "").replace(",", ".")) : value;
  if (Number.isNaN(num)) return String(value);
  if (type && (type.startsWith("Frigo positif") || type === "Chambre positive")) {
    return num >= 0 ? `+${num}` : `${num}`;
  }
  if (type && (type.startsWith("Frigo négatif") || type.startsWith("Congélateur") || type === "Chambre négative")) {
    const abs = Math.abs(num);
    return num === 0 ? `-0` : `-${abs}`;
  }
  return `${num}`;
}

export function parseDisplayTemp(value: string): number | null {
  const cleaned = value.trim().replace(",", ".");
  if (cleaned === "") return null;
  const num = Number(cleaned.replace(/^\+/, ""));
  if (Number.isNaN(num)) return null;
  return num;
}