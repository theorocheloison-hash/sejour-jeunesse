# Rapport — Prompt 6a : flag `envoisBloques` dans onboarding-status

**08/07/2026 — branche `feat/onboarding-phase2` (créée depuis `main` à jour, 351b8ac), commit `45b8ebb`. Non poussée.**

## Le champ ajouté

Modification unique : `backend/src/centres/centre.service.ts`, méthode `getOnboardingStatus`, un seul champ ajouté à l'objet retourné (entre `centreValide` et `complete`), +11 lignes dont 4 de commentaire :

```ts
// envoisBloques : miroir EXACT de assertEnvoiExterneAutorise (centre.helper.ts),
// moins l'exception "destinataire = soi". Source unique de vérité pour l'encart
// pré-envoi + le pied de checklist. Endpoint owner-only (checklist affichée si isOwned),
// donc le membership déjà chargé = celui du propriétaire visé par le gate.
envoisBloques:
  centre.statut !== 'ACTIVE' ||
  (!!centre.organisationId &&
    !!membership &&
    ['EN_ATTENTE_DOCUMENT', 'EN_ATTENTE_VALIDATION', 'REFUSE'].includes(
      membership.claimStatut,
    )),
```

Réutilise les variables `centre` (résolue par `getCentreForUser`) et `membership` (déjà chargée dans le `Promise.all` existant) — **aucune requête Prisma ajoutée**, aucune migration, aucune dépendance, aucun fichier frontend.

## Interdictions respectées

- `centreValide`, `etapes`, `complete` : inchangés au caractère près.
- Requête membership existante : intacte (`findFirst` sur `{userId, organisationId}`, select `claimStatut`).
- Aucune autre méthode touchée (diff = 1 fichier, 11 insertions, 0 suppression).

## Gates

| Gate | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npm run build` | 0 erreur |
| `npm test` | 122 verts + 3 todo, inchangés (7 suites) |

## Note

Champ **additif** : `centreValide` inchangé, aucun consommateur existant impacté. Le prompt 6b (frontend, même branche, commit distinct) consommera le flag pour l'encart pré-envoi et le pied de checklist — ce qui résoudra l'incohérence cosmétique consignée le 07/07 (pied de checklist conditionné au statut centre alors que les envois sont gatés par le claim).
