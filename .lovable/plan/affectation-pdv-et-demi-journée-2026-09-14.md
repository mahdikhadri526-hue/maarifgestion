# Affectation PDV et demi-journée

## Résultat attendu
- Pour les managers, caissiers, agents de ménage et agents de sécurité, chaque journée de travail permet de choisir une affectation unique parmi tous les PDV.
- L’affectation s’affiche sous la forme « Nom du PDV — Matin » ou « Nom du PDV — Après-midi ».
- Un collaborateur ne peut avoir qu’un seul choix par jour.
- Les jours Repos, Congé et Récupération n’affichent pas d’affectation.

## Accès
- La RH renseigne les affectations des managers et caissiers depuis la table RH.
- Le responsable technique renseigne les affectations Ménage et Sécurité depuis la table Technique.
- La table Planning conserve ces catégories en lecture seule et chaque PDV ne voit que celles affectées chez lui.

## Technique
- Ajouter la demi-journée à chaque ligne de planning existante, sans modifier le calcul des présences, congés ou récupérations.
- Utiliser le PDV de la ligne de planning comme lieu de travail choisi.
- Adapter la grille pour proposer tous les PDV et les deux périodes uniquement aux quatre catégories concernées.
- Mettre à jour le filtrage hebdomadaire par PDV et vérifier les types, sans publier.
