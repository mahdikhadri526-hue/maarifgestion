## Objectif

Ajouter une authentification email/mot de passe avec gestion fine des rôles et permissions par page/action. Admin = vous, avec accès total.

## Architecture

**Base de données (Lovable Cloud)**
- Enum `app_role` : `admin`, `manager`, `operator`, `viewer` (et rôle personnalisé possible)
- Table `profiles` (user_id, display_name, email, created_at) — créée auto via trigger sur signup
- Table `user_roles` (user_id, role) — séparée pour éviter l'escalade de privilèges
- Table `user_permissions` (user_id, permission_key, allowed) — permissions fines par utilisateur
- Fonction `has_role(user_id, role)` en SECURITY DEFINER
- Fonction `has_permission(user_id, permission_key)` qui retourne true pour admin sinon vérifie la table
- RLS activé sur toutes les tables ; admin = accès total, autres = selon permissions

**Permissions disponibles (clés)**
- `view_stock`, `view_dashboard`, `view_movements`, `view_requisitions`, `view_lots`, `view_autocontrol`, `view_weekly`, `view_reports`
- `edit_movements`, `delete_movements`
- `edit_requisitions`, `delete_requisitions`
- `edit_lots`, `delete_lots`
- `edit_autocontrol`, `delete_autocontrol`
- `manage_users` (admin uniquement par défaut)

**Frontend**
- Remplacer `PinLock` par un vrai écran d'authentification (Login + Signup) — garder le design bleu corporate + logo
- Page `/auth` : connexion + création de compte (email/mot de passe)
- Hook `useAuth()` : session, user, role, permissions, loading
- Composant `<ProtectedRoute requirePermission="...">` pour gating des pages
- Composant `<Can permission="...">` pour masquer/afficher boutons (modifier, supprimer)
- Page `/admin/users` (admin uniquement) : liste utilisateurs, attribution rôle, cases à cocher pour chaque permission, désactivation/suppression
- Adapter `Index.tsx` pour masquer les onglets selon les permissions
- Adapter les composants existants (StockTable, MovementHistory, etc.) pour masquer boutons modifier/supprimer selon permissions

**Sécurité**
- Auto-confirmation email activée (pas de vérification par mail — vous créez les comptes)
- Pas de Google OAuth (demande email/password uniquement)
- Premier utilisateur à s'inscrire avec votre email → admin automatique (trigger)
- RLS strict : seuls utilisateurs authentifiés peuvent lire/écrire ; suppression/modification gated par permission via policies

## Étapes

1. Migration SQL : enum, profiles, user_roles, user_permissions, fonctions, triggers, RLS sur toutes les tables existantes
2. Activer auth email + auto-confirm
3. Créer `useAuth`, `AuthProvider`, page `/auth`
4. Remplacer `PinLock` par redirection vers `/auth`
5. Créer `<ProtectedRoute>` et `<Can>`
6. Page admin `/admin/users` (CRUD utilisateurs + permissions)
7. Appliquer gating dans `Index.tsx` (onglets) et dans les composants (boutons modifier/supprimer)
8. Garder code PIN 1975 comme verrou de session optionnel ? **Question** : on le supprime ou on le garde en plus de l'auth ?

## Détails techniques

- `supabase.auth.signUp` / `signInWithPassword` / `signOut` / `onAuthStateChange`
- Premier admin : votre email à définir (je vous demanderai) → seed dans la migration
- RLS exemple sur `stock_movements` :
  - SELECT : `auth.uid() is not null AND public.has_permission(auth.uid(), 'view_movements')`
  - UPDATE : `public.has_permission(auth.uid(), 'edit_movements')`
  - DELETE : `public.has_permission(auth.uid(), 'delete_movements')`
- Admin bypass via `has_role(auth.uid(), 'admin')` OR dans chaque policy

## Questions avant de commencer

1. **Votre email admin** (pour vous attribuer le rôle admin automatiquement au premier login) ?
2. **Garder le code PIN 1975** en plus de l'authentification, ou le supprimer complètement ?
3. **Auto-confirmation email** activée (vous créez les comptes sans validation par mail) — OK ?
