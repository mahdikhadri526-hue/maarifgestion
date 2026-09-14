# Limiter les catégories partagées au PDV planifié

## Résultat attendu
- Dans la table **Planning**, chaque PDV voit uniquement les caissiers, agents de ménage et agents de sécurité ayant un planning enregistré dans ce PDV pour la semaine affichée.
- Les agents ordinaires du PDV restent visibles pour permettre au manager d’élaborer leur planning.
- Les caissiers, le ménage et la sécurité restent en lecture seule dans cette table.

## Mise en œuvre
- Transmettre le PDV consulté à la grille hebdomadaire.
- Charger les horaires de la semaine uniquement pour ce PDV, au lieu d’utiliser le PDV principal de chaque employé.
- Filtrer les trois catégories partagées selon la présence d’au moins une journée planifiée dans le PDV et la semaine affichés.
- Conserver la vue globale RH lorsque « Tous les PDV » est sélectionné.
- Vérifier le résultat et les types sans publier l’application.
