# Plan d'extraction — page.tsx (séjour collaboratif)

État initial : `page.tsx` = 3 681 lignes / ~194 KB. 4 composants déjà extraits
(SejourHeader, TabDevisFacturation, TabNotes, TabParticipantsSaisieDirecte).
Pattern existant : `'use client'`, interface Props exportable, `sejourId` +
données + callbacks (`onError`, `onReload`, `onSejourUpdate`).

## Règle de partage du state

- **State exclusif à un onglet** → migre dans le composant (useState interne,
  chargement dans un `useEffect` au mount — équivalent au chargement par onglet
  actuel puisque le composant n'est monté que quand son onglet est actif).
- **State partagé entre onglets** → reste dans page.tsx, passé en props +
  callbacks de mutation.

### State PARTAGÉ (reste dans page.tsx)

| State | Consommateurs |
|---|---|
| `sejour` | header, tous les onglets |
| `budgetData`/`budgetLoading` + `loadBudget` | TabDevisFacturation (onglet devis) + onglet budget |
| `participants` + `loadParticipants` | onglets participants + groupes |
| `groupes` | onglet groupes + onglet planning (PlanningPDFButton) |
| `accompagnateurs` | onglet participants + `monRoleCollaboratif` (gating page) |
| `mutationError` / `error` | bannière + écran d'erreur page |
| `tab`, tracking `marquerVisite`, thématiques banner | page |

## Extractions (1 commit chacune)

### 1. TabMessages.tsx
- Rendu : chat (lignes ~1358-1413) + variante DIRECT `InviteOrganisateurCard`.
- `InviteOrganisateurCard` est partagé Messages/Journal → extrait dans
  `_components/InviteOrganisateurCard.tsx` (importé par les deux).
- Migre : `messages`, `msgInput`, `sending`, `bottomRef`, `loadMessages`,
  polling 10 s, auto-scroll, `handleSendMessage`.
- Props : `sejourId`, `user`, `isDirect`, `invitationCollab`, `estLectureSeule`.

### 2. TabPlanning.tsx (le plus gros)
- Rendu : grille DnD (~1416-1991) + modale activité (~3567-3675) + modale
  « vider le planning » (~3525-3556).
- Migrent AVEC le composant : `DroppableDay`, `DraggableCatalogueItem`,
  `DraggableActivity`, `DroppableParking`, `DraggableParkingItem`,
  `COULEURS_ACTIVITE`, le `DndContext` + `sensors` (useSensors reste local au
  composant — minimise les props).
- Migre : `planning`, `parking`, `activitesCatalogue`, `loadPlanning`,
  génération IA (jobId/status/pollRef), `calendarBodyRef`, débuts/fins
  activités, notif enseignant, vue semaine/jour, `planModal`,
  `showConfirmViderPlanning`, handlers add/delete/drag/resize/IA.
- Props : `sejourId`, `sejour`, `user`, `groupes` (partagé, pour le PDF),
  `onError`.

### 3. TabGroupes.tsx
- Rendu : ~1994-2208 (bandeau clôture, proposition IA, 2 colonnes DnD natif,
  modale groupe).
- `groupes` reste dans page (partagé avec planning) → props `groupes` +
  `onGroupesChange(groupes)` ; handlers (save/delete/affecter/retirer/proposer/
  appliquer/cloturer) migrent et mutent via le callback.
- Migre : `groupeModal`, `propositionGroupes`, `loadingProposition`,
  `dragEleve`. Charge localement `getActivitesCatalogue` au mount (préserve
  l'appel réseau actuel de l'onglet, même si non rendu).
- Props : `sejourId`, `sejour`, `user`, `groupes`, `participants`,
  `onGroupesChange`, `onSejourUpdate` (clôture), `onError`.

### 4. TabDocuments.tsx
- Rendu : ~2715-2878 (docs centre, upload drag&drop, liste).
- Migre : `docs`, `docsCentre`, `docForm`, `docFile`, `docDragging`,
  `docSending`, `docFileRef`, `loadDocs`, `loadDocsCentre`, handlers +
  constantes `TYPE_DOC_OPTIONS`/`TYPE_DOC_BADGE`.
- Props : `sejourId`, `isDirector`, `estLectureSeule`, `onError`.

### 5. TabBudget.tsx
- Rendu : ~2880-3152. `budgetData`/`loadBudget` restent dans page (partagés
  avec l'onglet devis) → props.
- Migre : `lignesCompl`/`recettes` (copies éditables, synchronisées depuis
  `budgetData` via useEffect), `ligneComplForm`, `recetteForm`, handlers
  add/delete + constantes `CATEGORIES_COMPL`/`SOURCES_RECETTES`.
- ⚠️ Les handlers delete appellent aujourd'hui `setError` (écran d'erreur
  page) — comportement préservé via prop `onError` branchée sur `setError`.
- Props : `sejourId`, `user`, `budgetData`, `budgetLoading`, `onReload`
  (loadBudget), `onError`.

### 6. TabProjetPedagogique.tsx
- Rendu : ~3154-3523. Gate `user.role === 'ORGANISATEUR'` reste dans page.
- Migre : `dossier`, `dossierLoading`, `objectifsPedago`, `lienProgrammes`,
  `loadDossier` (au mount) + imports PDF (ProjetPedagogiquePDFButton,
  PreparationTamPDFButton).
- Props : `sejourId`.

### 7. TabJournal.tsx
- Rendu : ~2603-2712 + variante DIRECT (InviteOrganisateurCard importé).
- Migrent : `JournalPostCard`, `PhotoGrid`, `formatDateRelative` (helpers
  utilisés uniquement par le journal), `journal*` states + handlers,
  chargement `getJournal` au mount.
- Props : `sejourId`, `user`, `isDirect`, `invitationCollab`,
  `estLectureSeule`, `onError`.

### 8. TabParticipantsCollab.tsx
- Rendu : ~2211-2586 (compteur/filtres/CSV, tableau, accompagnateurs, modale
  fiche élève). Rend `TabParticipantsSaisieDirecte` en enfant (inchangé).
- `participants`/`accompagnateurs` restent dans page (partagés) → props.
- Migre : `participantFilter`, `selectedParticipant`, `exportCSV`,
  `NIVEAU_SKI_LABEL`, `resolveFileUrl`/`BACKEND_URL`, imports
  `validerPaiement`/`getOrdreMissionHtml`.
- Props : `sejour`, `user`, `participants`, `accompagnateurs`, `onReload`
  (loadParticipants).

### 9. Nettoyage page.tsx
Reste : imports, state partagé + fetching, auth guard, tracking visite,
bandeau thématiques, router d'onglets, layout (sidebar/header/tabs/main).
Suppression des imports morts.

### 10. `npm run build` + fixes éventuels.

## Invariants (contrôlés à chaque étape)

- Zéro changement d'appel API (endpoints, payloads, moments de déclenchement).
- Zéro changement de logique métier ni de rendu visible.
- `npx tsc --noEmit` vert avant chaque commit.
