# RUN CHAMBRES — Frontend alertes capacité (étage 1) — Plan (Phase 1, lecture seule)

> **Rédigé le 21/07/2026** — **Statut : VALIDÉ PAR THÉO le 21/07/2026** (commit 3 badge liste
> séjours INCLUS, libellé §3 tel quel).
> Sources lues : `ARCHITECTURE_MODULE_CHAMBRES.md` §4, `run-chambres-1.md` §5,
> `capacite.controller.ts` + `capacite.service.ts` (contrat réel, déployé `success` en prod),
> `src/lib/api.ts` (axios + X-Centre-Id), `src/lib/rentabilite.ts` (pattern lib),
> `dashboard/hebergeur/page.tsx`, `dashboard/hebergeur/sejours/page.tsx`,
> `dashboard/sejour/[id]/page.tsx`, `OnboardingChecklist.tsx` (pattern composant autonome),
> `src/lib/collaboration.ts` (types SejourCollabInfo/SejourPlanning).

## 1. Contrat API (constaté dans le code backend — NON modifiable)

- `GET /chambres/alertes-capacite` → `{ capacite: number, alertes: AlerteCapacite[] }` avec
  `AlerteCapacite = { sejourId, titre, dateDebut, dateFin, effectif, maxOccupationSignee,
  deficit, etat: 'ACTIVE' | 'ACQUITTEE', capaciteAlerteAcquitteeAt: string | null }`.
  Les alertes ACQUITTEE sont DANS la liste (badge « prévenu ») ; réarmement déjà géré serveur.
- `PATCH /chambres/alertes-capacite/:sejourId/acquitter` → `{ sejourId,
  capaciteAlerteAcquitteeAt, etat: 'ACQUITTEE' }`. 400 si rien à acquitter/non-OPTION,
  403 autre centre, 404 introuvable.
- **Transport** : l'instance `api` (`src/lib/api.ts`) pose déjà `X-Centre-Id` depuis
  `localStorage['liavo-centre-actif']` par intercepteur → un changement de centre actif est
  automatiquement cloisonné. Jamais de fetch direct.

## 2. Fichiers (tous nouveaux sauf 2 branchements d'une ligne chacun + 1 badge liste)

| Fichier | Rôle |
|---|---|
| `src/lib/chambres.ts` (nouveau) | Types + `getAlertesCapacite()` + `acquitterAlerteCapacite(sejourId)` — pattern copié de `rentabilite.ts` |
| `app/dashboard/_shared/AlertesCapacite.tsx` (nouveau) | Le composant : hook de fetch + bannières. Partagé dashboard/page séjour (d'où `_shared`, comme `CreateSejourModal`) |
| `app/dashboard/hebergeur/page.tsx` | +1 bloc `<AlertesCapacite />` |
| `app/dashboard/sejour/[id]/page.tsx` | +1 bloc `<AlertesCapacite sejourId={id} />` |
| `app/dashboard/hebergeur/sejours/page.tsx` | badge ligne (commit 3, optionnel — cf. §5) |

## 3. Le composant `AlertesCapacite` (un seul, deux usages)

- **Props** : `{ sejourId?: string }`. Sans `sejourId` → mode dashboard (toutes les alertes) ;
  avec → mode page séjour (l'alerte de CE séjour uniquement, rien rendu sinon).
- **Garde rôle** : `useAuth()` interne — **aucun appel API si `user.role !== 'HEBERGEUR'`**
  (le composant rend `null`). Sur la page séjour (partagée ORGANISATEUR/SIGNATAIRE), c'est la
  seule garde nécessaire ; pas besoin de tester `statut === 'OPTION'` côté client (le serveur
  ne renvoie que des options en alerte), mais on le fait quand même via `sejourId` matching —
  zéro logique métier dupliquée.
- **États** :
  - `ACTIVE` → bannière ambre (pattern bandeau thématiques) :
    « ⚠️ **{titre}** (option, {effectif} pers., {dateDebut} → {dateFin}) : plus accueillable —
    {maxOccupationSignee}/{capacite} places prises par des séjours signés, déficit
    {deficit} place(s). » + bouton **« J'ai prévenu le client »** (+ lien vers le séjour en
    mode dashboard).
  - `ACQUITTEE` → badge discret gris/bleu : « ⏳ Prévenu le {date} — en attente », pas de
    bouton.
- **Acquittement** : `PATCH` → puis **`refetch` du GET** — l'état affiché vient TOUJOURS du
  serveur (aucun état optimiste sur l'empreinte, conformément au run). Bouton disabled pendant
  l'appel ; erreur → message inline discret, pas de crash.
- **Dashboard** : bloc placé dans `<main>` après les bannières essai/abonnement, avant la
  zone KPI CA (`page.tsx:339`) — même langage visuel que les bannières existantes.
- **Page séjour** : bloc placé entre le bandeau `mutationError` et le bandeau « thématiques
  manquantes » (`page.tsx:231`), full-width `border-b` comme eux.

## 4. Refetch — décision proposée

Fetch au mount (par usage), refetch après acquittement, **pas de polling**. Le dashboard et la
page séjour refont le GET à chaque navigation — suffisant pour une alerte dont la situation
bouge à l'échelle de jours. (Le `focus` listener existant de la page séjour ne recharge que le
séjour ; on ne s'y greffe pas.)

## 5. Commits proposés

1. `src/lib/chambres.ts` + `AlertesCapacite.tsx` + branchement dashboard.
2. Branchement page séjour.
3. **Optionnel (à valider)** : badge « ⚠️ / ⏳ » sur les lignes de la liste séjours
   (`hebergeur/sejours/page.tsx`) — le doc archi D9 cite « dashboard + page séjour + liste
   séjours », le prompt du run ne cite que les deux premiers. Coût : 1 fetch + 1 Map par
   sejourId + 1 span. Dis oui/non.

Gates à chaque commit : `npx tsc --noEmit` + `npm run build` + `npx vitest run` (baseline
16 tests). Interdits tenus : zéro backend, zéro modification de contrat, pas de push.

## 6. Livraison (Phase 2, 21/07/2026) — 3 commits, gates verts à chacun

| Commit | Contenu |
|---|---|
| `329160e` | `src/lib/chambres.ts` + `_shared/AlertesCapacite.tsx` + branchement dashboard |
| `0de2963` | Branchement page séjour (`<AlertesCapacite sejourId={id} />`, bandeau full-width) |
| `d919e08` | Badge « ⚠️ plus accueillable » / « ⏳ prévenu » sur la liste séjours |

Chaque commit : tsc 0 erreur · vitest 16 verts · `npm run build` + postbuild standalone OK.
Pas de push (review Théo). **Recette visuelle à faire en prod après déploiement** : créer une
option en surcapacité sur un centre de test → bannière dashboard, bannière page séjour, badge
liste ; acquitter → badge « prévenu » partout ; modifier l'effectif → réarmement (ACTIVE).
