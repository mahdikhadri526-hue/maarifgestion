// Feature flags pour activer/désactiver des fonctionnalités sans toucher au reste du code.
// Pour activer une fonctionnalité, passer la valeur à `true` puis publier.

/**
 * Active les boutons "Transfert" et "Direction" dans le formulaire de nouveau mouvement,
 * les filtres correspondants dans l'historique, ainsi que le bouton de réintégration (↩️).
 *
 * Tant que ce flag est `false` :
 *   - L'application se comporte comme avant ces ajouts (uniquement Entrée / Sortie)
 *   - Les anciens mouvements de type Transfert / Direction déjà présents en base
 *     restent affichés normalement, mais aucune nouvelle action ne peut être effectuée.
 */
export const ENABLE_TRANSFERTS = true;

/**
 * Affiche un badge "Réquisition" sous le label "Sortie" dans l'historique des
 * mouvements pour les sorties générées automatiquement par une réquisition.
 * Tant que ce flag est `false`, l'historique se comporte comme avant.
 */
export const ENABLE_REQUISITION_BADGE = true;

/**
 * Affiche l'heure et les minutes de création sous la date dans l'historique
 * des mouvements. Tant que ce flag est `false`, seule la date s'affiche.
 */
export const ENABLE_MOVEMENT_TIME = true;

/**
 * Affiche le tableau "Qté à commander" (variant order) sur le tableau de bord,
 * incluant les filtres par période. Tant que ce flag est `false`, le bloc
 * complet est masqué sur le dashboard.
 */
export const ENABLE_DASHBOARD_ORDER_TABLE = true;

/**
 * Affiche les colonnes supplémentaires "Stock actuel" et "Qté à commander"
 * dans le tableau (variant order). Tant que ce flag est `false`, ces colonnes
 * sont masquées et seules les colonnes d'origine restent visibles.
 */
export const ENABLE_ORDER_COLUMNS = true;

/**
 * Affiche les indicateurs FIFO ("Première sortie", "Deuxième sortie", ...)
 * au-dessus des numéros de lot dans la gestion des lots. Tant que ce flag
 * est `false`, seule la liste des lots reste visible sans annotation FIFO.
 */
export const ENABLE_FIFO_INDICATOR = true;

/**
 * Active l'architecture MULTI-PDV côté interface : écran de sélection du point
 * de vente au démarrage, changement de PDV depuis le menu utilisateur, gestion
 * des PDV / codes d'accès / permissions par PDV dans l'écran admin.
 *
 * Tant que ce flag est `false`, l'application se comporte exactement comme
 * avant : aucun écran de sélection, tout le monde travaille automatiquement
 * sur le PDV principal (`DEFAULT_PDV_ID`). Les données et la structure
 * multi-PDV restent intactes en base.
 */
export const ENABLE_MULTI_PDV = false;

/**
 * Quand `true`, le multi-PDV (écran de sélection, code d'accès, gestion des PDV)
 * est actif UNIQUEMENT pour le compte administrateur. Les autres comptes
 * continuent de travailler automatiquement sur le PDV principal.
 */
export const MULTI_PDV_ADMIN_ONLY = true;

/** PDV utilisé automatiquement quand ENABLE_MULTI_PDV est `false`. */
export const DEFAULT_PDV_ID = "00000000-0000-0000-0000-000000000001";
