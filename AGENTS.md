# AGENTS.md

- La mise en place hebdomadaire est une page dédiée (`WeeklyMiseEnPlacePage`, onglet « Mise en place hebdo », permission `view_mise_en_place`), jamais intégrée au tableau « Stock restant » : celui-ci doit rester identique à avant (aucune colonne ni filtre lié). Les saisies vont uniquement dans `mise_en_place_weekly`.
- Les constantes et l'agrégation des articles hebdo (Macaron/Sirop/Chantilly/Amandes, dates des lignes du Suivi Hebdo) vivent dans `src/lib/stockWeeklyAggregates.ts`, partagées entre `StockTable` et `WeeklyMiseEnPlacePage` pour garantir des valeurs identiques.
- Sur la page hebdo, « Stock restant » = stock à la fin de la semaine choisie (mouvements cumulés jusqu'au dimanche de la semaine ; Glace/Toppings via leurs agrégats bornés) — ne pas réutiliser le stock courant pour les semaines passées.
