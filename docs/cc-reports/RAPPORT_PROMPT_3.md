# Rapport — Tunnel justificatif ex-nihilo, dateEnvoi, onboarding-status (prompt 3)

Branche : `feat/onboarding-register-trial`. Backend uniquement,
`tsc --noEmit` + `npm run build` verts avant chaque commit (avec
`prisma generate` après le changement de schema).

## Commits

| SHA | Contenu |
|---|---|
| `03d4040` | **Tâche 1** — `registerHebergeur` (mode normal) crée le membership en `EN_ATTENTE_DOCUMENT` + `claimSubmittedAt` (param optionnel ajouté à `findOrCreateMembership` dans organisation.helpers.ts). Exception collision : membership `VALIDE` d'un AUTRE user sur l'organisation dédupliquée → `NON_APPLICABLE` conservé (inerte). |
| `5c5fbb6` | **Tâche 2** — `uploadKbis` accepte PDF/JPG/PNG 10 Mo (message « Le justificatif doit être un PDF, JPG ou PNG. », nom de méthode conservé) ; `getMonClaimStatut` expose `organisationId`. |
| `7e27660` | **Tâche 3** — `Devis.dateEnvoi` (schema + migration SQL manuelle `20260707_add_date_envoi_devis` : ALTER puis UPDATE backfill `created_at`) ; pose dans `envoyerDevisDirect` et `create` (COLLAB). |
| `48698af` | **Tâche 4** — `GET /centres/onboarding-status` (`@Roles(HEBERGEUR)`, `@CentreId()`, `getCentreForUser`). |

## Critère devis retenu (tâche 3c)

`envoyerDevisDirect` : `dateEnvoi = new Date()` posé **après** le succès de
`sendGenericNotification`, dans un update dédié. L'update existant de la
méthode (passage `statut → EN_ATTENTE`) est **conditionnel et antérieur à
l'envoi** : y fusionner `dateEnvoi` aurait marqué le devis « envoyé » même si
l'email échoue, et n'aurait pas couvert les renvois (statut déjà `EN_ATTENTE`).
Il n'existe aucun update post-envoi dans la méthode → celui créé est le seul.

## Tâche 3d — Chemin COLLABORATIF

**OUI, la création vaut envoi.** `devis.service.create` (réponse à une
`DemandeDevis`) notifie l'enseignant immédiatement après la création :
`sendDevisRecu(enseignant.email, …, magicUrl)` avec génération d'un magic link
(devis.service.ts, bloc « Notifier l'enseignant du nouveau devis »).
`dateEnvoi: new Date()` est donc posé directement dans le `prisma.devis.create`.
Rappel : depuis le prompt précédent, ce flux est gaté centre PENDING
(`assertEnvoiExterneAutorise` avant la création) — la pose de `dateEnvoi` à la
création reste cohérente : si le gate bloque, aucun devis n'est créé.

## Confirmation par lecture — ex-nihilo dans le tunnel admin

- `getClaimsEnAttente` (claim.service.ts) filtre
  `claimStatut IN ('EN_ATTENTE_DOCUMENT', 'EN_ATTENTE_VALIDATION')` avec
  include user + organisation (+ 3 centres) → le membership ex-nihilo
  `EN_ATTENTE_DOCUMENT` apparaît sur `/dashboard/admin/claims` sans autre
  changement. Le tri `claimSubmittedAt: 'asc'` fonctionne puisque la date est
  désormais posée à l'inscription.
- `uploadKbis` exige exactement `claimStatut === 'EN_ATTENTE_DOCUMENT'` →
  l'ex-nihilo peut soumettre son justificatif tel quel (passage en
  `EN_ATTENTE_VALIDATION` + notif admin).
- `validerClaim` exige `EN_ATTENTE_VALIDATION`, pose `VALIDE` + `isPrimary`,
  `compteValide`/`emailVerifie` sur le user (idempotent depuis le prompt 1),
  puis active les centres PENDING de l'organisation (`updateMany → ACTIVE`) —
  c'est exactement le déblocage catalogue/envois attendu pour l'ex-nihilo.

## Détails tâche 4

- Comptages (`produitCatalogue` actifs, `sejour` avec
  `hebergementSelectionneId = centre.id AND deletedAt IS NULL`, `devis` avec
  `dateEnvoi NOT NULL`) dans **un seul `$transaction`** ; le membership
  (organisation du centre, user courant) est résolu en parallèle via
  `Promise.all` (ou `null` si le centre n'a pas d'organisation).
- `justificatif` : membership `VALIDE` → `'VALIDE'` ; `EN_ATTENTE_VALIDATION`
  → `'EN_ATTENTE_VALIDATION'` ; `EN_ATTENTE_DOCUMENT`/absent/autre →
  `'ABSENT'` ; indépendamment, `centre.claimDocumentUrl` non null relève un
  `'ABSENT'` en `'EN_ATTENTE_VALIDATION'` (justificatif porté par le centre,
  cas multi-centre).
- `conformite.ok = justificatif !== 'ABSENT' && iban` ;
  `complete` = les 5 étapes ok ; `centreValide = statut === 'ACTIVE'`.
- Aucun endpoint de masquage (repli de carte purement frontend).

## Note migration

Fichier écrit à la main (`prisma/migrations/20260707_add_date_envoi_devis/
migration.sql`), jamais `prisma migrate dev` ; sera appliqué par
`migrate deploy` (Procfile). `ALTER TABLE` puis `UPDATE` dans cet ordre dans
le même fichier.
