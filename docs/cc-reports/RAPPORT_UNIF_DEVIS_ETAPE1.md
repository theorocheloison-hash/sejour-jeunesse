# RAPPORT — Unification devis étape 1 : point d'entrée unique de renvoi

> Branche : `feat/unif-devis-etape1-renvoi` (depuis `main` = `5c48ce7`, à jour origin). **Aucun push, aucun merge.**
> Commit unique : `cc42357` — `feat(devis): point d'entrée unique de renvoi (orchestrateur DIRECT/organisateur, extraction notif)`
> `git show --stat` : 2 fichiers, +113/−32 (`devis.service.ts` +132 brut, `devis.controller.ts` +13).
> NB : ce rapport est volontairement laissé HORS commit (add ciblé imposé sur les 2 fichiers backend seuls).

## Census Phase 1 (lu sur fichiers réels avant écriture)

- `createDirectDevis` (`devis.service.ts:1419-1593` avant refactor) : bloc notif inline gaté `if (sejour.createurId && devis.tokenSignature) { try { … sendGenericNotification(lien public) … } catch {} }` en `:1554-1587`, entre le `$transaction` et le `return findUnique`.
- `envoyerDevisDirect` (`:1792+`) : signature `(devisId, userId, centreId?, messagePersonnalise?)`, ordre « email envoyé PUIS `dateEnvoi` posé » (commentaire source), garde `statut !== 'EN_ATTENTE'` → ForbiddenException « déjà signé ou facturé ». NON MODIFIÉE.
- Imports en tête : `ForbiddenException`/`NotFoundException` (`:1-5`), `assertEnvoiExterneAutorise, getCentreForUser` (`:17`), `FRONTEND_URL` lu via `process.env.FRONTEND_URL ?? 'https://liavo.fr'` (pattern existant).
- Patron contrôleur (`devis.controller.ts:271-282`, route `envoyerDirect`) : `@Post(':id/…') @Roles(Role.HEBERGEUR) @RequirePermission('devis')`, `@Param('id')`, `@CurrentUser`, `@CentreId`, body `{ messagePersonnalise?: string }`.

## Diff résumé (`git diff main...HEAD`)

- `devis.service.ts` :
  - NOUVELLE `renvoyerDevisOrganisateur(devisId, userId, centreId?)` — extraction fidèle du bloc notif (template HTML + lien `${frontendUrl}/devis/signer/${token}` repris verbatim, `enseignant` → `organisateur`). Gardes dans l'ordre : introuvable → 404 ; `centreId !== centre.id` → 403 ; `organisateurId == null` → 403 « pas d'organisateur rattaché » ; `statut !== 'EN_ATTENTE'` → 403 (esprit envoyerDevisDirect) ; `!tokenSignature` → 403. Organisateur chargé (introuvable → 404), `me` rechargé base, `assertEnvoiExterneAutorise`, email, PUIS `dateEnvoi` (miroir envoyerDevisDirect). Retour `{ success: true, message: 'Devis renvoyé à l'organisateur' }`. THROW en échec. Pas de log CRM (comportement d'origine conservé). Commentaire faux-ami `createurId` posé.
  - NOUVELLE `renvoyerDevis(devisId, userId, centreId?, messagePersonnalise?)` — orchestrateur : `aUnOrganisateur = devis.sejourDirect?.createurId != null` → `renvoyerDevisOrganisateur` sinon `envoyerDevisDirect`. Seul point de bifurcation.
  - REFACTOR `createDirectDevis` : bloc inline remplacé par `try { await this.renvoyerDevisOrganisateur(devis.id, userId, centreId); } catch { /* non bloquant */ }` sous le même gate. Rien d'autre modifié dans la méthode.
- `devis.controller.ts` : NOUVEL endpoint `POST /devis/:id/renvoyer` (patron envoyerDirect) → `renvoyerDevis`. `envoyer-direct` inchangé.

## Cascades

- **#1 (bloquante) — VERDICT : OK.** `schema.prisma:925` : `statut StatutDevis @default(EN_ATTENTE)` et le `tx.devis.create` de `createDirectDevis` ne pose pas `statut` → le devis est `EN_ATTENTE` quand l'auto-notif se déclenche. La garde EN_ATTENTE de la nouvelle méthode ne fait donc jamais taire la notif de création.
- **#2 — OK, preuve :** l'unique écriture `modeGestion: 'COLLABORATIF'` du backend est `invitation-collaboration.service.ts:258` (`accepter()`), toujours couplée à `createurId: user.id`. Donc `createurId == null` ⇒ séjour jamais rejoint ⇒ `modeGestion` toujours `'DIRECT'` ⇒ la garde `modeGestion !== 'DIRECT'` d'`envoyerDevisDirect` ne se déclenche jamais à tort via l'orchestrateur. (Devis d'appel d'offres : `sejourDirect` null ⇒ route client ⇒ garde « pas un devis direct » = comportement voulu.)
- **#3 — OK.** Refactor (c) : même gate (`createurId && tokenSignature`), même try/catch non bloquant, même email (template lifté verbatim), même ordre email→`dateEnvoi`. Seul changement observable : la notif de création pose désormais `dateEnvoi` (attendu, validé). Les gardes ajoutées de la méthode extraite sont toutes satisfaites par construction à la création (devis EN_ATTENTE #1, centre propriétaire, token présent via le gate) — aucun skip nouveau.
- **#4 — OK.** Le bloc était inline, aucun autre appelant. Aucun import ajouté/retiré (tout existait déjà en tête de fichier).

## Intacts (confirmés)

`envoyerDevisDirect` (corps + endpoint `POST /devis/:id/envoyer-direct`), frontend (0 fichier touché), facturation, migrations (0), schéma Prisma (0).

## Gates

- `npx tsc --noEmit` : 0 erreur.
- Build backend (`MOLLIE_API_KEY=test_dummy npm run build`) : exit 0.
- Tests : **4 failed / 2 todo / 445 passed** = baseline pré-existante exacte (rouges `facture.service.spec` + mollie, non touchés).
