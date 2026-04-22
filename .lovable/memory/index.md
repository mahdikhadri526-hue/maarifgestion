# Project Memory

## Core
Supabase (Lovable Cloud) pour la base de données et la synchronisation en temps réel.
Accès sécurisé protégé par un code PIN à 4 chiffres (1975) à chaque session.
Design corporate tons bleus. Logo sur lock screen, header et tableaux.
Dashboard pro : statistiques sans icônes, tableau de stock masqué par défaut.
Calcul du stock : Stock Initial + Entrées - Sorties.
Chaque mouvement/réquisition exige le prénom de l'opérateur (champ obligatoire).
Ne PAS publier les modifications du jour tant que l'utilisateur n'a pas tapé le signal `go`.

## Memories
- [Gestion des stocks](mem://features/gestion-stock) — Formule de calcul, stock de départ, historique et règles de suppression
- [Rapports et analyses](mem://features/rapports) — Vue détaillée quotidienne par produit et option de synthèse globale
- [Réquisitions automatiques](mem://features/requisitions) — Saisies de consommation différées au lendemain (Salle/Emporter)
- [Lots et DLC](mem://features/lots-dlc) — Traçabilité FIFO alimentaire, alertes expiration (15j) et édition des lots
- [Traçabilité opérateur](mem://features/traceability) — Champ "Effectué par" obligatoire sur mouvements & réquisitions
- [Design System et UI](mem://style/ui-design) — Marqueurs visuels (fonds ambrés réquisition), agencement du dashboard et branding
- [Signal de publication](mem://preferences/publication-signal) — Mot-clé `go` requis avant toute publication
