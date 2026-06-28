## Nouveau module : Inventaire à double comptage

Ajout d'un onglet **« Inventaire »** entièrement isolé. Aucune table existante n'est modifiée, aucune donnée actuelle n'est touchée, aucun autre module n'est impacté.

### Principe fonctionnel

1. Un **manager / admin** crée une **session d'inventaire** (date + libellé).
2. La session génère automatiquement la liste des articles à compter en agrégeant les 4 sources (**Alimentaire, Emballage, Tarte, Glace**) avec leurs lots actifs (FIFO via `lot_entries`). Les lignes sont regroupées visuellement par catégorie.
3. Deux **compteurs** (utilisateurs A et B) sont assignés à la session. Chacun se connecte avec son propre compte et saisit, ligne par ligne :
   - Quantité **Stock**
   - Quantité **Mise en place**
4. **Aveugle mutuel** : chaque compteur ne voit jamais ni les saisies de l'autre, ni le stock théorique. Garanti côté base (RLS : un compteur ne lit que ses propres lignes) **et** côté UI.
5. Quand les deux comptages sont marqués « Terminé », le manager passe la session en **Rapprochement** :
   - Comparaison A vs B (Stock + Mise en place) → écarts entre comptages.
   - Comparaison **Stock (validé)** vs **stock théorique** de l'app → écart d'inventaire.
   - La quantité **Mise en place** est seulement archivée, jamais rapprochée.
6. Vue **« Articles à revérifier »** : ne liste que les lignes avec écart entre A et B. Après recomptage et validation manager, la session est **clôturée** (lecture seule).

### Écran principal

```text
[Sessions]  [+ Nouvelle session]

Session du 28/06/2026 — "Inventaire mensuel"   Statut: Comptage en cours
Compteur A: Karim   ✅ Terminé
Compteur B: Sara    ⏳ 12/48 lignes
─────────────────────────────────────────────
Mon comptage:
  ▸ ALIMENTAIRE
      Lait UHT     Lot L-2026-04   [Stock: __]  [Mise en place: __]
      Sucre        Lot L-2026-09   [Stock: __]  [Mise en place: __]
  ▸ EMBALLAGE
      Pot 250ml    Lot —           [Stock: __]  [Mise en place: __]
  ▸ TARTE
  ▸ GLACE
[Enregistrer] [Marquer comme terminé]
```

Vue rapprochement (manager) :

```text
Catégorie  Article    Lot       A.Stock  B.Stock  Écart A/B  Théorique  Écart vs Théo
ALIMENT.   Lait UHT   L-04        24       24       0          26          -2
ALIMENT.   Sucre      L-09        10        8       2 ⚠️        —           —
…
[Articles à revérifier (3)]   [Valider et clôturer]
```

### Détails techniques

**Nouvelles tables (préfixe `inventory_` — aucune table existante modifiée) :**

- `inventory_sessions` : `id, label, session_date, status (draft|counting|reconciling|closed), counter_a_user_id, counter_b_user_id, created_by, created_at, closed_at`.
- `inventory_lines` : `id, session_id, category, product_id, product_name, lot_id (nullable), lot_number, theoretical_qty` (snapshot à la création de la session — figé).
- `inventory_counts` : `id, session_id, line_id, counter_slot ('A'|'B'), counted_by_user_id, stock_qty, mise_en_place_qty, status ('draft'|'submitted'), updated_at`. Unique (`session_id, line_id, counter_slot`).
- `inventory_resolutions` : `id, session_id, line_id, final_stock_qty, final_mise_en_place_qty, variance_vs_theoretical, resolved_by, resolved_at`.

**RLS — aveugle mutuel :**

- `inventory_counts` SELECT : `counted_by_user_id = auth.uid()` OU `has_permission(auth.uid(), 'manage_inventory')` ET status session = `reconciling|closed`.
- `inventory_lines.theoretical_qty` : exposé via une vue qui masque la colonne aux compteurs (lecture autorisée uniquement aux managers / phase rapprochement).
- INSERT/UPDATE `inventory_counts` : autorisé seulement au compteur assigné à son slot, et tant que la session est en `counting`.
- Sessions / résolutions : pleins droits aux porteurs de la nouvelle permission `manage_inventory`.

**Permissions** (ajoutées à `user_permissions`, sans toucher aux existantes) :

- `view_inventory` : voir et participer.
- `manage_inventory` : créer sessions, voir tout, rapprocher, clôturer.

**Front :**

- Nouveau dossier `src/components/inventory/` :
  - `InventoryModule.tsx` (router interne sessions / comptage / rapprochement).
  - `SessionList.tsx`, `NewSessionDialog.tsx`.
  - `CountingView.tsx` (vue compteur, aveugle).
  - `ReconciliationView.tsx` (manager).
  - `RecheckView.tsx` (lignes en écart).
- `src/lib/inventoryData.ts` : helpers Supabase + agrégation initiale des articles (réutilise les fonctions existantes `getStockLevels` / `getLotEntries` en lecture seule).
- Hook `useInventorySession(sessionId)` avec realtime sur `inventory_counts` (filtré RLS).
- Nouvel onglet **« Inventaire »** dans `src/pages/Index.tsx` (icône `ClipboardCheck` ou `PackageCheck`), conditionné à `view_inventory`.

**Garanties d'isolation :**

- Aucune modification de `stock_movements`, `initial_stocks`, `lot_entries`, etc.
- L'inventaire n'écrit **jamais** dans ces tables. Si plus tard le manager veut transformer un écart en mouvement de régularisation, ce sera une action explicite séparée (pas dans ce lot).
- Aucun changement au `handle_new_user`, aux rôles existants, ni aux policies actuelles.

### Hors périmètre de ce lot

- Pas de génération automatique de mouvements de régularisation depuis les écarts (peut être ajouté ensuite).
- Pas d'export PDF (peut être ajouté ensuite).
- Pas de support > 2 compteurs.
