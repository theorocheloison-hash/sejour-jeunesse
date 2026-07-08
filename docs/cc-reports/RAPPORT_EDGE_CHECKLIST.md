# Rapport — Checklist : pied de validation basé sur envoisBloques

**08/07/2026 — direct sur `main`, commit `e74a4df`. Non poussé.**
Fichier unique : `frontend/app/dashboard/hebergeur/_components/OnboardingChecklist.tsx` — 3 insertions, 2 suppressions.

## Le problème (incohérence consignée le 07/07)

Le pied « Centre en cours de validation — testez tout en vous envoyant vos documents à vous-même » était conditionné à `!centreValide` (statut du centre seul). Un claimant d'un centre catalogue **ACTIVE** avec revendication non validée avait ses envois gatés (`assertEnvoiExterneAutorise`) mais ne voyait pas la note — le cas exact de la faille ZZTEST. `envoisBloques` (exposé par le backend depuis 6a, miroir du gate) est la bonne source.

## Les 3 changements

1. **Type** : `envoisBloques: boolean;` ajouté à `OnboardingStatus`, à côté de `centreValide` (le backend le renvoie déjà).
2. **Séparateur du bloc « Aller plus loin »** : `status.centreValide` → `!status.envoisBloques` — le bloc porte son `border-t` seulement quand la note ne suit pas, logique inchangée mais alignée sur la nouvelle condition du pied.
3. **Pied de validation** : `!status.centreValide` → `status.envoisBloques`. Texte inchangé.

## Comportement résultant

| Cas | Pied affiché |
|---|---|
| Centre PENDING (ex-nihilo) | Oui (comme avant — `envoisBloques` couvre `statut !== ACTIVE`) |
| Centre ACTIVE + claim non validé (chemin ZZTEST) | **Oui (le fix)** |
| Centre ACTIVE + claim validé / NON_APPLICABLE / legacy | Non |

Le pied dit désormais exactement la même chose que le gate d'envoi backend et que l'encart pré-envoi de TabDevisFacturation (6b-2) — une seule source de vérité.

## Gates

| Gate | Résultat |
|---|---|
| `npx tsc --noEmit` (frontend) | 0 erreur |
| `npm run build` (frontend) | 0 erreur |
