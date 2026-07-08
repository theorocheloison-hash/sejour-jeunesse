# Rapport — Prompt 6b-4 : section « Aller plus loin » dans la checklist onboarding

**08/07/2026 — branche `feat/onboarding-phase2`, commit `406498f`. Non poussée.**
Fichier unique : `frontend/app/dashboard/hebergeur/_components/OnboardingChecklist.tsx` — 17 insertions, 0 suppression. Purement additif, aucune logique.

## La section ajoutée

Bloc passif « Aller plus loin » avec les 3 liens de découverte validés :

- **Inviter un organisateur →** `/dashboard/hebergeur/inviter-enseignant`
- **Inviter vos collaborateurs →** `/dashboard/hebergeur/equipe`
- **Suivre votre chiffre d'affaires →** `/dashboard/hebergeur/pilotage`

Choix éditorial acté en amont : le lien « Gérer vos disponibilités » initialement proposé a été remplacé par « Inviter un organisateur » — la page `/disponibilites` est délibérément orpheline depuis le 01/07 (retirée de la sidebar, doublon du planning) ; la pointer depuis la checklist l'aurait ressuscitée. Les 3 routes retenues existent et sont navigables (vérifié sur le disque).

## Emplacement

Dans le **return principal uniquement** (état déplié) : juste après la fermeture du `<ul className="space-y-3">` des 5 étapes, avant le bloc `{!status.centreValide && (…)}`. Les états replié, célébration, chargement et erreur sont intacts (leurs `return` précèdent ce bloc et n'ont pas été touchés).

## Gestion du double séparateur

La note de validation qui peut suivre porte déjà `border-t border-gray-100 pt-3`. Le nouveau bloc porte donc son séparateur **conditionnellement** :

```jsx
<div className={`mt-4 ${status.centreValide ? 'border-t border-gray-100 pt-3' : ''}`}>
```

- Centre validé (note absente) → le bloc « Aller plus loin » porte le séparateur.
- Centre non validé (note affichée dessous) → le bloc n'en porte pas, seul celui de la note reste.

Un seul `border-t` visible dans les deux cas. Classes identiques à l'existant (`border-gray-100`, `text-xs`, `var(--color-primary)`).

## Interdictions respectées

Les 5 lignes d'étapes, la barre de progression, l'en-tête, les états repli/célébration et la logique `useEffect`/localStorage sont inchangés — le diff ne contient que le nouveau bloc.

## Gates

| Gate | Résultat |
|---|---|
| `npx tsc --noEmit` (frontend) | 0 erreur |
| `npm run build` (frontend) | 0 erreur |
