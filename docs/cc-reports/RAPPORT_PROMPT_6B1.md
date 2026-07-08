# Rapport — Prompt 6b-1 : modale de choix test/réel dans CreateSejourModal

**08/07/2026 — branche `feat/onboarding-phase2` (contient le 6a), commit `0eb1ec4`. Non poussée.**
2 fichiers, 81 insertions, 1 suppression. Aucun backend, aucune dépendance, aucune autre modale touchée.

## Fichier 1 — `frontend/app/dashboard/_shared/CreateSejourModal.tsx`

- Prop optionnelle `proposeTest?: boolean` ajoutée à `CreateSejourModalProps` (les props existantes sont inchangées).
- `useAuth()` importé, `user` récupéré.
- État d'étape : `useState<'CHOIX' | 'FORMULAIRE'>(proposeTest ? 'CHOIX' : 'FORMULAIRE')`.
- Handlers :
  - `choisirTest` : pré-remplit `titre` (si vide : « TEST — Mon séjour test » / « TEST — Mon événement test » selon `natureSejour`), `clientPrenom`/`clientNom`/`clientEmail` depuis `user` (firstName/lastName/email — champs vérifiés sur le type `User`), puis `setClientType('PARTICULIER')` et passage au formulaire.
  - `choisirReel` : passage direct au formulaire, rien pré-rempli.
- Rendu : à l'intérieur de la coquille modale existante, `etape === 'CHOIX'` affiche l'écran de choix (titre « Comment voulez-vous commencer ? », carte « 🧪 Séjour test (recommandé) » avec bordure primaire, carte « Vrai séjour client », lien « Annuler » → `onClose`) ; sinon le formulaire existant, inchangé au caractère près (englobé dans un fragment).

## Fichier 2 — `frontend/app/dashboard/hebergeur/planning/page.tsx`

- Import `api` ajouté (absent auparavant).
- `useAuth()` de `PlanningContent` élargi : `centres` et `centreActif` en plus de `user`/`isLoading`.
- État `onboardingComplete` initialisé à `true` (défaut = ne rien proposer tant qu'on ne sait pas, jamais de faux positif).
- `useEffect` (déclenché sur user HEBERGEUR, comme `loadData`) : `GET /centres/onboarding-status` → `setOnboardingComplete(!!data.complete)` ; échec → `true`.
- Au rendu : `const centreCourant = centres.find(c => c.id === centreActif); const proposeTest = !onboardingComplete && !!centreCourant?.isOwned;` puis `proposeTest={proposeTest}` passé à `<CreateSejourModal>`. Rien d'autre touché au rendu.

## Zéro régression (proposeTest défaut false)

`proposeTest` non fourni → `etape` démarre à `'FORMULAIRE'` → comportement strictement identique à aujourd'hui. Inventaire **exhaustif** des appelants vérifié par grep : 2 seulement — `planning/page.tsx` (câblé par ce prompt) et `clients/page.tsx` (CRM, non câblé → défaut false, inchangé). Aucun champ du formulaire, aucun handler existant (`handleSubmit`, `selectContact`, `selectStruct`…), ni la signature de `createSejourDirect`, ni le flux de soumission n'ont été modifiés.

## Gates

| Gate | Résultat |
|---|---|
| `npx tsc --noEmit` (frontend) | 0 erreur |
| `npm run build` (frontend) | 0 erreur |

## Note

La logique de blocage des envois n'intervient pas ici : le séjour test est une proposition, jamais une contrainte (un premier séjour peut être réel). L'encart pré-envoi consommera `envoisBloques` (6a) dans un commit ultérieur de la même branche.
