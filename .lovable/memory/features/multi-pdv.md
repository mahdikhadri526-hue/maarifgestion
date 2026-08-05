---
name: Architecture multi-PDV
description: Cloisonnement des données par point de vente (pdv_id), tables partagées, sélection au démarrage
type: feature
---
L'application est multi-points de vente (PDV).

- Tables `pdvs` (liste des PDV) et `user_pdvs` (affectation admin des utilisateurs aux PDV).
- Colonne `pdv_id` sur : autocontrols, cleaning_logs, fridge_temperatures, initial_stocks, inventory_*, lot_entries, order_placed_products, production_entries, requisitions, saved_orders, stock_movements, weekly_tracking.
- Tables PARTAGÉES entre tous les PDV (pas de pdv_id) : finished_products, recipes, recipe_ingredients, glace_grammage, glace_storage_capacity, stock_ref_conversions.
- Isolation DB : policy RESTRICTIVE « pdv isolation » + fonction `can_access_pdv(uid, pdv_id)` (admin = tous les PDV).
- Frontend : `src/lib/pdvStore.ts` (PDV courant en localStorage) et `src/lib/db.ts` (client Supabase proxy qui filtre en lecture et injecte `pdv_id` en écriture). **Tout module touchant une table cloisonnée doit importer `supabase` depuis `@/lib/db`**, jamais depuis `@/integrations/supabase/client`.
- Sélection du PDV au démarrage (`PdvSelector`), changement via le menu utilisateur, gestion des PDV et affectations dans l'écran admin.
