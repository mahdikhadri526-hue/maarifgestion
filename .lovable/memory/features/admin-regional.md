---
name: Rôle Admin régional
description: Rôle app_role 'regional_admin' limité à 2 comptes, PDV attribués via user_pdvs, permissions données par l'admin principal
type: feature
---
- Rôle DB `regional_admin` (enum app_role). **Maximum 2 comptes** (trigger `enforce_regional_admin_limit` + garde côté UI et edge function).
- L'Admin principal (`khadri1982@gmail.com`, rôle `admin`) reste seul à gérer rôles, permissions et affectations.
- PDV attribués : plusieurs lignes dans `user_pdvs` (index unique user_id+pdv_id), édités par l'admin principal via une case à cocher par PDV dans « Gestion des utilisateurs » (action edge `assign_pdvs`).
- `can_access_pdv` refuse à un admin régional tout PDV non attribué ; les autres rôles gardent le comportement d'avant.
- Permissions d'un admin régional = uniquement `user_permissions` (pas de bypass admin, pas de fallback `pdv_permissions`).
- Le compte `gestionmaarif1@gmail.com` reste protégé (UI + edge function).
