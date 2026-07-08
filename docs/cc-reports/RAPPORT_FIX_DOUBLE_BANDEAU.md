# Rapport — Fix : dédoublonnage des bandeaux de validation (dashboard hébergeur)

**08/07/2026 — branche `fix/onboarding-double-banner` (depuis `main` à jour 64e712c), commit `189a99e`. Non poussée.**
Fichier unique : `frontend/app/dashboard/hebergeur/page.tsx` — 4 insertions, 1 suppression. Aucun backend.

## Le problème

Cas ex-nihilo : un hébergeur avec un centre PENDING et un claim `EN_ATTENTE_DOCUMENT` voyait **deux bandeaux ambre empilés** disant la même chose — le bandeau générique de revendication (« Revendication en cours — Kbis attendu ») et le bandeau par-centre (« Demande pour {nom} en attente de validation », qui nomme le centre et propose déjà le lien `/documents` quand le justificatif manque).

## Le changement

Une condition ajoutée au seul bandeau `EN_ATTENTE_DOCUMENT` :

```diff
- {claimStatut === 'EN_ATTENTE_DOCUMENT' && (
+ {/* Masqué si un centre PENDING affiche déjà son propre bandeau de validation
+     (cas ex-nihilo) — évite le double bandeau. Le bandeau claim reste affiché
+     pour la revendication d'un centre catalogue (centre ACTIVE → centresPending vide). */}
+ {claimStatut === 'EN_ATTENTE_DOCUMENT' && centresPending.length === 0 && (
```

## Comportement résultant

| Cas | Bandeau(x) affiché(s) |
|---|---|
| Ex-nihilo (centre PENDING, claim EN_ATTENTE_DOCUMENT) | Uniquement le bandeau par-centre (nomme le centre, lien Déposer un justificatif si absent) |
| Claim d'un centre catalogue (centre ACTIVE, `centresPending` vide) | Bandeau claim « Revendication en cours » — inchangé |
| Claim EN_ATTENTE_VALIDATION | Bandeau bleu — **non touché** |

Le bandeau `EN_ATTENTE_VALIDATION` (bleu), le `centresPending.map` et toute la logique de la page sont intacts — le diff ne contient que la condition et son commentaire.

## Gates

| Gate | Résultat |
|---|---|
| `npx tsc --noEmit` (frontend) | 0 erreur |
| `npm run build` (frontend) | 0 erreur |
