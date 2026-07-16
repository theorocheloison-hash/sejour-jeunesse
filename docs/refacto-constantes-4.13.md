# §4.13 — Recensement constantes backend (avant dédup)

> Date : 16/07/2026 — Run Fable 5. Périmètre : `backend/src/` uniquement, dédup pure, zéro changement de valeur/comportement.
> Livrable de revue pour Théo. Gates par famille : tsc + build + suite de tests (`npm test`, 136 tests) verts.

## 0. Existant vérifié (Phase 1a)

- `src/utils/departements.ts` : contient `DEPARTEMENTS_MAP` (**nom → code INSEE**) — table DIFFÉRENTE de `DEPT_TO_REGION` (**code → région**), non touchée. Aucun `DEPT_TO_REGION` n'y existe → c'est la maison canonique du nouvel export.
- Aucun fichier de constantes statuts devis n'existe (`src/devis/` = service/controllers/dto/pdf) → création de `src/devis/devis-statuts.constants.ts`.
- `src/centres/trial.helper.ts` : contient le 30 canonique (`trialExpiration()`, ligne 10) → maison de `TRIAL_DUREE_JOURS`.

## 1. Famille DEPT_TO_REGION (code département → région)

### 1.1 Occurrences (4)

| # | Fichier:ligne | Nom local | Taille | Contenu |
|---|---|---|---|---|
| 1 | `src/demandes/demande.service.ts:11` | `DEPT_TO_REGION` (module) | **100 paires** | métropole + `'20': 'Corse'` + DOM (971/972/973/974/976) |
| 2 | `src/public/public.service.ts:290` | `DEPT_TO_REGION` (local fonction) | **94 paires** | métropole SEULE (ni Corse ni DOM) |
| 3 | `src/sejours/sejour.service.ts:998` | `DEPT_REGION` (inline filtre) | **95 paires** | métropole + Corse, SANS DOM |
| 4 | `src/hebergements/hebergement.service.ts:71-87` | IIFE `region` | — | table **NOMS de département → région** (d.includes), autre mécanisme |

### 1.2 Vérification d'identité (diff programmatique, node)

Paires communes **toutes identiques** (zéro divergence de valeur). Mais les compositions diffèrent :
`public (94) ⊂ sejour (95, +Corse) ⊂ demande (100, +Corse +DOM)`.

**Conséquence comportementale d'une fusion** : les fonctions `matchesZone` de public/sejour utilisent un `getDeptCode` qui produit `'20'` (Corse) et `'97x'` (DOM). Avec la table complète, un centre corse ou DOM se mettrait à matcher `REGION:Corse` / `REGION:Guadeloupe`… là où aujourd'hui le lookup échoue (pas de match). C'est un CHANGEMENT DE COMPORTEMENT → interdit par le brief.

### 1.3 Décision

- **Canonique** : la table de `demande.service.ts` (la plus complète), exportée `DEPT_TO_REGION` dans `src/utils/departements.ts` (export distinct, `DEPARTEMENTS_MAP` intact).
- **Remplacée** : la copie de `demande.service.ts` uniquement (composition strictement identique).
- **Exceptions NON fusionnées** :

| Copie | Raison |
|---|---|
| `public.service.ts:290` | Composition différente (‑Corse ‑DOM) → fusion = changement du matching REGION pour centres corses/DOM dans la notification des centres. |
| `sejour.service.ts:998` | Composition différente (‑DOM) → même risque pour les DOM. |
| `hebergement.service.ts:71` | Table noms→région (entrée = nom de département, matching par `includes`) — autre famille. |

> Suggestion (hors run, décision métier pour Théo) : converger public/sejour vers la table complète serait probablement un FIX souhaitable (Corse/DOM ignorés semble un oubli, pas un choix) — mais c'est un changement de comportement, donc pas dans un run de dédup pure.

## 2. Famille Sets de statuts devis

### 2.1 Compositions réellement distinctes recensées

**Composition A — « devis retenus / CA confirmé »** : `SELECTIONNE, SIGNE_DIRECTION, FACTURE_ACOMPTE, FACTURE_SOLDE` — **9 littéraux** :

| # | Fichier:ligne | Forme | Intention locale |
|---|---|---|---|
| 1 | `admin/admin.service.ts:424` | `new Set([...])` `RETENUS` | KPIs réseau (devis retenus, CA) |
| 2 | `admin/admin.service.ts:668` | `new Set([...])` `RETENUS` | CA via réseau (détail centre) |
| 3 | `clients/clients.service.ts:145-150` | `CA_STATUTS: string[]` | CA client (CRM) |
| 4 | `collaboration/collaboration.service.ts:382` | `in: [...]` | budget : devis retenus |
| 5 | `devis/devis.service.ts:1837` | `[...].includes()` | garde génération convention |
| 6 | `centres/centre.service.ts:613` | `in: [...]` | CA prévisionnel dashboard |
| 7 | `centres/centre.service.ts:627` | `in: [...]` | CA via réseau dashboard |
| 8 | `rentabilite/rentabilite.service.ts:370-375` | `STATUTS_MARGE as const` | base TVA sur marge |
| 9 | `pilotage/pilotage.service.ts:11` | `STATUTS_CA: StatutDevis[]` (déjà nommé, 2 usages) | CA pilotage |

→ Canonique : **`STATUTS_DEVIS_RETENUS`**.

**Composition B — « devis engageants (sélectionné ou signé) »** : `SELECTIONNE, SIGNE_DIRECTION` — **5 littéraux** :

