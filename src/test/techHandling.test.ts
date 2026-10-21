import { expect, it } from "vitest";
import { canHandleTechIssue } from "@/lib/techHandling";
import { awaitingManager, canCloseIssue, requiresManagerVerification } from "@/lib/techData";

it("le responsable technique (manage_tech) suit tous les dossiers", () => {
  expect(canHandleTechIssue({ processing_mode: "technique" }, true, false)).toBe(true);
  expect(canHandleTechIssue({ processing_mode: "manager" }, true, false)).toBe(true);
});

it("un manager du PDV suit uniquement les dossiers dont le traitement lui est confié", () => {
  expect(canHandleTechIssue({ processing_mode: "manager" }, false, true)).toBe(true);
  expect(canHandleTechIssue({ processing_mode: "technique" }, false, true)).toBe(false);
});

it("sans accès au Suivi Technique ni manage_tech, personne ne peut suivre un dossier", () => {
  expect(canHandleTechIssue({ processing_mode: "manager" }, false, false)).toBe(false);
  expect(canHandleTechIssue({ processing_mode: "technique" }, false, false)).toBe(false);
});

it("les dossiers existants sans mode restent traités par le responsable technique", () => {
  expect(canHandleTechIssue({ processing_mode: null }, false, true)).toBe(false);
  expect(canHandleTechIssue({}, false, true)).toBe(false);
});
