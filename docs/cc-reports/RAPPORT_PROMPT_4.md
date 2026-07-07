# Rapport — Frontend onboarding : checklist, welcome modal, messages (prompt 4)

Branche : `feat/onboarding-frontend` (depuis `main`). Frontend uniquement,
aucune dépendance ajoutée (animations CSS/Tailwind pur), `tsc --noEmit` +
`npm run build` verts avant chaque commit.

## Commits

| SHA | Contenu |
|---|---|
| `f0a83f2` | **Tâche 1** — écran de succès register hébergeur : encart 2 devient vert « Connectez-vous dès maintenant » (accès immédiat, trial 30j Pilotage, mention discrète du déblocage catalogue/envois après validation), CTA connexion en bouton principal. |
| `4a4753d` | **Tâche 2** — `extractApiError` : déballage additif du code `CENTRE_EN_VALIDATION\|message` (regex exacte, comportement inchangé sinon). |
| `190a173` | **Tâche 3** — suppression de l'export mort `activerTrial` (src/lib/abonnement.ts). |
| `f29800c` | **Tâches 4+5** — `OnboardingChecklist.tsx` + `WelcomeModal.tsx` + insertion dashboard. |
| `d191ed9` | **Tâche 6** — badge ocre « En validation » (sidebar mono-centre + CentreSelector). |

## Tâche 3 — fichiers touchés

`grep activerTrial` sur src/ et app/ : **un seul résultat, la définition
elle-même** dans `src/lib/abonnement.ts`. Aucun composant n'appelait la
fonction — aucun bouton/CTA à retirer. L'export mort a été supprimé.
Aucun usage ambigu à signaler.

## Tâche 4.3 — cible retenue pour le justificatif ABSENT

Grep `upload-kbis` : l'unique page appelant `uploadKbis` est
`app/centre/[id]/claim/page.tsx` (`POST /organisations/:id/upload-kbis`).
**Cette page n'est PAS retenue comme cible** : c'est le flux de revendication
publique — elle exige un id catalogue public, passe par `/public/centres/:id`
et affiche une erreur si `isClaimed` (ce qui est le cas d'un centre PENDING
dont le userId est posé). Un hébergeur ex-nihilo y tomberait sur un écran
d'erreur.

Cible retenue : **`/dashboard/hebergeur/documents`** — c'est déjà la
convention des bannières existantes du dashboard (« Déposer le document → »
pour `EN_ATTENTE_DOCUMENT`, « Déposer un justificatif → » pour les centres
pending). À signaler : cette page utilise `uploadCentreDocument`
(`/centres/documents`) et n'appelle pas `uploadKbis` — le câblage d'un vrai
formulaire justificatif (via `getMonClaimStatut().organisationId`, exposé au
prompt 3 précisément pour ça) reste un chantier à part.

## Tâche 4 — source d'ownership

`AuthContext` charge déjà `GET /centres/mes-centres` dont le
`CentreResume` contient **`isOwned`** (et `statut`, `nom`). La checklist
utilise `centres.find(id === centreActif).isOwned` — zéro appel ajouté,
`usePermissions` (qui referait un appel `mes-permissions`) n'était pas
nécessaire. Un collaborateur (`isOwned false`) ne voit jamais la carte.

## Tâche 5 — architecture du modal

`WelcomeModal` est rendu PAR `OnboardingChecklist` (elle-même montée dans le
dashboard) : le nombre d'étapes faites lui est passé en prop depuis l'unique
fetch `onboarding-status` — pas de second appel au même endpoint. Clé
`liavo_welcome_vu_<centreId>`, posée à TOUTE fermeture (bouton, clic
extérieur, Échap) pour ne jamais harceler. Plein écran < sm, carte centrée
sinon. Effet de bord assumé : un collaborateur ne voit pas le modal (la
checklist retourne null avant) — cohérent, les étapes sont orientées
propriétaire (IBAN, conformité).

## Tâche 6 — résultat

Le statut du centre courant était **déjà disponible** côté front :
`CentreResume.statut` dans `centres` (AuthContext, `mes-centres`). Badge
ocre « En validation » ajouté aux deux points d'affichage du centre
courant : bloc mono-centre de `HebergeurSidebar` et `CentreSelector`
(multi-centre, hors vue globale). Aucun appel API ajouté.

## Détails checklist (tâche 4)

- Fetch au montage + changement de centre ; skeleton pulse pendant le
  chargement ; erreur réseau → la carte ne s'affiche pas.
- Barre de progression ocre `#C87D2E` (transition CSS width 700ms), compteur
  X/5, coche scale-in (`@keyframes` inline, pas de dépendance).
- Étape 5 « Envoyez votre premier devis » en mise en avant ocre
  (`/dashboard/hebergeur/devis`).
- Célébration : « Votre centre est prêt 🎉 » + 12 confettis CSS (2s, une
  fois — clé `liavo_onboarding_fete_<centreId>` posée à l'affichage), puis
  plus jamais de carte.
- Repli chevron → ligne « Démarrage · X/5 — reprendre », clé
  `liavo_onboarding_replie_<centreId>` (jamais de clé globale).
- `centreValide === false` → pied discret « testez tout en vous envoyant vos
  documents à vous-même ».
- Mobile : paddings réduits, flex-wrap sur les lignes, liens en bloc,
  modal plein écran.
