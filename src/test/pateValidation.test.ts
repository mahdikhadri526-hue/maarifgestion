import { expect, test } from "vitest";
import { validatePateIngredients, validatePateManager } from "@/lib/pateValidation";
test("œuf sans lot", () => {
  expect(validatePateIngredients([{ name: "Œuf", quantity: "100", lot: "" }])).toEqual([]);
});
test("autres ingrédients avec lot", () => {
  expect(validatePateIngredients([{ name: "Lait", quantity: "100", lot: "" }])).toEqual(["Lait : N° de lot obligatoire"]);
});
test("enregistrer sans manager", () => {
  expect(validatePateManager("", {})).toEqual([]);
});
test("visa exige trois contrôles", () => {
  expect(validatePateManager("Manager", {})).toHaveLength(3);
  expect(validatePateManager("Manager", { etiquettes: "conforme", aspectOdeur: "non_conforme", conservation: "conforme" })).toEqual([]);
});
