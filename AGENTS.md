# AGENTS.md

- La page « Inventaire hebdomadaire » a été supprimée (30/09/2026) à la demande de l'utilisateur : ne pas la réintroduire. La table `mise_en_place_weekly` et ses données restent en base (l'utilisateur a refusé le DROP TABLE).
- Le tableau « Stock restant » comporte une colonne « Stock mise en place » (saisie via `mise_en_place_stocks` / `useMiseEnPlace`, une valeur par produit) placée avant « Stock total » ; Stock total = Stock restant + Stock mise en place. Réintroduite le 30/09/2026 à la demande explicite de l'utilisateur.
- Les constantes et l'agrégation des articles hebdo (Macaron/Sirop/Chantilly/Amandes, dates des lignes du Suivi Hebdo) vivent dans `src/lib/stockWeeklyAggregates.ts`, utilisées par `StockTable`.
