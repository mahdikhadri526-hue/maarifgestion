import { expect, it } from "vitest";
import { canHandlePepRepair, canHandleTechIssue, visibleInPdvTech } from "@/lib/techHandling";
import { awaitingManager, canCloseIssue, requiresManagerVerification } from "@/lib/techData";

it("l’Agenda PEP réserve la prise en charge et la validation au manager avec accès PEP", () => {
  expect(canHandlePepRepair("manager", "manager@example.com", true)).toBe(true);
  expect(canHandlePepRepair("manager", "manager@example.com", false)).toBe(false);
  expect(canHandlePepRepair("operator", "operator@example.com", true)).toBe(false);
  expect(canHandlePepRepair("admin", "admin@example.com", true)).toBe(false);
});

it("le responsable technique ne peut pas prendre en charge ou valider dans l’Agenda PEP même avec le rôle manager", () => {
  expect(canHandlePepRepair("manager", "gestion-technique@oliveri.com", true)).toBe(false);
  expect(canHandlePepRepair("manager", "GESTION-TECHNIQUE@OLIVERI.COM", true)).toBe(false);
});

it("les dossiers manager clôturés réapparaissent dans le Suivi Technique du PDV (dossiers clôturés)", () => {
  expect(visibleInPdvTech({ processing_mode: "manager", status: "cloture" })).toBe(true);
  expect(visibleInPdvTech({ processing_mode: "manager", status: "a_traiter" })).toBe(false);
  expect(visibleInPdvTech({ processing_mode: "manager", status: "repare" })).toBe(false);
  expect(visibleInPdvTech({ processing_mode: "technique", status: "a_traiter" })).toBe(true);
});

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

it("mode manager : pas d'étape de vérification du matériel, la réparation validée clôture le dossier", () => {
  expect(requiresManagerVerification({ processing_mode: "manager" })).toBe(false);
  expect(requiresManagerVerification({ processing_mode: "technique" })).toBe(true);
  // Clôture possible dès la validation de la réparation, sans validation manager.
  expect(canCloseIssue({ processing_mode: "manager", tech_validated_at: "2026-10-21T10:00:00Z", manager_validated_at: null })).toBe(true);
  // Mode technique : la vérification du manager reste obligatoire.
  expect(canCloseIssue({ processing_mode: "technique", tech_validated_at: "2026-10-21T10:00:00Z", manager_validated_at: null })).toBe(false);
  expect(canCloseIssue({ processing_mode: "technique", tech_validated_at: "2026-10-21T10:00:00Z", manager_validated_at: "2026-10-21T12:00:00Z" })).toBe(true);
  // Un dossier manager réparé n'apparaît jamais « en attente de vérification ».
  expect(awaitingManager({ processing_mode: "manager", status: "repare", tech_validated_at: "2026-10-21T10:00:00Z", manager_validated_at: null } as any)).toBe(false);
});
