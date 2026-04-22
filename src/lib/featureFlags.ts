// Feature flags pour activer/désactiver des fonctionnalités sans toucher au reste du code.
// Pour activer une fonctionnalité, passer la valeur à `true` puis publier.

/**
 * Active les boutons "Transfert" et "Mr Hassan" dans le formulaire de nouveau mouvement,
 * les filtres correspondants dans l'historique, ainsi que le bouton de réintégration (↩️).
 *
 * Tant que ce flag est `false` :
 *   - L'application se comporte comme avant ces ajouts (uniquement Entrée / Sortie)
 *   - Les anciens mouvements de type Transfert / Mr Hassan déjà présents en base
 *     restent affichés normalement, mais aucune nouvelle action ne peut être effectuée.
 */
export const ENABLE_TRANSFERTS = false;

/**
 * Affiche un badge "Réquisition" sous le label "Sortie" dans l'historique des
 * mouvements pour les sorties générées automatiquement par une réquisition.
 * Tant que ce flag est `false`, l'historique se comporte comme avant.
 */
export const ENABLE_REQUISITION_BADGE = false;
