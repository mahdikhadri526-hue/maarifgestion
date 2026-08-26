// ============================================================================
// Catalogue PEP standard (tableau des matériels & fréquences fourni par le PDV).
// Sert uniquement à pré-remplir les tâches PEP d'un PDV : aucune donnée existante
// n'est modifiée, l'import ignore les tâches déjà présentes (même intitulé).
// ============================================================================
import type { PepFrequency } from "@/lib/pepData";

export interface PepCatalogItem {
  name: string;
  frequency: PepFrequency;
}

const D = (name: string): PepCatalogItem => ({ name, frequency: "daily" });

export const PEP_CATALOG: PepCatalogItem[] = [
  // ------------------------------ TOUS LES JOURS ----------------------------
  D("Squeezes bottes : Nettoyage et aseptisation."),
  D("Pinces à glaces et Palettes : Nettoyage et aseptisation (tremper dans l'eau à la fin de service)."),
  D("Machine à café : Nettoyage et aseptisation des têtes de service et les portes filtre."),
  D("Moulin à café : Nettoyage et aseptisation."),
  D("Shaker électrique : Nettoyage et aseptisation de l'agitateur sphérique et le bol acier inox."),
  D("Machine à Nespresso : Nettoyage et aseptisation du bac d'égouttage, réservoir à capsule et renouveler l'eau."),
  D("Machine à vaisselle : Nettoyage en lançant deux fois un programme à vide et nettoyage du filtre."),
  D("Gaufrier électrique : Nettoyage à l'aide d'une brosse à poils souples (Milave N)."),
  D("Congélateur/réfrigérateur : Nettoyage, aseptisation et vérification des températures."),
  D("Machine à cornets : Nettoyage à l'aide d'une brosse métallique."),
  D("Hottes : Nettoyage des filtres."),
  D("Presse agrumes électrique : Nettoyage et aseptisation."),
  D("Micro onde : Nettoyage et aseptisation."),
  D("Chambre froide : Nettoyage des portes et vérification des températures (DISQUE ENREGISTREUR)."),
  D("Kit protoxyde : Contrôle visuel de l'installation."),
  D("Batteur électrique : Nettoyage et aseptisation après chaque utilisation."),
  D("Les extincteurs : Vérification de l'état et du système de sécurité."),
  D("Pyromètre : Calibrage à l'aide de l'eau glacée."),
  D("Siphon à crème chantilly : Démontage, nettoyage et aseptisation."),

  // --------------------------- DEUX FOIS PAR SEMAINE ------------------------
  { name: "Pinces à glaces et Palettes : vérification de l'état et le bon fonctionnement.", frequency: "twice_week" },
  { name: "Moulin à café : Vérification et contrôle de la qualité du café moulu.", frequency: "twice_week" },
  { name: "Les extincteurs : Vérification de la position de l'aiguille indicatrice de la pression (Zone verte).", frequency: "twice_week" },
  { name: "Squeezes bottes : Rupture de la chaîne bactérienne.", frequency: "twice_week" },
  { name: "Imprimantes ticket caisse : Nettoyage de l'intérieur.", frequency: "twice_week" },

  // ----------------------------- TOUTES LES SEMAINES ------------------------
  { name: "Moulin à café : Nettoyage du bac à grains.", frequency: "weekly" },
  { name: "Machine à vaisselle : Nettoyage de l'arrière de la machine.", frequency: "weekly" },
  { name: "Congélateur/réfrigérateur : Grand nettoyage.", frequency: "weekly" },
  { name: "Micro onde : Nettoyage de l'arrière de la machine.", frequency: "weekly" },
  { name: "Chambre froide : Nettoyage des grilles des évaporateurs.", frequency: "weekly" },
  { name: "Kit protoxyde : Nettoyage du détendeur et de l'installation.", frequency: "weekly" },
  { name: "Poubelles : Vérification du bon fonctionnement des pédales.", frequency: "weekly" },
  { name: "Onduleur : Dépoussiérage complet.", frequency: "weekly" },

  // ------------------------------ TOUS LES 15 JOURS -------------------------
  { name: "Machine à café : Vérification de la température du produit fini (82 degrés).", frequency: "biweekly" },
  { name: "Shaker électrique : Démontage et nettoyage de l'agitateur sphérique.", frequency: "biweekly" },
  { name: "Congélateur/réfrigérateur : Nettoyage des condenseurs.", frequency: "biweekly" },
  { name: "Machine à Nespresso : Vérification de la température du produit fini (82 degrés).", frequency: "biweekly" },

  // -------------------------------- TOUS LES MOIS ---------------------------
  { name: "Squeezes bottes : Vérification de l'état et le bon fonctionnement.", frequency: "monthly" },
  { name: "Machine à café : Nettoyage de l'intérieur.", frequency: "monthly" },
  { name: "Machine à Nespresso : Vérification du volume du produit fini.", frequency: "monthly" },
  { name: "Toutes les machines : Nettoyage des câbles d'alimentation.", frequency: "monthly" },
  { name: "Spatules et Petits matériels (Matériels surplace inclus) : Vérification de l'état et le bon fonctionnement.", frequency: "monthly" },
  { name: "Prises d'alimentation électrique : Vérification de la fixation.", frequency: "monthly" },
  { name: "Tue mouches électrique : Changement des plaques de glue.", frequency: "monthly" },

  // -------------------------------- EXCEPTIONNEL ----------------------------
  { name: "Siphon à crème chantilly : Changement des joints et vérification du piston.", frequency: "bimonthly" },
  { name: "Machine à café : Détartrage et changement des joints.", frequency: "quarterly" },
  { name: "Machine à Nespresso : Détartrage.", frequency: "quarterly" },
  { name: "Machine à vaisselle : Détartrage.", frequency: "quarterly" },
  { name: "Tables / Chaises : Vérification de la stabilité.", frequency: "quarterly" },
  { name: "Système audio : Nettoyage de l'arrière et des câbles.", frequency: "quarterly" },
  { name: "Carrelage et infrastructure : Vérification de l'état.", frequency: "quarterly" },
  { name: "Moulin à café : Contrôle général et vérification des lames.", frequency: "biannual" },
  { name: "Shaker électrique : Changement de l'agitateur sphérique.", frequency: "biannual" },
  { name: "Store banne électrique : Vérification du bon fonctionnement des moteurs et des fixations.", frequency: "biannual" },
  { name: "Machine à cornets : Contrôle de la température.", frequency: "biannual" },
  { name: "Hottes : Nettoyage et dégraissage.", frequency: "biannual" },
  { name: "Les extincteurs : Contrôle par une société agréée.", frequency: "annual" },
  { name: "Chambre froide : Changement de pile du disque enregistreur.", frequency: "annual" },
  { name: "Pyromètre / Instruments de mesure de température : Étalonnage et certification des appareils et sondes.", frequency: "annual" },
  { name: "Détecteur de protoxyde : Certification par une société agréée (Maghreb oxygène).", frequency: "annual" },
  { name: "Système audiovisuel : Certification par une société agréée.", frequency: "annual" },
  { name: "TGBT : Contrôle et certification par une société agréée.", frequency: "annual" },
  { name: "Climatisation : Vérification générale du système (avant le début de la période estivale).", frequency: "annual" },
  { name: "Onduleur APC : Remplacement de la batterie.", frequency: "five_years" },
];

/** Matériel = partie avant le « : » de l'intitulé. */
export function catalogEquipment(name: string) {
  const i = name.indexOf(" : ");
  return i > 0 ? name.slice(0, i) : null;
}
