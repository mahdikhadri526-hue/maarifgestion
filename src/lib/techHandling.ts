// Suivi Technique — choix du traitement d'un signalement :
// « technique » = responsable technique (défaut, comportement historique) ;
// « manager » = le manager du PDV suit les mêmes étapes (désigner l'intervenant,
// fixer le délai, suivre la réparation, valider l'intervention) ; le manager
// confirme ensuite le bon fonctionnement. Le responsable technique conserve
// l'accès à tous les dossiers pour l'historique et le suivi.
import { TECH_ACCOUNT_EMAILS } from "@/lib/techFeature";

export type TechProcessingMode = "technique" | "manager";

/** Managers and administrators handle PEP repairs, never the technical account. */
export function canHandlePepRepair(
  role: string | null,
  email: string | null | undefined,
  hasPepAccess: boolean,
): boolean {
  return (role === "manager" || role === "admin") && hasPepAccess && !TECH_ACCOUNT_EMAILS.includes((email ?? "").toLowerCase());
}

export const TECH_PROCESSING_MODES: { key: TechProcessingMode; label: string }[] = [
  { key: "technique", label: "Responsable technique" },
  { key: "manager", label: "Manager du PDV" },
];

/** Handling follows the selected mode; central visibility does not grant actions. */
export function canHandleTechIssue(
  issue: { processing_mode?: string | null },
  canManage: boolean,
  canHandleAsManager: boolean,
): boolean {
  return issue.processing_mode === "manager" ? canHandleAsManager : canManage;
}

/** Visibilité dans le Suivi Technique du PDV : les dossiers confiés au manager
 *  se traitent dans l'Agenda PEP, mais une fois validés et clôturés ils
 *  réapparaissent ici dans « Dossiers clôturés » pour l'historique. */
export function visibleInPdvTech(issue: { processing_mode?: string | null; status: string }): boolean {
  return issue.processing_mode !== "manager" || issue.status === "cloture";
}