| # | Fichier:ligne | Forme | Intention locale |
|---|---|---|---|
| 1 | `collaboration/collaboration.service.ts:652` | `in: [...]` | devis retenu du séjour (activités catalogue) |
| 2 | `collaboration/collaboration.service.ts:845` | `in: [...]` | devis retenu du séjour |
| 3 | `centres/centre.service.ts:504` | `in: [...]` | acompte à émettre (devis signé sans facture) |
| 4 | `devis/devis.service.ts:2554` | `in: [StatutDevis...]` | autres devis actifs (rétrogradation séjour) |
| 5 | `sejours/sejour.service.ts:1257` | `in: [StatutDevis...]` | garde suppression séjour (devis engageant) |

→ Canonique : **`STATUTS_DEVIS_ENGAGEANTS`**.

**Composition C — « devis en cours (non résolus) »** : `EN_ATTENTE, EN_ATTENTE_VALIDATION, SELECTIONNE` — **2 littéraux** :

| # | Fichier:ligne | Forme | Intention locale |
|---|---|---|---|
| 1 | `devis/devis.service.ts:74-77` | `in: [StatutDevis...]` | anti-doublon devis par demande |
| 2 | `devis/devis.service.ts:1349-1352` | `in: [StatutDevis...]` | anti-doublon devis par séjour direct |

→ Canonique : **`STATUTS_DEVIS_EN_COURS`**.

### 2.2 Exceptions NON fusionnées (statuts devis)

| Fichier:ligne | Composition | Raison |
|---|---|---|
| `devis/devis.service.ts:411` (modifiables) et `:2511-2515` (annulables) | `EN_ATTENTE, SELECTIONNE, SIGNE_DIRECTION` | Même composition mais **deux intentions métier distinctes** (modification vs annulation), 1 occurrence chacune → pas de duplication par intention ; fusionner soude deux règles qui pourraient diverger. |
| `clients/clients.service.ts:83-91` `STATUTS_PERTINENTS` | 7 statuts (pipeline CRM) | Composition unique, non dupliquée. |
| `rentabilite/rentabilite.service.ts:248-255` `PRIORITE_STATUT` | 6 statuts **ordonnés** (ranking) | C'est un ordre de priorité, pas un Set de filtre ; unique. |
| `rentabilite/rentabilite.service.ts:264-271` | A + `EN_ATTENTE` + `EN_ATTENTE_VALIDATION` (6) | Composition unique. |
| `sejours/sejour.service.ts:257` | `EN_ATTENTE_VALIDATION` + A (5) | Composition unique. |
| Chaînes booléennes : `facture.service.ts:342, 646` (`!== SELECTIONNE && !== SIGNE_DIRECTION`), `devis.service.ts:909`, `devis.service.ts:2115-2116` (composition A en `===`), `devis.service.ts:772, 1018` (paires diverses) | — | Conditions `===`/`!==`, pas des littéraux de Set. Les réécrire en `.includes()` change la forme du code au-delà de la dédup pure. |
| Sets de **StatutSejour** : `pilotage.service.ts:8` `STATUTS_CONFIRMES` + `centres/centre.service.ts:696` (même composition `CONVENTION, SOUMIS_RECTORAT, SIGNE_DIRECTION, DECLARE_TAM` ×2) ; `collaboration.service.ts:91-92, 479, 505, 557` | — | **Hors famille** (mission = statuts DEVIS). La paire STATUTS_CONFIRMES ×2 est un candidat §4.13-bis. |

## 3. Famille durée trial (magic 30)

### 3.1 Occurrences réelles (2)

| # | Fichier:ligne | Contexte |
|---|---|---|
| 1 | `centres/trial.helper.ts:10` | `d.setDate(d.getDate() + 30)` dans `trialExpiration()` — canonique |
| 2 | `abonnements/abonnement.service.ts:84` | `expiration.setDate(expiration.getDate() + 30)` dans `activerTrial()` (self-service) |

⚠️ Les deux calculs d'expiration ne sont PAS identiques (`trialExpiration()` tronque à minuit date pure, `activerTrial` garde l'heure) → on ne remplace PAS l'expression par un appel à `trialExpiration()`, on centralise UNIQUEMENT le littéral 30.

→ Canonique : **`TRIAL_DUREE_JOURS = 30`** dans `trial.helper.ts`.

### 3.2 Faux positifs écartés (des 30 qui ne sont pas la durée du trial)

- `abonnement.service.ts:133` : seuil anti-abus extension `+ 40` (= 30 + marge, dérivé mais distinct — non touché).
- `auth.service.ts:776, 794, 861` + `auth-cookies.ts:17` + `centre.service.ts:1127` : refresh token / cookie 30 jours.
- `auth.service.ts:810` : magic link 30 **minutes**.
- `admin.service.ts:387, 535` : fenêtre analytique « 30 derniers jours ».
- `cron-alertes.service.ts:160, 210` : fenêtre d'alerte « expire dans 30j ».
- Textes d'emails « valable 30 jours » (admin.service:703, 1189) : liens d'invitation, pas le trial.

## 4. Plan de remplacement (Phase 3, un commit par famille)

1. `refactor(4.13): centralise DEPT_TO_REGION` — 1 copie remplacée (demande.service), 2 exceptions motivées.
2. `refactor(4.13): centralise durée trial` — 2 sites → `TRIAL_DUREE_JOURS`.
3. `refactor(4.13): centralise Set statuts devis` — 16 littéraux → 3 constantes (A×9, B×5, C×2), composition par composition.

Gate avant CHAQUE commit : `npx tsc --noEmit` 0 erreur · `npm run build` succès · `npm test` 100% verts (136 tests).

## 5. Rapport final

_(complété en Phase 4)_
