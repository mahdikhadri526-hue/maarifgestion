// Suivi Technique — choix du traitement d'un signalement :
// « technique » = responsable technique (défaut, comportement historique) ;
// « manager » = le manager du PDV suit les mêmes étapes (désigner l'intervenant,
// fixer le délai, suivre la réparation, valider l'intervention) ; le manager
// confirme ensuite le bon fonctionnement. Le responsable technique conserve
// l'accès à tous les dossiers pour l'historique et le suivi.
export type TechProcessingMode = "technique" | "manager";

export const TECH_PROCESSING_MODES: { key: TechProcessingMode; label: string }[] = [
  { key: "technique", label: "Responsable technique" },
  { key: "manager", label: "Manager du PDV" },
];

/** Qui peut suivre le dossier : le responsable technique (manage_tech) toujours,
 *  ou un manager du PDV (view_pep/manage_pep) quand le traitement lui est confié. */
export function canHandleTechIssue(
  issue: { processing_mode?: string | null },
  canManage: boolean,
  canPep: boolean,
): boolean {
  return canManage || (issue.processing_mode === "manager" && canPep);
}
