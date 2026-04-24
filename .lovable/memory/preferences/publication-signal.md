---
name: Signal de publication
description: Mot-clé requis avant de publier les modifications du jour
type: preference
---
Toutes les modifications faites à partir de 16:32 ne doivent PAS être publiées tant que l'utilisateur n'a pas envoyé le signal.

**Modifications concernées (cumulées) :**
- Boutons Transfert / Mr Hassan
- Réintégration des transferts
- Filtres historique mouvements
- Tableau "Qté à commander" sur le dashboard (variant order)
- Colonne "Stock actuel" + filtres par période
- Toute modification ultérieure tant que le signal n'a pas été donné

**Signal de publication : `go`**

**How to apply:**
- Ne JAMAIS suggérer de publier (pas de `<presentation-open-publish>`) tant que l'utilisateur n'a pas tapé `go`.
- Quand l'utilisateur tape `go`, proposer la publication.
- Les modifications backend (migrations DB) sont déjà actives — cela ne concerne que la publication frontend.
