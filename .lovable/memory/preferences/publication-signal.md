---
name: Signal de publication
description: Mot-clé requis avant toute publication ; le multi-PDV ne doit pas être publié
type: preference
---
Aucune publication (frontend) sans signal explicite de l'utilisateur.

**Signal de publication : `go`** (mot exact, envoyé par l'utilisateur)

**Non publiable pour l'instant :**
- Toute la refonte MULTI-PDV (sélecteur de PDV, codes d'accès, permissions par PDV, client `@/lib/db`)
- Toute modification ultérieure tant que `go` n'a pas été donné

**How to apply:**
- Ne JAMAIS appeler `preview_ui--publish` ni afficher `<presentation-open-publish>` sans le signal `go`.
- Quand l'utilisateur tape `go`, demander confirmation de ce qui doit partir en production avant de publier.
- Les migrations base de données sont déjà actives en production — elles sont additives et n'affectent pas la version publiée tant que le frontend n'est pas republié.
