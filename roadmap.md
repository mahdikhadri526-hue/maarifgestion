# Roadmap
- [ ] Masquer les produits inactifs de tous les tableaux par PDV, sans changer les données ni calculs ; tester masquage et réactivation.
- [x] Ajouter Actif/Inactif dans Stock Initial → Produits par PDV : désactivation, persistance et réactivation testées avec le compte admin ; stocks, lots, mouvements, réquisitions et autres PDV inchangés, 32 tests réussis ; sans publication ni fichier préparé.
- [x] Corriger les sorties de Stock restant issues du Suivi hebdo : contexte du lendemain conservé, lots cumulés et articles indépendants ; 27 tests réussis, cornets/fruits/glaces/crème et cumul mensuel vérifiés avec le compte admin du PDV principal ; aucune saisie modifiée ni publication.
- [x] Ajouter la suppression confirmée des conditionnements existants pour l’administrateur ; paquet/carton désactivés sans effacer les conversions, produits et historique conservés ; neuf tests réussis, sans publication.
- [x] Séparer Fruits de Tartes dans Stock restant et Calcul de la commande ; données et formules inchangées, trois tests réussis, sans publication.
- [ ] Vérifier Fruits dans les deux tableaux de l’aperçu connecté : session absente et renouvellement automatique indisponible ; attendre une reconnexion de l’utilisateur.
- [x] Ajouter la modification administrateur des formats existants (paquet/carton et formats ajoutés), conserver les identifiants et l’historique ; sept tests réussis, protections en base confirmées, sans publication.
- [ ] Vérifier l’enregistrement et la suppression des conditionnements dans l’aperçu : session expirée, renouvellement automatique indisponible ; attendre une reconnexion de l’utilisateur.
- [x] Séparer les six fruits du suivi Tartes dans un suivi Fruits ; données et sources de commande conservées, calculs testés et deux vues vérifiées sur grand écran et téléphone, sans publication.
- [x] Signalement matériel : choix du traitement (responsable technique ou manager du PDV) ; le responsable choisi suit les mêmes étapes (intervenant, délai, suivi, validation), le manager confirme la réparation, le responsable technique garde l'accès à tous les dossiers ; fonctionnement actuel préservé, tests et affichage vérifiés.
- [x] Ajouter et sécuriser la rectification des deadlines (avancer ou repousser la date) uniquement pour le responsable technique ; deux corrections vérifiées avec son compte et historique conservé, intervention temporaire supprimée.
- [x] Corriger le transfert des numéros de lot cornets/tulipes/gaufrettes vers le suivi hebdo Tartes ; 12 lots manquants rétablis, tests et affichage vérifiés, autres fonctions inchangées.
- [ ] Remplacer le pointage facial par empreinte sur la tablette Samsung Galaxy Tab A11+ : bloqué par l'absence de lecteur d'empreintes compatible identifié ; préserver le pointage existant en attendant.
- [x] Alléger les répétitions de la table RH, sans changer les données ni les calculs, et vérifier la lecture.
- [x] Compléter et vérifier la mise à jour serveur du 17/10 avec les vrais fichiers audio de bienvenue, sans toucher aux données, au scan ni aux guides vocaux.
- [x] Corriger les fiches pâte : DLC, œuf sans lot et validation manager différée avec alerte.
- [x] Reconnaître le format 2007cgng/26 uniquement pour le FIFO glace et vérifier les calculs.
- [x] Séparer les validations manager/qualité du nettoyage, ajouter et vérifier la conformité qualité à droite.
- [x] Créer une présentation PowerPoint française des seules rubriques publiées, avec objectifs, éléments et captures.
- [x] Créer et vérifier la version arabe de la même présentation.
- [x] Aligner les tableaux Café Dubois et Sidi Ali sur la structure de l’écart glace, sans changer les calculs existants.

- [x] Utiliser uniquement les cinq premières secondes de la musique fournie, une seule fois pendant l’introduction.

- [x] Afficher les photos de connexion en plein écran et remplacer la signature Oliveri par une voix masculine plus mûre.

- [x] Prolonger la dernière photo et le message de bienvenue ; jouer une introduction musicale douce pendant les photos, sans couvrir la voix off.

- [x] Permettre à l’admin principal d’ajouter, réordonner et retirer plusieurs photos affichées après le logo et le message de bienvenue, uniquement après connexion.
- [x] Afficher le logo Oliveri puis le message de bienvenue pendant environ 2 secondes après une connexion réussie, avant l'accès habituel.
- [x] Uniformiser le titre de chaque rubrique avec le logo Oliveri à gauche, sauf la caméra plein écran du pointage.
- [x] Afficher le logo sur les pages sans en-tête commun (mode kiosque, choix du PDV et page introuvable), sans perturber la caméra de pointage.
- [x] Planning managers : liste d'affectation avec 3 choix par PDV (Nom du PDV / Nom du PDV — Matin / Nom du PDV — Après-midi), pour tous les PDV.
- [x] Ajouter une aide vocale enregistrée par l’administrateur principal à chaque rubrique interne, écoutable par tous.
- [x] Ajouter les explications vocales aux cinq fiches du suivi hebdomadaire et aux transferts.
- [x] Appliquer les règles RH validées (fêtes, absences protégées, pointage corrigé tracé, congés, récupérations, compteur heures, récapitulatif mensuel).
- [x] Dépasser la question des dépassements managers dans le compteur : on garde le comportement actuel (non comptés).
- [x] Dépasser la question de l'indicateur 48 h/semaine : on ne l'affiche pas.
- [x] Retirer le bloc « Compteur d'heures supplémentaires » des rapports RH (la colonne H. sup. du tableau suffit) ; garder l'alerte plafond 80 h/an.
