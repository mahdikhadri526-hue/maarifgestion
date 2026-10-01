# Aide vocale enregistrée pour chaque rubrique

## Objectif
Ajouter un bouton audio discret à chaque rubrique visible de l’application. Les explications seront de courts enregistrements réalisés directement dans l’application avec la voix de l’administrateur principal.

## Expérience utilisateur
- Afficher une icône haut-parleur près de chaque titre de rubrique, sans modifier le fonctionnement des tables.
- Un clic lance l’explication; le même bouton permet de mettre en pause ou reprendre.
- Lorsqu’aucun audio n’existe, le bouton reste visible uniquement pour l’administrateur principal afin qu’il puisse créer l’explication.
- Tous les utilisateurs autorisés à voir une rubrique peuvent écouter son audio.

## Gestion réservée à l’administrateur principal
- Ouvrir une petite fenêtre depuis l’icône de la rubrique.
- Enregistrer au microphone, arrêter, réécouter, recommencer puis sauvegarder.
- Remplacer ou supprimer un enregistrement existant.
- Afficher clairement les états : autorisation microphone, enregistrement, sauvegarde et erreur.

## Couverture des rubriques
- Couvrir automatiquement les rubriques identifiées par leurs titres dans toutes les tables actuelles, y compris les sous-rubriques chargées après navigation.
- Utiliser une identité stable par table et par rubrique afin que chaque audio reste associé au bon emplacement.
- Ne pas ajouter ni réintroduire la page « Inventaire hebdomadaire » supprimée.

## Données et sécurité
- Conserver les fichiers audio dans l’espace de stockage privé de l’application.
- Conserver l’association table/rubrique/audio dans une table dédiée.
- Autoriser l’écoute aux utilisateurs connectés et réserver création, remplacement et suppression à l’administrateur principal par les règles de sécurité de la base.

## Vérification
- Tester l’enregistrement, la réécoute, la sauvegarde, le remplacement et la suppression avec le compte administrateur principal.
- Tester l’écoute avec un utilisateur non administrateur et confirmer qu’il ne voit aucun contrôle de modification.
- Vérifier plusieurs tables, les rubriques chargées dynamiquement et l’affichage sur petit écran.
- Ne rien publier sans votre signal explicite « go ».

## Détails techniques
- Créer un composant transversal d’aide vocale et un registre stable des rubriques.
- Utiliser l’enregistrement audio natif du navigateur et le stockage privé existant.
- Ajouter une table de métadonnées avec accès en lecture authentifiée et écriture limitée au rôle administrateur principal.
