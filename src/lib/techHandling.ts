// Suivi Technique — choix du traitement d'un signalement :
// « technique » = responsable technique (défaut, comportement historique) ;
// « manager » = le manager du PDV suit les mêmes étapes (désigner l'intervenant,
// fixer le délai, suivre la réparation, valider l'intervention) ; le manager
// confirme ensuite le bon fonctionnement. Le responsable technique conserve
// l'accès à tous les dossiers pour l'historique et le suivi.
import { TECH_ACCOUNT_EMAILS } from "@/lib/techFeature";

export type TechProcessingMode = "technique" | "manager";

/** PEP repair actions belong to the manager, never the technical account. */
export function canHandlePepRepair(
  role: string | null,
  email: string | null | undefined,
  hasPepAccess: boolean,
): boolean {
  return role === "manager" && hasPepAccess && !TECH_ACCOUNT_EMAILS.includes((email ?? "").toLowerCase());
}

export const TECH_PROCESSING_MODES: { key: TechProcessingMode; label: string }[] = [
  { key: "technique", label: "Responsable technique" },
  { key: "manager", label: "Manager du PDV" },
];

/** Qui peut suivre le dossier : le responsable technique (manage_tech) toujours,
 *  ou un utilisateur du PDV ayant accès au Suivi Technique (view_tech) quand le
 *  traitement est confié au manager. */
export function canHandleTechIssue(
  issue: { processing_mode?: string | null },
  canManage: boolean,
  canViewTech: boolean,
): boolean {
  return canManage || (issue.processing_mode === "manager" && canViewTech);
}

/** Visibilité dans le Suivi Technique du PDV : les dossiers confiés au manager
 *  se traitent dans l'Agenda PEP, mais une fois validés et clôturés ils
 *  réapparaissent ici dans « Dossiers clôturés » pour l'historique. */
export function visibleInPdvTech(issue: { processing_mode?: string | null; status: string }): boolean {
  return issue.processing_mode !== "manager" || issue.status === "cloture";
}
