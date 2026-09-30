---
name: Mise en place hebdomadaire
description: Règles de saisie de la mise en place hebdomadaire (jour de saisie, tableau séparé du stock restant)
type: feature
---
La mise en place hebdomadaire se saisit dans la fenêtre dédiée (table `mise_en_place_weekly`), séparée du tableau « Stock restant » qui ne doit jamais être impacté.

Règle de saisie :
- La saisie du stock mise en place se fait chaque lundi de la semaine pour obtenir la quantité totale (Stock restant + Mise en place).
- Exception : pour la dernière semaine du mois, la saisie se fait le lendemain de la fin du mois.

Contraintes déjà établies :
- Une valeur par produit et par semaine ; si la semaine n'a pas de saisie, on reprend la dernière valeur antérieure (reprise).
- La colonne « Stock mise en place » est masquée dans le tableau Stock restant ; la saisie se fait uniquement dans la fenêtre hebdomadaire.
- Permission dédiée « Mise en place hebdomadaire » dans la liste des permissions.
