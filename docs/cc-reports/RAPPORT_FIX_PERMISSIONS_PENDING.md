# Rapport — Fix : centre PENDING opérable dans getUserCentrePermissions

**08/07/2026 — branche `fix/permissions-centre-pending` (depuis `main` à jour 5e9605a), commit `234571e`. Non poussée.**
2 fichiers : le helper (1 ligne changée + commentaire) et sa spec (nouvelle, 6 cas). Aucun appelant touché, aucune requête Prisma ajoutée, aucun frontend, aucune migration.

## Le bug

`getUserCentrePermissions` (`backend/src/centres/permission.helper.ts`) refusait tout centre non-ACTIVE **avant** de vérifier la propriété. Le propriétaire d'un centre PENDING (nouvel hébergeur ex-nihilo) recevait `null` → 403 sur `/mes-permissions` et toutes les routes `@RequirePermission` → sidebar cassée. Incohérent avec `getCentreForUser`, qui laisse déjà entrer le propriétaire et les collaborateurs acceptés d'un PENDING.

## La ligne changée

```diff
- if (!centre || centre.statut !== 'ACTIVE') return null;
+ // SUSPENDED = kill switch ; PENDING opérable (aligné sur getCentreForUser) —
+ // les envois externes restent gatés séparément par assertEnvoiExterneAutorise.
+ if (!centre || centre.statut === 'SUSPENDED') return null;
```

Rien d'autre : le check propriétaire (`centre.userId === userId` → `OWNER_PERMISSIONS`) et le check collaborateur (`acceptedAt: { not: null }`) sont identiques. `hasPermission` intact.

## Les 6 cas de test (`permission.helper.spec.ts`, Prisma mocké)

| Cas | Attendu |
|---|---|
| ACTIVE + propriétaire | `OWNER_PERMISSIONS` (inchangé) |
| PENDING + propriétaire | `OWNER_PERMISSIONS` (**le fix**) |
| SUSPENDED + propriétaire | `null` (kill switch préservé, requête collab jamais lancée) |
| PENDING + collaborateur accepté | ses permissions stockées, `isOwner: false`, défauts `NONE`, WHERE `acceptedAt: {not: null}` vérifié |
| PENDING + tiers | `null` |
| Centre inexistant | `null` |

## Note sécurité

Ce fix **aligne `permission.helper` sur le modèle SUSPENDED-only** déjà en vigueur (`getCentreForUser`, `getCentresForUser`, `getCentreIdsForUser` : seul SUSPENDED bloque, PENDING est opérable). La frontière de sécurité de l'onboarding n'est pas l'accès au centre : **les envois externes restent gatés séparément** par `assertEnvoiExterneAutorise` (indépendant des permissions), et le catalogue public filtre `ACTIVE` par ses propres requêtes. Aucun trou ouvert — ACTIVE et SUSPENDED se comportent à l'identique, seul le propriétaire/collaborateur accepté d'un PENDING gagne (enfin) ses permissions.

## Gates

| Gate | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npm run build` | 0 erreur |
| `npm test` | 128 verts (122 existants + 6 nouveaux) + 3 todo, 8 suites |

Rejouer : `cd backend && npx jest src/centres/permission.helper.spec.ts`
