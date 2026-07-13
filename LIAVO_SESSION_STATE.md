# LIAVO — État session dev
> Dernière mise à jour : 13/07/2026 — Session chantier inscription ex-nihilo SOLDÉ (atomicité `60eb12f`, SIRET 3 DTO `b1bbcd4`, motDePasseDefini `5e59e28`, emails non bloquants `2a07b7b`, écran justificatif + 3 CTA + boucle résiduelle `ba54a8c`→`81e4315` ; recette prod complète jusqu'au devis DEV-2026-0001 ENVOYÉ) + **fix déploiement frontend silencieusement cassé depuis le 12/07 15h42** (HOSTNAME × Next standalone, `88e49ec`, ⚠️ vérifier `scalingo deployments` après chaque push) + ménage démo LMDJ + Chalet des Nants détaché de Pôle Montagne (org dédiée `24e4e21e`, centre ACTIVE revendicable) + purge préparée (`docs/purge-13-07.sql`, à exécuter par Théo). Avant : 12/07/2026 — Session export ZIP factures : téléchargement en masse des PDF de factures (ZIP + index CSV), avoirs inclus dans le ZIP ET dans l'export CSV comptable (colonne Type), **bug multi-centre des exports réparé** (3 commits poussés : `6023edc`, `f0f96f8`, `b0a1ed3` ; recette prod validée). **Correction d'un statut faux** : `28e364a` (fix SIRET) était noté « non poussé » dans ce doc ET dans la roadmap — il est en prod depuis le 09/07 (2e dérive de statut en 4 jours). Avant : 09/07/2026 — Session Louise / PULSE SPORTS : bug SIRET (espaces → overflow VarChar(14)), fix `@Transform` (commit `28e364a`, **poussé — en prod depuis le 09/07**), rattrapage SQL complet (compte + centre Valloire ACTIVE, trial Pilotage 30j), trou inscription ex-nihilo documenté (roadmap 🔴). Avant : 08/07/2026 (soir, tard) — Fix page abonnement : libellés neutres (amorce 2.4) + bouton « plan actuel / Nous contacter » dérivé du plan courant (`PricingTable`), vérifié on-MCP, poussé. Avant : run dette §4 (4.11 13 vulns→3 next 16.2.10 xlsx accepté ; 4.15 bandeau non-destructif ; 4.6/4.10 déjà faits ; 4.7 audit prêt, **requêtes prod à exécuter par Théo** `docs/AUDIT_FLOAT_DECIMAL.md`). Après-midi : 10.1 livré, deadline 26/09 NEUTRALISÉE. Voir sections + roadmap §2/§4/§10.

---

## SESSION 13/07/2026 — Chantier inscription ex-nihilo soldé + fix déploiement frontend + ménage

### 1. Chantier atomicité / inscription ex-nihilo (bloc 🔴 roadmap → RÉSOLU)
- **`60eb12f`** — `registerHebergeur` mode normal en transaction interactive (user + centre + organisation + membership + **consentement RGPD**), try/catch avaleur supprimé (rollback réel), mapping P2002 → 409 / P2000 → 400 FR, tous les emails après commit. **Rollback prouvé sur vraie base** (Postgres jetable : échec en milieu de transaction → 0 ligne, même email réutilisable immédiatement). Helpers `findOrCreateOrganisation`/`findOrCreateMembership` élargis à `Prisma.TransactionClient` (type `PrismaLike`).
- **`b1bbcd4`** — SIRET `@Length(14,14)` + `@Transform` strip sur les **3 DTO** (register-hebergeur, create-centre, update-centre). Vérifié : les 3 formulaires envoient `siret: form.siret || undefined` → clé absente quand vide, `@IsOptional` skippe. Les syncs LMDJ/APIDAE ne passent pas par `CreateCentreDto` → aucun import cassé.
- **`5e59e28`** — `motDePasseDefini: true` dans `centre.service.register()` (bug dormant : `login()` compare contre DUMMY_HASH sans lui ; corrigé AVANT le futur fix du routage cas 2 qui l'aurait réveillé).
- **`2a07b7b`** — emails post-inscription en fire-and-forget avec log exploitable (registerHebergeur ×2 modes, registerOrganisateur, registerSignataire). Porte de sortie vérifiée de bout en bout : `resendVerification` + bouton « Renvoyer l'email » sur /login.
- **Écran justificatif** (`ba54a8c` + `c90fd53` + `39aae43` + `6f765fa` + `74adee8` + `81e4315`) : `/dashboard/hebergeur/justificatif` — cas (A) `upload-kbis` champ `file` (organisationId du CENTRE ACTIF via onboarding-status), cas (B) `upload-justificatif` champ `document` (multi-centre : préselection centre actif, sinon choix explicite), cas (c) états explicites. **Refetch post-upload = la boucle infinie de redépôt est morte.** 3 CTA rebranchés (`/documents` conservée pour agréments/assurances). Boucle résiduelle fermée : un centre PENDING couvert par un claim EN_ATTENTE_VALIDATION de son organisation ne redemande plus de justificatif (`centreCouvertParClaim`) — le cas (b) légitime (hébergeur validé, claimStatut null) préservé et testé.
- **Recette prod complète** : `ZZZ RECETTE 13-07` (SIRET fictif `99999999900019`, SIREN vierge vérifié) — inscription → 5 objets en base d'un coup → membership **EN_ATTENTE_DOCUMENT** (contrôle clé) → dépôt → checklist « en cours d'examen » SANS reload → bannière sans CTA → validation admin (Théo) → centre ACTIVE → `envoisBloques=false` → **devis DEV-2026-0001 créé et ENVOYÉ à un destinataire externe**. Le cul-de-sac Louise Giard n'existe plus.
- **Analyse initiale corrigée** (voir roadmap) : l'admin a toujours pu valider (`/centres/admin/claims`, permissif) ; le SIRET était un symptôme, pas la cause ; 3 CTA cassés, pas 1 ; 5e cause découverte (emails awaités post-commit).

### 2. 🔑 Fix déploiement frontend (découvert par accident — bloquait TOUT)
- Frontend Scalingo cassé depuis le **12/07 15h42** : 3 deploys `timeout-error`, prod sur code périmé SANS ALERTE. Fausse piste écartée au passage (le « Markdown collé dans next.config.ts » n'a jamais existé — artefact de copie d'un rendu Markdown ; `git log -S` sur toute l'histoire : zéro occurrence).
- Cause prouvée en one-off Scalingo : Next 16 standalone binde `process.env.HOSTNAME` (= nom du container injecté par Scalingo) → `LOOPBACK_REFUSED`/`HOSTNAME_OPEN` → la sonde de boot ne voit rien → timeout 60 s. Contre-épreuve `HOSTNAME=0.0.0.0` → `LOOPBACK_OPEN`.
- **`88e49ec`** : Procfile `HOSTNAME=0.0.0.0 node .next/standalone/server.js` + `cp -r` déplacés du boot vers `postbuild` (`scripts/prepare-standalone.mjs`). Deploy suivant : **success**.
- ⚠️ **Leçon** : vérifier `scalingo deployments` après chaque push — un frontend peut échouer en silence pendant que le backend continue de se déployer (divergence sans alerte).

### 3. Ménage & données (session du matin, acté ici)
- Ménage démo LMDJ effectué.
- **Chalet des Nants détaché de l'organisation Pôle Montagne** → nouvelle organisation dédiée `24e4e21e-c544-448f-9bb1-98fe6267fc32`, centre `fe8d1222-7f76-4622-8fbe-76b82cb6ac95` ACTIVE, **revendicable**. ⚠️ NE PAS purger — légitimes.
- **Purge préparée, NON exécutée** : `docs/purge-13-07.sql` — comptes `recette-exnihilo-13-07@liavo.fr` (ZZZ RECETTE 13-07) et `trochenrc@gmail.com` (centre « test » SUSPENDED). Diagnostic prod : 0 facture sur les 2 devis, séquences `sequence_numero` par ORGANISATION dédiée → aucune séquence comptable partagée trouée. **Théo exécute.**

### Dette nouvelle (voir roadmap 🟡 13/07 et 🟠 TRIAL, blocs déjà rédigés)
`createCentre` avale encore l'échec organisation ; 3 workflows admin divergents (décision : claim.service source unique, ordre impératif documenté) ; Node 20 EOL ; trial 30j démarre pendant l'attente de validation.

---

## SESSION 12/07/2026 — Export ZIP des factures PDF + réparation du bug multi-centre des exports

### Déclencheur
Besoin Sauvageon : récupérer toutes les factures d'une période en PDF pour le comptable. Les 2 exports existants de l'onglet Pilotage → Comptabilité sont des CSV, pas des PDF.

### Ce qui existait déjà (lu on-code avant toute proposition)
- `Facture.pdfUrl` : PDF **Factur-X** (PDF/A-3 + XML CII) déjà généré à l'émission et stocké sur OVH (dossier privé `factures/`).
- `StorageService.fetchAsBuffer(url)` : lecture d'un objet privé avec les credentials S3 internes. Brique exacte pour un ZIP.
- **`pizzip` déjà en dépendance directe** du backend (via docxtemplater) → ZIP faisable **sans ajouter une seule dépendance**.
- SQL prod de contrôle (Sauvageon) : **62 factures (45 ACOMPTE + 17 SOLDE), 0 `pdf_url` NULL, 0 AVOIR en base.**

### Livré (3 commits, poussés, déployés)
**`6023edc` + `f0f96f8` — backend**
- `StorageService.zipFromUrls(entries, extras, concurrence=5)` : **générique** (`{nom, url}`, zéro couplage Prisma → l'extension aux `FacturePrestataire.fichierUrl` coûtera ~30 lignes). Fetch par lots de 5 ; une entrée en échec n'interrompt pas le zip (retournée dans `manquants`). Compression **STORE** (les PDF sont déjà compressés ; `pizzip.generate` est synchrone → DEFLATE bloquerait l'event loop pour 0 gain). `extras` accepte un tableau **ou une fonction `(manquants) => extras[]`** évaluée APRÈS les fetchs — c'est ce qui permet au manifeste de lister les échecs de fetch.
- `PilotageService` : requête factorisée dans `getFacturesPeriode` (source unique CSV + ZIP), **avoirs inclus** (filtre `not: 'AVOIR'` supprimé), **colonne `Type`** en 3e position du CSV, `Payé = '—'` sur les avoirs (montants négatifs → la comparaison n'a pas de sens). `getFacturesPdfPreview` (total / avecPdf / sansPdf). `exportFacturesZip` : plafond dur **300 factures** (400), nommage `AVOIR_YYYY-MM-DD_numero_slug.pdf`, `_factures.csv` (index) + `_PDF_MANQUANTS.txt` embarqués.
- 2 routes `GET /pilotage/export/factures-pdf[/preview]`, `@RequirePlan('COMPLET', {strict:true})`. **Aucun guard touché.**
- 7 tests unitaires (nommage, préfixe AVOIR, plafond, manquants, fetch en échec) — **obligatoires : 0 avoir en base, ce code ne sera jamais recetté en prod.**

**`b0a1ed3` — frontend**
- `src/lib/download.ts` : `downloadViaApi(url, fallback)` — axios `responseType: 'blob'`, filename lu depuis `content-disposition`, ObjectURL révoqué, **erreur Blob reparsée en JSON** (le message backend remonte tel quel).
- `src/lib/pilotage.ts` : `exportFacturesURL` / `exportVersementsURL` **supprimés** (cause racine, cf. ci-dessous).
- Page comptabilité : les 2 `<a>` deviennent des `<button>` (spinner + erreur), 3e carte « Télécharger les factures (PDF) » avec pré-vol (`useEffect` + flag `ignore` anti-race sur les raccourcis de période), bouton désactivé si `avecPdf === 0`, label « Préparation de l'archive… ».

### 🔑 Le vrai fix : bug multi-centre des exports (tournait en prod, jamais vu)
`exportFacturesURL()` fabriquait un `<a href="/api/pilotage/export/...">`. **Un `<a href>` court-circuite l'instance axios** → le header `X-Centre-Id` (posé par l'interceptor) ne partait JAMAIS → `@CentreId()` (qui ne lit QUE ce header) recevait `null` → `getCentreForUser(userId, undefined)` retombait sur **le premier centre possédé**.
- Sauvageon (mono-centre) : juste **par accident**. Pôle Montagne (2 centres actifs) et bientôt Louise (2) : **le mauvais centre, silencieusement**.
- Fix à la source = supprimer les helpers d'URL, tout passer par axios. **Zéro ligne touchée dans les guards.**
- ⚠️ **Piste écartée** : un fallback `?centreId=` dans le contrôleur aurait été un patch **et un trou** — `PlanGuard` résout le centre via le header `x-centre-id` UNIQUEMENT → un multi-centre aurait pu exporter un centre en Découverte pendant que le guard validait sur son centre en Pilotage.

### Recette prod (12/07, validée)
62 factures / 62 PDF, ZIP en **~10 s**, index CSV présent, pas de `_PDF_MANQUANTS.txt`. « Trimestre en cours » → 2 factures (le filtre de dates mord, le pré-vol se recharge sans reload). `localStorage['liavo-centre-actif']` = UUID Sauvageon → **l'interceptor pose bien `X-Centre-Id` → fix multi-centre prouvé** (le contre-test réel reste à passer sur un compte à 2 centres : cf. roadmap, condition du 2e centre de Louise).

### Résidus (non bloquants, documentés en dette)
- Pré-vol en échec **avalé silencieusement** (`.catch(() => setPreview(null))`) → carte vide + bouton actif. À corriger au prochain passage sur ce fichier.
- Concurrence `zipFromUrls` = 5 → ~10 s pour 62 PDF. À passer à 10 si un client dépasse ~150 factures.
- Avoirs : **jamais exécutés en prod** (0 en base). Revérifier l'export au premier avoir émis.
- `refreshFacturePdf` régénère le PDF à chaque versement → le PDF téléchargé reflète l'état courant, **pas l'état à l'émission**. Douteux vis-à-vis de l'immuabilité d'une facture. Hors scope, à arbitrer un jour.

### Leçon (2e occurrence en 4 jours)
La roadmap ET ce doc annonçaient `28e364a` « NON POUSSÉ » : `git log origin/main..main` était **vide**, le commit était en prod depuis le 09/07. **Un statut de doc n'est vrai que confronté au repo.** Coût aujourd'hui : 5 min. Le jour où ça portera sur une migration, ce sera plus cher.

---

## SESSION 09/07/2026 — Louise Giard / PULSE SPORTS : bug SIRET, rattrapage SQL, trou inscription ex-nihilo

### Déclencheur
Mail admin « nouveau compte hébergeur — Louise Giard » (`lgiard@pulse-sports-agency.com`, centre « PULSE SPORTS CAMPUS VALLOIRE », VALLOIRE) mais **aucun centre visible** côté admin — seulement des comptes hébergeur orphelins.

### Diagnostic (lu on-code)
- Le mail admin + l'event feed partent APRÈS `user.create` mais AVANT `centre.create` → recevoir le mail ne prouve que l'existence du User, pas du centre.
- **Cause racine — SIRET** : `register-hebergeur.dto.ts` a `adresse/ville/codePostal/capacite` en `@IsOptional()` (mode claim). Un SIRET saisi AVEC espaces (« 813 741 220 00020 » = 17 car.) passe la validation → user committé + mail envoyé, puis `centre.create` throw (colonne `siret` = VarChar(14), « value too long ») → **user orphelin + mail menteur**.

### Fix SIRET — commit `28e364a` (**POUSSÉ — en prod depuis le 09/07** ; statut corrigé le 12/07)
`@Transform` sur le champ `siret` du DTO (strip `[\s.\-]`). `main.ts` a `transform:true` global → `dto.siret` propre partout (mail, centre.create, substring siren). + test spec `register-hebergeur.dto.spec.ts` (4 cas). tsc + build + tests verts (140 passed).

⚠️ **Réserve toujours valable (vérifiée on-code le 12/07)** : le `@Transform` **nettoie** mais **ne valide PAS la longueur**. Un SIRET saisi à 13 ou 15 chiffres sans espaces passe la validation → `centre.create` throw à nouveau sur `VarChar(14)` → **user orphelin + mail menteur, exactement le bug de Louise**. Le fix traite le cas fréquent (espaces), pas la classe de bug. Vraie réparation à la source : `@Length(14, 14)` → erreur 400 propre côté formulaire. **→ 4e cause du bloc 🔴 « flux inscription hébergeur ». Le SIRET n'est PAS réglé.**

### Trou de fond découvert → documenté roadmap (bloc 🔴 URGENT)
Inscription hébergeur ex-nihilo (centre hors catalogue) → centre PENDING **jamais activable**, ni self-service ni admin. 3 causes : **(A)** CTA « déposer justificatif » pointe `/dashboard/hebergeur/documents` (docs génériques) au lieu de `POST /organisations/:id/upload-kbis` ; **(B)** routage front cas 2 invitation → `/auth/register/hebergeur` (PENDING) au lieu de `/centres/register` (ACTIVE direct — code mort côté UI) ; **(C)** `centre.service.register()` sans `motDePasseDefini:true` → reconnexion par mdp cassée. **Chantier « flux inscription hébergeur » à cadrer À FROID. NE PAS patcher à chaud.**

### Rattrapage Louise — SQL prod (COMMIT confirmé)
Le compte `lgiard@` (id `52fa36f1-…`, créé 08:25, orphelin, email vérifié + validé + mdp défini) **n'avait jamais été supprimé** (DELETE du matin non committé — piège récurrent). Complété en une transaction : `UPDATE` user (pose `reset_password_token` + expires 7j) + INSERT organisation + INSERT centre Valloire (statut **ACTIVE**, plan PILOTAGE, abonnement ACTIF, trial 30j) + INSERT membership (PROPRIETAIRE, isPrimary, claim **VALIDE**), tout rattaché au user existant. Doublon `communication@` (orphelin pur) supprimé. **COMMIT confirmé** (piège du `COMMIT` sans `;` → résolu par un `;` seul). Lien reset : `https://liavo.fr/reset-password/b9257f8a-e62f-49d2-8067-cdff77eb9b52` (7j, **testé OK**). Fiche visible au catalogue (statut ACTIVE) mais vide (centre créé minimal) — Louise complètera photo/desc/thématiques/activités via `/dashboard/hebergeur/profil` (formulaire vérifié on-code : expose TOUS les champs, tags inclus).

### Commercial — Louise Giard / PULSE SPORTS AGENCY (historique client)
- **Contact** : Louise Giard · `lgiard@pulse-sports-agency.com` · 06 88 40 09 99.
- **Structure** : PULSE SPORTS AGENCY (SIREN `813741220`). **Centre 1** : PULSE SPORTS CAMPUS VALLOIRE, 162 Route du Praz, 73450 VALLOIRE (Savoie), SIRET `81374122000020`, capacité ~120 (**PROVISOIRE, à confirmer**), accessible PMR. **Centre 2 à venir** : Chambéret (Corrèze) → à créer par Théo en SQL (**NE PAS** l'envoyer sur le parcours d'ajout cassé).
- **Acquisition** : self-signup (2 tentatives ratées à cause du bug SIRET), rattrapée manuellement. Activée 09/07, trial **PILOTAGE 30 j**.
- **1er contact** : appel 09/07 15h-17h. Mail envoyé (lien reset + qualif + mention lancement/retours).
- **Qualif en cours** (posée par mail, à compléter après l'appel) : (1) canal de découverte de LIAVO ? (2) objectif — **catalogue seul** vs **outil de gestion global** (devis/facture/planning/collaboratif/pilotage) ?
- **Statut** : nouveau client en trial, plateforme en lancement, retours attendus. Premier hébergeur passé par le parcours self-signup ex-nihilo (d'où la découverte du trou).

---

## SESSION 08/07/2026 (soir, tard) — Fix page abonnement (PricingTable)

Remonté par Théo sur screenshot `/dashboard/hebergeur/abonnement`. Frontend pur, 1 commit (`PricingTable.tsx` + `abonnement/page.tsx`), vérifié on-MCP, poussé.

- **Libellés neutres (amorce 2.4)** : « Signature électronique directeur » → « en ligne » ; « Espace collaboratif hébergeur + enseignant » → « partagé ».
- **Bouton dérivé du plan courant** : `PricingTable` ne recevait que `currentStatut` (ACTIF/INACTIF), jamais le plan → Essentiel/Complet affichaient « Activer ce plan » alors que le compte est sur Pilotage. Fix source : prop `currentPlan` + rang (helper `renderPaidCta`, supprime 3 boutons dupliqués). Carte = plan courant → « Votre plan actuel » désactivé ; carte < courant → « Nous contacter » (mailto, **jamais** le formulaire IBAN) ; carte > courant ou rang inactif → historique.
- Page passe `currentPlan={abo && !abo.isTrial && abo.actif ? abo.plan : null}` — **jamais pendant l'essai** (ne pas décourager la conversion).
- **Décisions** : 1→B (libellés neutres), 2→A (affichage seul ; pas de flux downgrade auto — un vrai downgrade = chantier backend séparé si un client le demande).
- **Cascades vérifiées on-MCP** : landing publique intacte (aucune prop → rang inactif → CTA historiques), essai (« Activer ce plan » partout), cible Sauvageon (Pilotage « plan actuel », 3 autres « Nous contacter »). tsc+build verts (build OK avec Next 16.2.10).
- **Résidu cosmétique non bloquant** : bouton « Rétrograder » mort (sans onClick) sur la carte Découverte pendant l'essai — pré-existant, hors scope. Micro-fix 2 lignes un jour (le passer « Votre plan actuel » désactivé aussi en essai).

---

## SESSION 08/07/2026 (soir) — Run dette technique §4 (décisions Théo + exécution)

### Constats d'abord : 2 items déjà faits, 1 partiel

- **4.6 escapeHtml** — DÉJÀ FAIT sur le code vivant (`utils/escape-html.ts` consommé par notifications, collaboration, devis, email.service). Statut « EN COURS 03/07 » périmé → acté ✅. Reliquat : branche locale `fix/escape-html-emails` à supprimer.
- **4.10 jspdf** — DÉJÀ ABSENT des deux package.json → acté ✅.
- **4.9 tests financiers** — PARTIEL : SequenceService couvert par la suite invariants de la nuit (13 tests). Reste devis-calculs.ts (frontend sans harness Jest) + formule acompte.

### 3 décisions prises par Théo, exécutées dans la foulée

1. **4.11 npm audit — xlsx : risque ACCEPTÉ** (parsing limité aux fichiers de l'hébergeur authentifié). Exécution : `npm audit fix` (axios & co patchés dans le lock), **next 16.1.6 → 16.2.10** (advisories hautes middleware/cache), et `@types/react-pdf` **supprimé** — dépendance morte (0 import ; types du viewer react-pdf, pas de @react-pdf/renderer) qui portait à elle seule la chaîne pdfjs-dist vulnérable. **13 vulns → 3** ; résiduel : xlsx (acceptée) + 2 postcss vendored DANS next (le « fix » npm = downgrade next@9, non actionnable). tsc+build verts. **Recette post-deploy : garder un œil sur le bump Next.**
2. **4.15 Server Actions au deploy — version NON-destructive** (recadrage Théo : pas de reload auto, IDDJ n'est pas le trigger). `global-error.tsx` détecte l'erreur Server Action périmée (best-effort sur le message) → « Une nouvelle version de LIAVO a été déployée » + bouton Recharger. Autres erreurs : rendu générique inchangé.
3. **4.7 Float→Decimal — audit seul, sans migrer.** `docs/AUDIT_FLOAT_DECIMAL.md` : 5 requêtes de contrôle prod lecture seule (Q1 dérive >2 décimales par colonne, Q2 HT+TVA vs TTC, Q3 lignes vs total, Q4 factures vs devis, Q5 versements vs versé — noms de tables/FK vérifiés contre le schéma) + grille de lecture + rappel du vrai coût (Prisma.Decimal ≠ number côté code, ordre SQL→push le jour J). **PROCHAINE ACTION THÉO : exécuter Q1-Q5 en pgsql-console et coller les résultats** — la décision de migration se prend sur le rapport d'écarts.

### Leçon retenue

Avant d'engager un item de dette listé « à faire », **vérifier le code vivant** : sur 6 items traités ce soir, 2 étaient déjà faits et 1 à moitié — les statuts de la roadmap dérivent si personne ne les confronte au repo.

---

## SESSION 08/07/2026 (suite) — Chantier 10.1 abonnements virement + edge cases + nettoyage

### 10.1 — protection Choucas — LIVRÉ + DÉPLOYÉ (deadline 26/09 neutralisée)

Contexte : Choucas (PILOTAGE ANNUEL payé par bon de commande mairie → mode virement, pas de mandat Mollie) cochait exactement le profil ciblé par le cron d'alertes d'essai (`abonnement_statut ACTIF` + `trial_started_at` non null + `mollie_mandat_id` null) → aurait reçu un faux « ton essai expire » le 26/09 (J-21). Fix en 2 moitiés : le CODE (exclure les virements) + les DONNÉES (marquer Choucas).

- **10.1a** — enum `ModePaiement {MOLLIE, VIREMENT}` + champ `modePaiement` nullable sur `CentreHebergement` (migration additive `20260708_add_mode_paiement`, appliquée par migrate deploy au boot). Cron : exclusion **null-safe** des VIREMENT dans les 2 méthodes trial (`OR modePaiement null OR not VIREMENT` — piège du `not:'VIREMENT'` seul qui exclurait les NULL, donc tous les vrais essais, évité). **Choucas marqué `mode_paiement='VIREMENT'` en prod** (seul centre VIREMENT en base).
- **10.1b-1** — `factureLiavo.emettre()` : échéance dynamique (`molliePaymentId ? now : now+30j`) + mention (SEPA acquittée vs virement 30j). `genererDevisLiavo` déjà correct, intact.
- **10.1b-2+3 backend** — `facturerCentre` prolonge depuis la fin de période actuelle si future (renouvellement, sinon repart d'aujourd'hui) + pose `modePaiement VIREMENT` (chemin manuel = toujours virement) ; `getAbonnements` expose `modePaiement`.
- **10.1b-3 frontend** — colonne « Paiement » dans l'admin abonnements (badge dérivé `mollieMandatId ? Mollie : modePaiement===VIREMENT ? Virement : —`).
- **10.1b-4** — `envoyerRelanceVirement()` : relance **ADMIN** J-30 pour les centres VIREMENT (4ᵉ étape du cron, debounce 25j, email `ADMIN_ALERT_EMAIL ?? contact@liavo.fr`). Non-interférence vérifiée (VIREMENT exclusif : exclu des alertes essai + jamais mandat Mollie). Choucas → relance admin ~17/09.
- **10.1b-5** — self-service : `POST /abonnements/demander-extension` (+14j depuis max(now, fin actuelle), garde essai-only, anti-abus par seuil `trialStart+40j` SANS migration, repassage ACTIF, notif admin) + bouton « Demander 14 jours de plus » dans les 2 bandeaux essai (en cours + expiré).

**Tout 10.1 poussé et déployé.** Vérifs on-code faites à chaque volet (facturerCentre, getAbonnements, cron, endpoint+méthode, bouton frontend).

### Edge cases justificatif — 2/3 DÉJÀ CORRECTS, 1 fix

Lus sur le code vivant (les vieilles notes du 07/07 étaient précautionneuses, pas factuelles) :
- **(a) claim sans fichier** — DÉJÀ CORRECT. `getOnboardingStatus` dérive `justificatif='ABSENT'` pour `EN_ATTENTE_DOCUMENT` (ex-nihilo avant upload) et `NON_APPLICABLE` (centre ajouté) → le front affiche « Déposer un justificatif », pas un faux « en cours d'examen ». Aucun fix.
- **(b) logoUrl null PDF devis** — DÉJÀ CORRECT. Ternaire de fallback dans `DevisPDF.tsx` (`logoUrl ? logo+info : info`). Aucun fix.
- **(c) pied de checklist** — **FIXÉ**. `OnboardingChecklist` dérive désormais le pied « en cours de validation » ET le séparateur « Aller plus loin » d'`envoisBloques` (au lieu de `centreValide`) → le pied s'affiche aussi pour une revendication de centre catalogue (centre ACTIVE + claim pending), là où avant il ne sortait que pour un centre PENDING. Checklist + encart pré-envoi (6b-2) + gate backend racontent maintenant la même histoire depuis la même source de vérité. Fichier unique, invariant « un seul séparateur » préservé, zéro régression ex-nihilo.

### Nettoyage compte de test — FAIT

`trochenrc@gmail.com` (user `fecd14d0-07ae-4f1d-a87d-81b752111758`, centre `7882bda3-8086-4c09-b592-61e173a3e51f` « test », org `0e0a0350-7f16-46cd-8515-2489fb137fd2`) **neutralisé en prod** (transaction BEGIN/COMMIT, 2× UPDATE 1) : `statut SUSPENDED` + `abonnement_statut INACTIF` + `compte_valide false`. Contrôle post-op : `f / SUSPENDED / INACTIF`. Réversible, pas de DELETE en cascade. → login bloqué, invisible au catalogue, **jamais ciblé par le cron**. (Résout le « compte de test à neutraliser » du bloc phase 2.)

### Workflow — retour direct sur main

Des branches par mini-correctif avaient été introduites en début de session (détour). Théo a recadré : **retour au mode direct sur main**. Le vrai garde-fou reste **CC ne pousse jamais → Claude vérifie on-code → Théo pushe**, pas les branches.

### État final prod

10.1 complet · (c) déployé · compte de test neutralisé · **deadline 26/09 MORTE**.

---

## SESSION 08/07/2026 — Onboarding phase 2 (prompt 6 / roadmap 10.11) + 3 fixes du smoke-test

### Déployé en prod (branche `feat/onboarding-phase2` mergée main + 3 branches de fix)

**Phase 2 onboarding (prompt 6 / roadmap 10.11)** — 4 volets livrés, FeatureHint ×4 différé :
- **6a backend** — champ `envoisBloques` exposé par `GET /centres/onboarding-status` (miroir exact de `assertEnvoiExterneAutorise` moins l'exception self ; réutilise centre + membership déjà chargés, zéro requête ajoutée). Source unique de vérité pour l'encart + le pied de checklist.
- **6b-1 frontend** — modale de choix test/réel intégrée à `CreateSejourModal` (option C : prop `proposeTest`, écran CHOIX/FORMULAIRE, `choisirTest` pré-remplit client=soi via `useAuth`, titre « TEST — »). Câblée sur le planning (`proposeTest = !onboardingComplete && isOwned`).
- **6b-2 frontend** — encart ambre pré-envoi dans `TabDevisFacturation` (conditionné `envoisBloques`, fetch onboarding-status au montage) + fix du message : le catch local du handler d'envoi (`catch {}` générique) passe désormais par `extractApiError` (parse `CENTRE_EN_VALIDATION|`).
- **6b-4 frontend** — section « Aller plus loin » dans la checklist (3 liens passifs : inviter-enseignant / equipe / pilotage ; séparateur conditionnel pour ne pas doubler celui de la note de validation).
- **6b-3 (FeatureHint ×4) — DIFFÉRÉ** (backlog) : composant seul = code mort, 4 ancrages diffus dans des fichiers 119 KB → mauvais ratio effort/valeur. À poser en amortissant quand on retouche ces fichiers.

**3 bugs attrapés au smoke-test (compte hébergeur ex-nihilo frais) et corrigés — branches dédiées mergées :**
1. **Permissions PENDING (la grosse prise)** — `getUserCentrePermissions` (`permission.helper.ts`) refusait les centres non-ACTIVE **avant** le check propriétaire (`statut !== 'ACTIVE' → null`) → proprio d'un PENDING = 403 sur `/mes-permissions` **et** toutes les routes `@RequirePermission` → sidebar amputée pour **tout nouvel hébergeur ex-nihilo**. Fix = alignement sur le modèle SUSPENDED-only (`statut === 'SUSPENDED' → null`), cohérent avec `getCentreForUser`. + spec `permission.helper.spec.ts` (6 cas). Branche `fix/permissions-centre-pending`. Le claim d'un centre catalogue (ACTIVE + `userId` posé immédiatement par `claimFromCatalogue`) n'était PAS touché → parcours principal sain.
2. **Lien devis en cul-de-sac** — l'étape 5 de la checklist pointait vers `/dashboard/hebergeur/devis` (page de suivi, sans bouton créer). Fix = `onboarding-status` renvoie `sejour.id` (le count devient un findFirst orderBy createdAt desc), l'étape 5 pointe vers `/devis/nouveau?sejourDirectId=<id>` (fallback `/planning`). Branche `fix/onboarding-devis-link`.
3. **Double bandeau de validation** — pour un ex-nihilo, le bandeau claim `EN_ATTENTE_DOCUMENT` ET le bandeau centre PENDING s'affichaient (même sens, même CTA `/documents`). Fix = masquer le bandeau claim quand un centre PENDING affiche déjà le sien (`&& centresPending.length === 0`). Branche `fix/onboarding-double-banner`.

### Recette prod — 3/3 validée en vrai
Sur compte ex-nihilo gaté : welcome modal ✓, checklist ✓, « Aller plus loin » ✓, modale test/réel + pré-remplissage client=soi ✓, **sidebar complète** (preuve du fix permissions en prod) ✓, **encart pré-envoi** ✓, envoi tiers = message revendication ✓, envoi à soi = passe ✓. Le bout sécurité (l'encart) enfin recetté par un œil humain — il avait été esquivé à chaque tour, et chaque esquive a révélé un des 3 bugs ci-dessus.

### Correction de cadrage — IDDJ vs LMDJ
Le label « avant démarchage IDDJ » (roadmap §10.2/10.10) est **périmé** : IDDJ est **attentiste/prospectif** (Robin Baladi, CA à consulter), pas un partenaire actif. Réseau actif = **LMDJ** (Théo admin depuis AG 01/06). Le vrai cadrage des chantiers restants n'est pas « pour IDDJ » mais « rendre le produit solide avant d'ouvrir à de vrais partenaires ».

### Points ouverts / suite
- **Compte de test ex-nihilo conservé** comme fixture pour les cas non testés du tunnel justificatif (claim sans fichier, `logoUrl` null, incohérence pied checklist). À neutraliser une seule fois à la fin, comme ZZTEST.
- **Prochain backend : « 4bis »** (sous-item 10.2) — preview facture non-émise (`apercu()`) + `POST /abonnements/demander-extension` (+14j → notif admin).
- **10.1 (gestion admin abonnements) — DEADLINE DURE 26/09**, date de démarrage toujours à fixer.
- **Nits cohérence** : mojibake « Défaut » dans un commentaire de `CreateSejourModal` (cosmétique) ; `inviterOrganisateurDirect` (`InviteOrganisateurCard`) a aussi un catch générique sur action gatée → à router par `extractApiError` un jour ; unifier la liste des états claim bloquants (dupliquée gate + flag `envoisBloques`).

---

## SESSION 07/07/2026 (nuit) — Frontend déployé, test claim ZZTEST, FAILLE + HOTFIX

### Déployé en prod
- `feat/onboarding-frontend` mergée (fast-forward defcf3f, 599 insertions) : OnboardingChecklist (302 l.), WelcomeModal (97 l.), badge "En validation" (sidebar + CentreSelector), écran succès register corrigé, parsing `CENTRE_EN_VALIDATION` dans extractApiError (strictement additif, vérifié), export mort activerTrial supprimé (aucun appelant — les trials historiques étaient 100% SQL).
- `fix/gate-claim-validation` (hotfix, 2 commits) : merge en cours au moment de l'écriture — **re-test ZZTEST à confirmer** (envoi tiers doit être bloqué).

### Test ZZTEST (centre jetable cloné en SQL, claim réel par trochenrc@gmail.com)
Validé en réel : recherche claim ✓, claim avec justificatif ✓, connexion immédiate ✓, welcome modal ✓, checklist 0/5→1/5 avec dérivation temps réel ✓, bandeau claim "Validation en cours" ✓ (le consommateur de getMonClaimStatut existe), badge sidebar ✓, **trial 30j auto au 1er login ✓**, notif admin trial délivrée (Brevo 21:20) ✓, séjour+devis créés ✓, envoi devis à soi-même ✓ (DEV-2026-0001), célébration confetti + disparition au F5 validées plus tôt sur Sauvageon ✓.

### ⚠️ FAILLE découverte (et pourquoi le contre-test est non négociable)
Envoi du devis DEV-2026-0002 vers test@test.com : **PARTI** (preuve Brevo 21:31, soft bounce). Cause : les gates bloquaient `statut !== ACTIVE`, or les 135 centres catalogue sont ACTIVE — le chemin CLAIM donnait accès complet + envois externes AVANT validation admin (la revendication vit sur le Membership, pas sur le centre). Combiné à la cécité email admin (voir plus bas) : fenêtre de phishing réelle sur le funnel de démarchage.
**Hotfix (fix/gate-claim-validation)** : assertEnvoiExterneAutorise devient async, 3ᵉ fenêtre — centre ACTIVE → lecture Membership du propriétaire (userId × organisationId) ; EN_ATTENTE_DOCUMENT/EN_ATTENTE_VALIDATION/**REFUSE** → 403 message "revendication". VALIDE/NON_APPLICABLE/absent/legacy sans org → autorisé. Self-exception évaluée en premier (parcours test préservé). 11 appelants en await inconditionnel. Relu ligne à ligne, GO donné.

### Diagnostic cécité email admin
La notif trial était **délivrée en temps réel** (Brevo "Delivered" 21:20 vers contact@liavo.fr). Le décalage "plusieurs heures" habituel = relève de boîte (très probablement Gmail POP3 sur boîte OVH, intervalle long). Fix durable : redirection MX / IMAP — roadmap 10.10. Radar de secours en attendant : /dashboard/admin/claims à consulter chaque matin.

### Décisions produit prises ce soir
- Parcours test : **modale de choix** au clic "Créer votre premier séjour" (tant que étape 5 non faite) — "Séjour test (recommandé)" pré-rempli client=soi-même + titre "TEST — …" vs "Vrai séjour client" vierge. Jamais de contrainte (un 1er séjour peut être réel). Pas de flag en base : le titre TEST + nettoyage guidé = le marquage.
- Encart proactif au-dessus du bouton Envoyer tant que non validé (condition = celle du hotfix : claim non validé OU centre PENDING).
- Découverte des features avancées (Pilotage, facturation, convention, invitation orga, inscriptions) : **PAS d'extension de la checklist** (activation = 5 étapes, point final). Pattern retenu : composant réutilisable `FeatureHint` (bandeau dismissible, clé localStorage par hint×centre) aux 4 moments — devis signé→convention+pipeline facturation (la Section B du doc UX est déjà le mécanisme), séjour DIRECT→inviter (CTA 🔒 existants à enrichir), 1er COLLAB→fiche d'inscription, 1er versement→Pilotage. + section "Aller plus loin" (3 liens passifs) dans la checklist. Tour guidé multi-onglets : écarté.

### Artefacts de test à nettoyer (demain, APRÈS re-test hotfix)
Centre ZZTEST id `20d2cd18-8b17-4486-9b75-f160c583bd42` (email corrigé en trochenrc@gmail.com — l'email Métralière cloné était un artefact du INSERT). User trochenrc@gmail.com + membership + éventuelle organisation de claim. Séjours "t"/"test" + devis DEV-2026-0001/0002 + client CRM auto-créé.
Procédure : (1) via l'UI — annuler les 2 devis, supprimer les séjours (softDelete), supprimer la fiche client ; (2) SQL — DELETE user + membership + centre ZZTEST (dérouler avec les erreurs FK réelles, ne pas deviner les cascades). Les numéros DEV-2026-0001/0002 sont consommés sur la séquence ZZTEST : sans conséquence, le centre disparaît avec.

### Points ouverts / à vérifier
- **Re-test hotfix** : envoi ZZTEST→test@test.com doit échouer (message revendication) + zéro ligne Brevo. Résultat à consigner.
- **Cron J1** : 08/07 après 8h — `scalingo logs | findstr cronQuotidien` (3 lignes attendues).
- **Cas non testé** : claim SANS fichier joint — vérifier que l'étape 3 affiche ABSENT+action et pas un faux "en cours d'examen" (à couvrir au test du 4ter).
- **Non testé** : rendu PDF devis quand logoUrl null (fallback ? vide ?) — 1 ligne de vérif au 4ter.
- **Audit refuserClaim** : que devient centre.userId après refus ? (les envois sont déjà bloqués par REFUSE, mais l'accès au centre reste — à auditer).
- **Incohérence cosmétique** : pied de checklist "centre en cours de validation" conditionné à centreValide (statut) — ne s'affiche pas pour un claim ACTIVE non validé alors que les envois sont gatés. À dériver du claim aussi (4ter).
- Ligne roadmap "Grille tarifaire 0/39/59/79€" (30/06) périmée vs page publique 29/49/69 confirmée par Théo — à corriger.

---

## SESSION 07/07/2026 (soir) — Onboarding backend : register immédiat, trial auto, gates anti-phishing, cron

### Livré et déployé (branche `feat/onboarding-register-trial`, 26 commits, mergée main)

- **Register hébergeur** : `compteValide=true` dès l'inscription (les deux modes). `compteValide` devient un kill switch admin vérifié à chaque requête (JWT strategy + refresh). Email `sendHebergeurAccountPending` réécrit. Bloc trial COMPLET + `setTimeout` J+25 supprimé (jamais fonctionnel — dyno restart).
- **Trial 30j Pilotage automatique à la première connexion** : hook privé dans `login()`, gardes `trialStartedAt null` + `mollieMandatId null` + **`abonnementStatut INACTIF`** (protège Sauvageon/Choucas/Alticlub/Pôle Montagne, vérifié en prod). Notif admin par centre.
- **Centres PENDING opérables** (`centre.helper.ts`) : seul SUSPENDED bloque (404 partout, propriétaire compris). Tiers sondant un PENDING → 404. `getCentresForUser` + `getCentreIdsForUser` alignés `not: SUSPENDED` (le fix `getCentreIdsForUser` a évité un planning vide pour les nouveaux — appelants : getMesSejoursConvention/Planning, getMesNonLus).
- **Gates anti-phishing** `assertEnvoiExterneAutorise` (centre.helper.ts) : tout envoi hébergeur→tiers bloqué tant que PENDING, exception destinataire = email du compte (parcours test). 10 sites gatés : envoyerDevisDirect, convention, notifierEnseignant, brochure, invitation-collab, inviter collaborateur, 3 émissions facture (post-persistance, email seul bloqué), envoyerFactureParEmail, inviterOrganisateur, devis create/update COLLAB. Exclusion documentée : 5 chemins collaboration.service (destinataire fixe, état inatteignable en PENDING). Code erreur : `CENTRE_EN_VALIDATION|message` (parsing frontend à faire).
- **Cron branché** : `@nestjs/schedule@6.1.3`, `cronQuotidien()` 8h Europe/Paris, garde `ENABLE_CRON==='true'` (posée sur Scalingo 07/07 + restart). 3 étapes : alertes J-21/14/7/3/1 (recentrées essais uniquement : filtres trial ajoutés), essais expirés, renouvellement annuel J-30 (mandat Mollie requis — zéro cible actuelle). Vérif J1 : 10.8 roadmap.
- **Justificatif ex-nihilo** : membership créé `EN_ATTENTE_DOCUMENT` (garde anti-collision dédup : org déjà détenue par un autre → NON_APPLICABLE). Tunnel claim existant réutilisé tel quel (admin/claims, uploadKbis élargi PDF/JPG/PNG, validerClaim). `getMonClaimStatut` renvoie `organisationId`.
- **`Devis.dateEnvoi`** : migration `20260707_add_date_envoi_devis` (ALTER + backfill created_at). Posé post-succès email dans envoyerDevisDirect (déviation CC approuvée : pas de faux "envoyé") et dans le create COLLAB (envoi immédiat via sendDevisRecu).
- **`GET /centres/onboarding-status`** : dérivation 5 étapes (profil, catalogue, conformité justificatif+iban, séjour, devis avec dateEnvoi), `$transaction`, + `centreValide`. Ligne 111 du controller, avant tout paramétré — pas d'avalement de route (vérifié findstr).

### Post-déploiement fait
- `ENABLE_CRON=true` + restart (timeout CLI au restart — état à confirmer via logs cron 08/07 matin, roadmap 10.8).
- SQL memberships→VALIDE : les 5 clients prod à VALIDE (vérifié par SELECT).
- Recette régression Sauvageon : login sans écrasement de plan ✓, planning/séjours/devis visibles ✓, catalogue public ✓. Envoi devis réel non testé (réserve consignée).

### En attente
- **Test flow nouveau compte** : 08/07 (SIRET Roche-Loison ou local). Compte à neutraliser ensuite (roadmap 10.6).
- **Stash `extraction PlanningPDF en cours`** à dépiler + build frontend (roadmap 10.3).
- **Prompt 4 frontend** (checklist gamifiée sobre + welcome modal + fixes 4a) : en cours de rédaction.
- Rapports CC : `docs/cc-reports/RAPPORT_PROMPT_2TER.md`, `RAPPORT_PROMPT_3.md`.
- Discordance relevée : ligne roadmap "Grille tarifaire 0/39/59/79€" (30/06) contredit la page publique 29/49/69 confirmée par Théo le 07/07 — à corriger dans la table des décisions.

---

## SESSION 07/07/2026 — Refonte planning-groupes many-to-many + fix Prisma migrations + refactor PDF

### Contexte

Chantier initial : permettre à Anne (Choucas) et Yves (Pôle Montagne) de construire leurs plannings 6 mois avant les inscriptions élèves pour validation prestataires. Diagnostic exhaustif du code → la génération auto marchait déjà pour les 3 cas (DIRECT pur, DIRECT→COLLAB basculé, COLLAB natif via appel d'offre). Seul trou identifié : impossible de rattacher plusieurs groupes à une même activité manuelle.

Décision produit : refonte many-to-many complète (Option A) et non un patch ni un array Postgres — fix à la source, sémantique pure, pas de dette technique.

### Livré (5 commits + migration SQL prod)

**Commit 9803ba9 — Backend refonte m2m**
- `schema.prisma` : nouveau model `PlanningActiviteGroupe` (table de jointure, unique composite, onDelete Cascade des deux côtés). Suppression de `PlanningActivite.groupeId` + relation `groupe`. Ajout `groupes PlanningActiviteGroupe[]` sur PlanningActivite et `planningActivites PlanningActiviteGroupe[]` sur GroupeSejour.
- `backend/prisma/manual-migrations/planning-groupes-m2m.sql` : migration SQL transactionnelle (CREATE TABLE + backfill des `groupeId` existants + DROP COLUMN + index). Déplacée depuis `migrations/manual/` par le commit 34b302a.
- `create-planning.dto.ts` : ajout `@IsArray() @IsOptional() @IsUUID('4', { each: true }) groupeIds?: string[]`.
- `collaboration.service.ts` :
  - `getPlanning` inclut les groupes via nested include + mapping pour aplatir en `groupes: [{id, nom, couleur}]`.
  - `createPlanning` accepte `groupeIds`, crée les relations via nested Prisma.
  - `deletePlanning` : cascade automatique via onDelete Cascade.
  - `genererPlanningIA` REFONDU : au lieu de créer N × PlanningActivite (une par groupe du cluster), crée 1 seule activité par (cluster × activité) attachée à tous les groupes du cluster. Titre simplifié (plus de suffixe " — G1"). Impact : environ 4× moins d'entrées en base pour un même planning.

**Commit 8728934 — Frontend UI multi-groupes**
- `collaboration.ts` : type `PlanningActivite.groupeNom` supprimé, remplacé par `groupes: Array<{id, nom, couleur}>`. Signature `createPlanning` accepte `groupeIds?: string[]`.
- `TabPlanning.tsx` : ajout d'un multi-select "Groupes concernés" dans la modale (pastilles rondes colorées, toggle sélection, mutuellement exclusif avec `estCollective`). Les 4 chemins de drag (catalogue, parking, calendrier existant, resize) préservent les groupeIds. Rendu `DraggableActivity` affiche les groupes via `labelGroupes` (ex: "G1, G3" ou "Tous les groupes").
- `PlanningPDF.tsx` : type `groupes` remplace `groupeNom`. Rendu bloc reconstruit le label depuis `groupes[]`.

**Commit 34b302a — Fix Prisma migrations manual/**
Root cause : Prisma scanne tout le dossier `prisma/migrations/` et attend un `migration.sql` dans chaque sous-dossier. Le dossier `manual/` créé pour la migration SQL manuelle a été détecté comme la 115ᵉ migration mais son fichier s'appelait `planning-groupes-m2m.sql` (pas `migration.sql`) → erreur P3015 au boot Scalingo → `migrate deploy` planté → app HS pendant ~10 min.

Fix : `git mv backend/prisma/migrations/manual backend/prisma/manual-migrations` — sortie du scan Prisma. Le dossier reste dans le repo pour traçabilité mais n'est plus interprété comme migration.

**Commit d683820 — Refactor PDF extraction (rétroactif chantier 05/07)**
Extraction en 2 fichiers (Button + PDF component) avec dynamic import de `@react-pdf/renderer` sur BudgetPDFButton, PreparationTamPDFButton, ProjetPedagogiquePDFButton (calqué sur DevisPDFButton et PlanningPDFButton). 6 fichiers, 717 insertions, 699 suppressions.

**Commit fe7db8a — Docs**
`docs/audit-planning-cascade.md` (audit CC Phase 1) + `docs/ROADMAP_ETE_2026.md` (mise à jour).

### Migration prod

SQL exécuté avant le push via `scalingo --app liavo-backend --region osc-fr1 pgsql-console` en un seul bloc BEGIN/COMMIT :
```sql
CREATE TABLE planning_activite_groupes (...);
CREATE INDEX idx_pag_groupe ...;
INSERT INTO planning_activite_groupes ... FROM planning_activites WHERE groupe_id IS NOT NULL;
ALTER TABLE planning_activites DROP COLUMN groupe_id;
```
Vérification post-migration : `COUNT(*) FROM planning_activite_groupes = 0` (aucune activité IA n'avait de groupeId en prod), colonne `groupe_id` bien supprimée. Backend redémarré, `Backend running on port 23364`, toutes les routes mappées.

### Audit exhaustif Phase 1 (post-refonte)

CC a scanné tout le repo pour trouver les cascades. Résultat : **0 occurrence à fixer**. Les 8 endroits qui incluent `planningActivites` via Prisma le font en bare include, et le frontend n'accède qu'aux champs scalaires (titre, heureDebut, heureFin, responsable, couleur). Aucun code ne lit l'ancien `groupeId` ou `groupeNom`.

Deux points de dette identifiés dans l'audit (docs/audit-planning-cascade.md section C) :
- **C.1** : titres "Escalade — G1" en base — **non-problème confirmé** (COUNT prod = 0 activité avec ce suffixe sur 25 activités totales).
- **C.2** : `regrouperParCreneau` dans journal public parse les suffixes de titre. Marche pour anciens plannings (aucun en prod), pas pour nouveaux (pas de suffixe). Dégradation cosmétique du journal public. Reporté en dette technique.

### Leçons retenues

1. **Distinction 3 cas de création de séjour** : DIRECT pur (hébergeur seul, createurId=null), DIRECT→COLLAB (invitation acceptée, mute modeGestion + crée demande pont avec `nombreEleves: placesTotales`), COLLAB natif (appel d'offre, `demande.nombreEleves` renseigné). `proposerGroupes` fait `demande?.nombreEleves ?? sejour.placesTotales` — couvre les 3 cas.
2. **`prisma migrate deploy` scanne TOUS les sous-dossiers** de `prisma/migrations/`. Ne jamais créer de sous-dossier dans `migrations/` pour autre chose que des migrations Prisma standards (nommage `YYYYMMDDHHMMSS_nom` + fichier `migration.sql`). Pour les migrations SQL manuelles à référencer dans le repo : `prisma/manual-migrations/` ou `docs/migrations/`, jamais dans `prisma/migrations/`.
3. **Backfill à 0 = feature jamais utilisée en prod jusqu'ici**. La table `planning_activite_groupes` est vide après migration parce qu'aucune activité IA n'avait été générée en prod avec l'ancien schéma. Ni Anne, ni Yves, ni personne n'avait vraiment testé la génération planning en production — même si l'UI existait depuis un moment.
4. **Fix à la source vs patch** : Théo a rejeté catégoriquement Option B (activités dupliquées) et Option C (array Postgres) au profit d'une refonte many-to-many propre malgré le coût (2h vs 30min). Trade-off assumé : pas de dette. L'audit a confirmé qu'il n'y avait pas de cascade cachée.
5. **Backend et frontend Scalingo redéploient indépendamment**. Fenêtre de risque entre push et fin des 2 rebuilds : ~5-10 min pendant lesquelles les deux versions peuvent coexister. Ici : le push a précédé le SQL, donc le nouveau backend a démarré sur une base sans la table de jointure → crash P3015. À l'avenir : ordre strict SQL prod → push code, jamais l'inverse.

### Status test empirique m2m
**Non validé en prod** au moment de la clôture de session. Backend UP (Nest démarré 11:48), frontend UP (Ready 11:50), audit code clean. Test manuel utilisateur reporté à Théo (créer une activité manuelle avec 2 groupes sur un séjour test, vérifier badges affichés).

---

## SESSION 05/07/2026 — Colonne PU TTC devis/facture + fix build local turbopack

### Feature Alticlub — livrée

Alticlub voulait des lignes "option" affichant HT/TTC sans impact sur le total. Workaround qty=0 conservé (pas de nouveau champ, pas de migration) mais colonne PU TTC ajoutée aux 3 rendus (DevisPDF, page publique signer, FacturePDF).

**Fichiers modifiés** (commit 9b412bb + 8504438) :
- `frontend/src/components/pdf/DevisPDF.tsx` — 7 colonnes : Désignation | Qté | PU TTC | TVA % | PU HT | Total HT | Total TTC (largeurs 28/8/12/8/12/16/16 = 100%)
- `frontend/app/devis/signer/[token]/page.tsx` — mêmes 7 colonnes avec responsive `hidden sm:table-cell` sur TVA%, PU HT, Total HT
- `backend/src/facture/pdf/FacturePDF.tsx` — mêmes 7 colonnes (uniformisation devis/facture pour cohérence comptable)

Helper `puTTC = (puHT, tva) => Math.round(puHT * (1 + tva/100) * 100) / 100` répété à l'identique dans les 3 fichiers. PU TTC dérivé du HT stocké, jamais persisté.

### Fix build local turbopack — livré (commit 8a60079)

Root cause : `@react-pdf/pdfkit 4.1.0` (lib/pdfkit.browser.js) importe `pako/lib/zlib/*.js` **sans déclarer pako comme dépendance**. Ça marchait par hoisting du pako@1.0.11 nested sous `browserify-zlib`. Turbopack strict sur la résolution → bloqué. Un premier `npm install pako` (v3) avait aggravé (exports field v3 bloque les subpaths).

Fix : `npm install pako@1.0.11 --save-exact` (dépendance directe explicite) + suppression de l'override `browserify-zlib.pako` inutile. Aucun fichier source .ts/.tsx touché. `tsc --noEmit` + `npm run build` verts après fix.

### Grille tarifaire dégressive Yves — reporté

Yves (Pôle Montagne) demande une grille tarifaire dégressive multi-centre (Les Gets, Florimont, Bellevaux) avec paliers d'effectif. Diagnostic : besoin différent de la feature Alticlub (document pricing en amont du devis, pas ligne dans un devis existant). Options évaluées : PJ PDF externe / section grille structurée sur devis (JSON) / paliers sur ProduitCatalogue (auto-calcul) / textarea `notesTarifaires`. Théo a acté "on voit plus tard pour Yves". Ajouté au backlog §6 de la roadmap. Requalifier SI d'autres adhérents LMDJ expriment le besoin.

### Leçons retenues

1. **Dépendance fantôme** : quand un package importe un sous-module via un path direct (`pako/lib/zlib/*.js`) sans le déclarer dans ses deps, le résolveur strict (turbopack) casse. Le résolveur permissif (webpack legacy) hoiste. Solution : épingler la dépendance directement dans le package.json de l'app avec la version exacte.
2. **Workaround acceptable si le fix source est disproportionné**. Alticlub a lu son besoin comme "afficher PU TTC" — pas "typer les lignes d'option en base". Théo a tranché le workaround qty=0 + colonne PU TTC pour ne pas migrer un champ nouveau uniquement pour un client.
3. **Grille tarifaire ≠ ligne d'option** : deux besoins visuellement proches mais sémantiquement distincts. Ne pas mutualiser sans avoir 3 clients qui demandent la même chose.

---

## SESSION 03/07/2026 — Responsive mobile (Fable 5 overnight + fixes manuels)

### Contexte

LIAVO n'était pas utilisable sur mobile — la sidebar hébergeur (220px fixe) écrasait le contenu sur petit écran. Chantier lancé en run overnight Fable 5 sur branche `responsive-mobile`, puis 2 fixes manuels, puis merge fast-forward dans main et déploiement prod.

### Run overnight Fable 5 (6 commits, 16 fichiers, +690/−13)

- **Phase 1** : HebergeurSidebar convertie en drawer overlay mobile (< md). Fixed + translate-x, backdrop cliquable, fermeture auto au clic lien, top-bar mobile hamburger+logo dans HebergeurShell. Desktop (>= md) strictement inchangé (sticky 220px). Débloque les 33 pages hébergeur d'un coup.
- **Phase 2** : Dashboard hébergeur — déjà responsive, rien touché.
- **Phase 3** : Planning hébergeur — vue mois par défaut sur mobile (matchMedia, `?view=` prime toujours), toolbar empilée, vues jour/semaine en scroll horizontal (min-w-[640px]).
- **Phase 4** : Sweep ~60 pages. 3 casses corrigées : onglets séjour collaboratif clippés (overflow-x-auto ajouté), KPI pilotage écrasés (grid-cols-2), libellés étapes appel-offres débordants.
- Auth locale impossible (mot de passe Sauvageon obsolète dans les docs, register hébergeur = compteValide=false). Vérification via auth simulée (puppeteer + localStorage mocké + interception API, zéro requête prod).

### Fix manuel 1 — TabPlanning séjour (commit 834cc93)

Le panneau catalogue/parking (`w-64 shrink-0`) écrasait la grille planning sur mobile. Fix : `hidden md:block` — panneau masqué < md, grille pleine largeur. Desktop inchangé. @dnd-kit refs subsistent (display:none, pas unmount).

### Fix manuel 2 — Landing nav mobile (commit ad6cd41, appliqué via MCP filesystem)

Le bouton « Se connecter » (`.btn-ghost`) était masqué par une media query CSS (max-width:880px). Fix : suppression du display:none sur `.btn-ghost`, compactage des CTA nav (gap 6px, padding réduit, flèche masquée). Les deux boutons tiennent sur mobile. Bug pré-existant (landing.css du 07/05), pas une régression Fable 5.

### Merge et déploiement

- SHA main avant merge (rollback) : `896ff42` — tag local `pre-responsive-2026-07-03`
- SHA après merge : `ad6cd41` (fast-forward propre, aucun conflit)
- Gates : `tsc --noEmit` ✅ + `npm run build` ✅
- Déployé en prod via push origin main

### Vérification

- Vérifié sur vrai téléphone (Pixel, tunnel Cloudflare HTTPS → next dev local) avec compte Sauvageon (données réelles) : drawer, dashboard, planning hébergeur global, planning séjour, liste séjours. Tout OK.
- Pages admin/réseau/organisateur/signataire : touchées par le sweep mais non vérifiées avec données réelles. Risque faible (quasi-vide, pas de client payant sur ces rôles).
- Risque résiduel : `overflow-hidden` du shell peut clipper des éléments larges data-driven non testés en empty-state.

### Leçons retenues

1. **Fable 5 overnight pour du responsive** : résultat à 80-90%, les 2 fixes manuels étaient des oublis ciblés (panneau latéral, CSS custom landing). Le chrome (drawer) était impeccable du premier coup.
2. **Auth locale impossible en HTTP simple** quand les cookies sont Secure+httpOnly — besoin d'un tunnel HTTPS (Cloudflare) pour tester sur mobile. Le login retourne les tokens dans le body JSON ET pose des cookies httpOnly ; le frontend s'appuie sur les cookies, pas le body.
3. **landing.css est du CSS custom hors Tailwind**, non scopé par les breakpoints Tailwind. Les runs Fable 5 qui ciblent les pages Tailwind ne le voient pas.
4. **RESPONSIVE_TODO.md et scripts puppeteer** (shots.mjs, check-overflow.mjs, mock.mjs, debug-login.mjs) créés par Fable 5 — utiles pour la vérification, réutilisables pour de futurs chantiers responsive.

---

## SESSION 02-03/07/2026 nuit — Refactoring Fable 5 (dette technique 4.1-4.3)

### Contexte

ClaudeCode configuré avec Fable 5 pour 3 runs de refactoring autonomes sur le repo. Objectif : solder les 3 chantiers de dette technique (ROADMAP 4.1, 4.2, 4.3) en une nuit, sans toucher à la logique métier ni au backend.

### Run 1 — Modules devis partagés (branche feat/fable5-test-nuit, LIVRÉ)

6 commits. Extraction logique dupliquée entre 3 fichiers frontend de devis (nouveau 41KB + modifier 37KB + TabDevisFacturation 121KB) → 3 modules partagés :
- `frontend/src/lib/devis-calculs.ts` (round2, resolvePrixCatalogueTTC, mapLignesForApi, formatMontant)
- `frontend/src/hooks/useDevisLignes.ts` (hook state lignes + handlers + calculs)
- `frontend/src/components/DevisEditor.tsx` (JSX partagé grille/slider/totaux)

Bilan : 6 fichiers touchés, 949 insertions, 982 suppressions, delta net -33 lignes.

### Run 2 — Découpage page séjour (branche feat/fable5-test-nuit, LIVRÉ)

10 commits. `sejour/[id]/page.tsx` passé de 194KB (3681 lignes) à 505 lignes puis 20KB après Run 3 (-86%). 9 composants extraits dans `_components/` : TabMessages, TabPlanning (avec DnD @dnd-kit), TabGroupes, TabDocuments, TabBudget, TabProjetPedagogique, TabJournal, TabParticipantsCollab, InviteOrganisateurCard.

### Run 3 — DashboardShell unification (branche feat/dashboard-shell-unification, LIVRÉ)

11 commits. Centralisation du chrome (sidebar hébergeur OU topbar) dans `dashboard/layout.tsx`.

**Fichiers créés** :
- `dashboard/_components/HebergeurShell.tsx` — extrait de hebergeur/layout.tsx (sidebar + useHebergeurCounts + usePermissions + PlanInsufficientModal)
- `dashboard/_components/TopBarShell.tsx` — fusion des 4 navbars inline (organisateur/signataire/admin/réseau) + badge rôle du DashboardShell. ROLE_PROFILE_PATH pour lien profil organisateur
- `docs/INVENTAIRE_DASHBOARD_SHELLS.md` — inventaire exhaustif avant unification

**Fichiers modifiés** :
- `dashboard/layout.tsx` — routeur HEBERGEUR → HebergeurShell / reste → TopBarShell + Footer mutualisé
- `hebergeur/layout.tsx` — auth guard conservé (seul redirect /login des pages hébergeur), chrome supprimé
- `sejour/[id]/page.tsx` — HebergeurSidebar/isHebergeur/usePermissions supprimés (le layout fournit le shell)
- `organisateur/page.tsx`, `signataire/page.tsx`, `admin/page.tsx`, `reseau/page.tsx` — navbars inline supprimées

**Fichier supprimé** : `_components/DashboardShell.tsx`

**Écarts délibérés par rapport au plan** :
1. hebergeur/layout.tsx n’est pas un passthrough pur : auth guard conservé (seul redirect /login de toutes les pages hébergeur)
2. Lien profil organisateur conservé via ROLE_PROFILE_PATH dans TopBarShell

**Suivi** : double bandeau sous-pages organisateur/admin (TopBarShell + nav locale breadcrumb). Chantier de suivi 4.5.

### Fix post-Run 3 (commit 4958489)

1. **Bug hooks React** : `organisateur/page.tsx` — `useSearchParams()` appelé après early return conditionnel (violation règles hooks). Remonté avant le early return.
2. **min-h-screen dupliqué** : TopBarShell fournit `min-h-screen bg-gray-50`, les 4 pages racines (organisateur, signataire, admin, réseau) le dupliquaient → 4rem de scroll en trop. Retiré des 4 pages.

### Tests visuels validés
- Admin : TopBarShell + onglets fonctionnels ✅
- Parent (page courte) : footer collé en bas, zéro scroll ✅
- Hébergeur Sauvageon : sidebar intacte, dashboard + page séjour OK ✅

### Branches
- `feat/fable5-test-nuit` : Runs 1+2 (16 commits) — à merger via PR
- `feat/dashboard-shell-unification` : Run 3 + fix (12 commits) — à merger via PR

### Leçons retenues
1. **Fable 5 pour le refactoring structurel pur** : 3 runs autonomes en une nuit, zéro intervention humaine pendant l’exécution, build vert à chaque étape. Idéal pour de l’extraction/déplacement de code sans logique métier.
2. **Écarts conservateurs = bon jugement** : les 2 déviations du Run 3 (auth guard hebergeur, lien profil organisateur) étaient les bons choix. Le prompt autorisait ces écarts avec justification.
3. **Fix post-run nécessaire** : même avec build vert, l’audit humain a révélé un bug hooks préexistant (pas introduit par le run) et un micro-bug CSS (scroll 4rem en trop). L’agent ne les voit pas parce qu’ils ne cassent pas tsc/build.
4. **Pages parent/autorite = scaffolding mort** : découvert pendant les tests visuels. Aucune fonctionnalité, aucun guard de rôle. Le modèle LIAVO actuel ne prévoit pas de dashboard connecté pour ces rôles.

---

## SESSION 02/07/2026 — Facturation admin LIAVO + contrat événement phase 2

### Premier client payant — Les Choucas (Nora Da Cruz)

Nora demande un devis LIAVO pour le plan Pilotage annuel (690€ HT). Entité de facturation : Ville de Neuilly-Plaisance (SIRET 219 300 498 00017, 6 rue du Général de Gaulle, 93360 Neuilly-Plaisance). Collectivité → paiement par mandat administratif via Trésor Public, pas Mollie. Flux : devis LIAVO → BDC mairie → facture LIAVO via Chorus Pro.

**Devis DL-2026-001 envoyé à Nora le 02/07/2026.**

### Facturation admin LIAVO — LIVRÉE

**Problème** : l'endpoint `POST /admin/facturer-centre` existait mais : (1) pas de devis LIAVO (seulement facture), (2) destinataire hardcodé sur le centre (pas sur l'entité de facturation), (3) SIRET émetteur incomplet (SIREN seul), (4) pas d'IBAN émetteur sur le PDF, (5) pas de bouton dans l'admin UI.

**Livré** (3 commits : backend PDF + backend admin + frontend admin) :

- **FacturePDF.tsx** : `typeFacture: 'DEVIS'` ajouté au union type. Titre "DEVIS", mentions validité 30j, versements/conditions masqués pour devis.
- **sequence.service.ts** : `'DEVIS_LIAVO'` ajouté au union type `typeDoc`.
- **facture-liavo.service.ts** : constantes `LIAVO_SIRET` / `LIAVO_IBAN` (env vars Scalingo), param `destinataire` optionnel sur `emettre()` (Mollie non impacté — 6e param optionnel), nouvelle méthode `genererDevisLiavo()` (numéro `DL-YYYY-NNN`, PDF folder `devis-liavo`).
- **admin.controller.ts** : `POST /admin/devis-liavo` + `facturer-centre` étendu avec champs destinataire.
- **admin.service.ts** : `genererDevisLiavo()` + `facturerCentre()` accepte objet body avec destinataire.
- **Frontend admin** : formulaire dans onglet "Factures LIAVO" — sélection centre, plan, fréquence, champs destinataire (pré-remplis depuis le centre, modifiables), boutons "Générer le devis" / "Émettre la facture". PDF via `SecureFileLink` (folder OVH privé).
- **Variables Scalingo** : `LIAVO_SIRET=102 994 910 00010`, `LIAVO_IBAN=FR76 1810 6000 2796 7985 1267 389`.

### Contrat événement — phase 2 — LIVRÉ

**Bug signalé** : client événement Sauvageon (Jean-Baptiste Perrin, DEV-2026-0037) ne peut pas ouvrir le lien contrat dans l'email (URL OVH privée → 403).

**Livré** (4 commits backend + frontend) :

- **devis.service.ts** : extraction `buildContratEvenementPdf()`, `getContratPdfByToken()`. Lien contrat supprimé du HTML email.
- **devis.controller.ts** : `GET /devis/:id/contrat/preview`.
- **devis-public.controller.ts** : `GET /devis/public/:token/contrat` (endpoint public, token = auth implicite).
- **contrat-sauvageon.pdf.tsx** : fix formatage montants (fmtMontant custom au lieu de toLocaleString), 22h→21h, BIC AGRIFRPP881 + banque Crédit Agricole des Savoie + titulaire SAS LE SAUVAGEON.
- **TabDevisFacturation.tsx** : bouton "Prévisualiser le contrat" (événements), `<a href>` contratUrl remplacés par `SecureFileLink`.
- **Page signature** : `contratUrl` via endpoint public `/api/devis/public/${token}/contrat`, state `contratOuvert`, checkbox disabled.

### Fix bouton "Annuler ce devis" — LIVRÉ

Bouton masqué quand facture active sans avoir. Condition ajoutée : `(!factureAcompte || avoirSurAcompte) && (!factureSolde || avoirSurSolde)`.

### Leçons retenues
1. **Folders OVH privés** : ne jamais mettre de lien direct dans un email. Utiliser SecureFileLink (authé) ou endpoint public par token.
2. **toLocaleString + react-pdf** : les narrow no-break spaces (U+202F) se rendent comme "/". Utiliser un formatter custom.
3. **Extraction avant expansion** : extraire une méthode pure (buildX) avant d'ajouter des features (preview).

---

## SESSION 01/07/2026 (nuit) — Contrat événement DIRECT

### Problème
Le contrat événement PDF (contrat-sauvageon.pdf.tsx) était généré dans `envoyerDevisDirect()` mais `contratUrl` n'était jamais persisté sur le devis. Le client ne voyait le contrat que dans l'email initial — pas sur la page de signature. Côté hébergeur, aucun moyen de le retrouver. De plus, le contrat Sauvageon hardcodé était généré pour TOUS les centres (bug : un client des Choucas recevrait un contrat au nom du Sauvageon).

### Livré (3 commits : SQL + backend + frontend)

**SQL** : `ALTER TABLE devis ADD COLUMN contrat_url VARCHAR(500);` — appliqué manuellement via pgsql-console avant le déploiement backend. Fichier `docs/migrations/2026-07-01-contrat-url.sql` créé pour traçabilité.

**Backend** (schema.prisma + devis.service.ts) :
- `contratUrl` ajouté au model Devis (après `conventionUrl`)
- Guard Sauvageon : `const isSauvageon = centre.email === 'resa@lesauvageon.com'` — seul le Sauvageon génère le contrat événement. Condition `if (isEvenement && isSauvageon && centre.iban)`.
- Persistance : `prisma.devis.update({ data: { contratUrl } })` après upload OVH, dans le try.
- Exposition publique : `contratUrl` ajouté au return de `getDevisPublicByToken()`.

**Frontend** :
- Types : `contratUrl` ajouté à `Devis` (devis.ts) et `DevisPublic` (collaboration.ts).
- Page signature `/devis/signer/[token]` : bloc "Contrat" avec lien PDF (conditionné `contratUrl`), checkbox mise à jour ("J'ai lu et j'accepte **le contrat**, les conditions du devis et les conditions d'annulation").
- Dashboard hébergeur `TabDevisFacturation.tsx` : bouton "Contrat événement (PDF)" ajouté dans les 2 zones de rendu (DIRECT + COLLAB), conditionné `contratUrl`, en sibling du bloc convention (pas à l'intérieur — le bloc convention est gardé par `natureSejour === 'SEJOUR'`, le contrat par `contratUrl`).

### Flux actuel contrat événement (post-fix)
1. Hébergeur envoie devis sur événement Sauvageon → contrat PDF généré, uploadé OVH, `contratUrl` persisté sur le devis, lien dans l'email client
2. Client ouvre page signature → voit le contrat en téléchargement + checkbox mentionne le contrat
3. Hébergeur ouvre le séjour → voit le bouton "Contrat événement (PDF)" dans l'onglet Devis & Facturation
4. Autres centres (Choucas, Alticlub, Pôle Montagne) : guard → pas de contrat généré, `contratUrl` reste null, aucun bouton affiché

### Leçons retenues
1. **Ordre de déploiement SQL → backend → frontend** : si le backend avec le nouveau schema Prisma déploie AVANT le SQL, Prisma fait un `SELECT contrat_url` → 500 sur toute page chargeant un devis. Le frontend peut déployer dans n'importe quel ordre (le `{contratUrl && ...}` protège).
2. **Guard par email du centre** (`resa@lesauvageon.com`) : temporaire. Si le Sauvageon change d'email, le guard casse. À remplacer par un flag ou un champ dédié quand on généralisera le contrat événement.
3. **Devis existants** : les événements déjà envoyés ont `contrat_url = NULL`. Le PDF existe sur OVH mais le lien est perdu. Ré-envoyer le devis régénère et persiste.

---

## SESSION 01/07/2026 (soir) — Refonte dashboard hébergeur + jauge occupation

### Refonte dashboard hébergeur (5 commits, 2 fichiers principaux)

**Problème** : le dashboard empilait 7 sections sans hiérarchie (KPIs financiers, tuiles actions prioritaires, rappels, séjours par période, configuration, profil centre, rentabilité). Trois bugs identifiés : KPI Impayés comptait les devis complémentaires + pointait vers le mauvais onglet, KPI "À facturer" utilisait dateDebut au lieu de dateFin, planning n'affichait que les séjours collaboratifs (DIRECT absents).

**Livré** : dashboard refondu en 3 zones.
1. **KPI CA confirmé** — carte Link → /pilotage (teaser pour plan PILOTAGE, paywall pour les autres). Sélecteur période DDA/DDM/T1-T4.
2. **3 cartes alertes** — Devis en attente, À facturer, Impayés. `title` HTML natif au hover. Lien intelligent Impayés : suivi-soldes si au moins un solde impayé, sinon suivi-acomptes.
3. **Planning compact 3 semaines** (S-1/S/S+1) — grille 7×3 identique visuellement à la vue mois du planning. Source `getMesSejoursPlanning` (DIRECT+COLLAB). Cellules cliquables → /planning?date=X&view=semaine. CTA "Voir le planning complet" en bouton bordé. Légende couleurs.

**Sections supprimées** : Actions prioritaires, Rappels du jour, Séjours par période, Configuration, Mon établissement, Rentabilité.

**Fixes bugs** :
- KPI Impayés : filtre `isComplementaire` ajouté (était absent contrairement aux KPIs 1-3)
- KPI À facturer : `resolveSejourDateFin` au lieu de `resolveSejourDateDebut` — aligné avec l'onglet a-facturer de la page devis
- Planning : source `getMesSejoursPlanning` (DIRECT+COLLAB) au lieu de `getMesSejoursConvention` (COLLAB only)
- Tooltips : remplacés par `title` HTML natif (l'ancien `absolute bottom-full` était clippé au viewport)
- Double chargement API : suppression de getMonProfil, getRappelsToday, getTableauRentabilite du dashboard (8→5 appels)

### Sidebar hébergeur (3 modifications)

1. **"Inviter"** ajouté dans le groupe Activité (icône `userPlus`). La page `/inviter-enseignant` n'était accessible que depuis la section Configuration du dashboard, qui est supprimée.
2. **"Disponibilités"** retiré du groupe Paramètres. Page orpheline en doublon avec le planning (clic indispo). La page reste sur le disque mais n'est plus navigable.
3. **Paramètres collapsible** : label cliquable avec chevron ▾/▸, fermé par défaut, auto-expand si l'utilisateur est sur une page Paramètres. Fix scroll `h-screen` au lieu de `min-h-screen` pour scroll indépendant de la sidebar.

### Jauge occupation planning vue mois

**Backend** : `nombreAccompagnateurs: true` ajouté au select de `getMesSejoursPlanning` (1 ligne).

**Frontend** : en vue mois, chaque cellule affiche `X/capacité` (ex: "50/120") quand au moins un séjour chevauche le jour. Rouge gras si surbooking (`occ > capaciteCentre`). Gris discret sinon. Masqué si aucun séjour ou capacité non renseignée.

**Cascade évitée** : `occupationForDay` opère sur `sejours` (non filtré), pas sur `sejoursForDay` (filtré par combobox). L'occupation est un indicateur de sécurité global, indépendant du filtre de recherche.

### Leçons retenues
1. **Marché PMS** : les dashboards hôteliers (Cloudbeds, Amenitiz, OPERA Cloud) convergent vers "aujourd'hui d'abord" + calendrier comme centre + KPIs drill-down. LIAVO n'est pas un PMS (unité = séjour, pas chambre) mais les principes s'appliquent. Venue360 est le concurrent le plus direct (hébergement de groupes, France+international).
2. **KPIs dashboard vs page devis** : les compteurs doivent utiliser exactement la même logique que les onglets de destination. Sinon perte de confiance ("5 impayés ici, 4 là-bas").
3. **`sejoursForDay` vs `sejours`** : toute fonction de calcul global (occupation, CA, alertes) doit opérer sur les données non filtrées. Les fonctions d'affichage (barres planning) peuvent utiliser les données filtrées.

---

## SESSION 01/07/2026 (après-midi) — Refonte hub /dashboard/hebergeur/devis + fix contact séjour direct

### Fix backend : contact séjour direct absent (commit `5ceb11e`)
Sur la page `/dashboard/hebergeur/devis`, les devis liés à un séjour direct (mariages Sauvageon, événements) affichaient "Contact non renseigné" alors que `sejours.client_nom` / `client_email` / `client_organisation` étaient bien remplis en base. Cause : `devis.service.ts::getMesDevis()` ne sélectionnait pas ces champs dans son `include.sejourDirect.select`. Le frontend (`DevisCard.tsx::resolveContact`) lisait bien `sd?.clientNom` mais recevait `undefined`.

**Fix (1 ligne)** : ajout de `clientNom, clientEmail, clientOrganisation` au select `sejourDirect` de `getMesDevis`. `getDevisForSejour` (lignes ~269) n'était pas touché, pas de cascade nécessaire.

### Refonte hub /dashboard/hebergeur/devis (commit `e793672`, 5 fichiers)
Ancienne page = 7 filtres statut non hiérarchisés, aucune notion d'urgence. Refonte en **hub d'alerte 5 onglets** :
- `En attente de réponse` — EN_ATTENTE / EN_ATTENTE_VALIDATION
- `À facturer` — sous-groupes "Soldes à créer" + "Acomptes à créer"
- `Suivi acomptes` — FA émises non validées
- `Suivi soldes` — FS émises non intégralement payées
- `Historique` — soldés + non retenus

**Bandeau alertes non-dismissible** en haut de page avec 5 chips (rouge/orange) selon seuil 30j : soldes à relancer, acomptes à relancer, acomptes à valider, devis à relancer, à facturer. Clic sur chip = navigation vers l'onglet cible. Compteur global "N actions en attente".

**Nouveau composant** `DevisCard.tsx` extrait : bordure/pastille colorées selon sévérité alerte, contact séjour direct (nom + email + tel cliquables), signature structurée (`nomSignataireDirecteur` + `dateSignatureDirecteur` prioritaires sur fallback string composite), badge dérivé des factures (Acompte facturé / Soldé) prime sur statut devis.

**Nouveau helper** `src/lib/devisAlertes.ts` : catégories `CategorieAlerte`, fonctions `estAlerte`/`computeAlertes`/`resolveSejourDateDebut`/`resolveSejourDateFin`. Fallbacks en cascade sur les dates jusqu'à `createdAt` (jamais null), `joursDepasses` no-crash sur NaN.

**Tri** : par défaut "alertes en tête puis ancienneté croissante". Tri custom Date/Montant/Client possible.

### Leçons retenues
1. **Frontend local sans `.env.local` = teste contre l'API prod.** `api.ts::baseURL = '/api'` + `next.config.ts` rewrites `/api/:path*` → `${NEXT_PUBLIC_API_URL || 'https://api.liavo.fr'}/:path*`. Sans `frontend/.env.local` définissant `NEXT_PUBLIC_API_URL=http://localhost:3001`, un `npm run dev` frontend tape vers la prod. Symptôme : "je viens de fixer un bug backend, je relance le frontend, le fix ne prend pas". À créer une fois pour toutes.
2. **Vérifier que les données sont en base AVANT de tester un fix backend d'affichage.** Si `sejours.client_nom` avait été NULL pour tous les imports Sauvageon, le fix `getMesDevis` aurait été techniquement correct mais visuellement invisible. Un `SELECT ... WHERE nature_sejour = 'EVENEMENT' AND client_nom IS NOT NULL LIMIT 5` en 30 secondes évite un tour en rond.
3. **Push atomique = un commit à la fois.** Cette session a poussé 3 commits en un seul push (fix backend + refonte 5 fichiers + docs). Ça a fonctionné cette fois. Ne pas prendre l'habitude : la prochaine fois, si un des 3 casse la prod, le revert n'est plus chirurgical.

---

## SESSION 01/07/2026 — Fix envoi facture par email (PDF via S3 authentifié)

### Bug
« Impossible de récupérer le PDF de la facture » quand l'hébergeur envoie une facture par email. `envoyerFactureParEmail` faisait un `fetch()` **non authentifié** sur l'URL OVH du PDF. Le folder `factures` n'est **pas** dans `PUBLIC_FOLDERS` (seuls `logos`/`centres` le sont) → OVH renvoie 403, traduit en `ForbiddenException('Impossible de récupérer le PDF de la facture')`.

### Fix à la source (2 fichiers, commit `f62cbcf`)
- **`storage/storage.service.ts`** : nouvelle méthode publique `fetchAsBuffer(url): Promise<Buffer>`. Réutilise `getKeyFromUrl` pour valider l'appartenance au bucket, puis `GetObjectCommand` S3 **authentifié** via `this.client` (credentials internes) → renvoie un `Buffer`. Réutilisable pour tout folder privé (devis, signatures, contrats, conventions, brochures, uploads).
- **`facture/facture.service.ts`** : dans `envoyerFactureParEmail`, remplace le `fetch()` par `this.storage.fetchAsBuffer(facture.pdfUrl)` (try/catch conservant le même `ForbiddenException`).

### Leçon retenue
Tout accès en lecture à un fichier d'un **folder privé** (hors `logos`/`centres`) doit passer par `StorageService.fetchAsBuffer()` — jamais un `fetch()` direct sur l'URL publique OVH (403). Idem `generateSignedUrl()` pour exposer un lien temporaire côté client.

---

## SESSION 01/07/2026 (matinée) — Convention configurable par centre (livrée)

### Contexte
`backend/src/devis/convention-scolaire-sauvageon.pdf.tsx` : 250 lignes JSX react-pdf avec prose juridique **hardcodée Sauvageon** — inutilisable pour Choucas / Pôle Montagne. Trois options architecturales analysées ; **Option C retenue** : couverture LIAVO dynamique (page 1) + PDF statique uploadé par le centre (pages 2+) fusionnés via `pdf-lib`.

### Livré (commit `fd2db59`, déployé en prod)
- **Migration Prisma** : champ `conventionPdfUrl String? @map("convention_pdf_url") @db.VarChar(500)` sur `CentreHebergement`. Auto-appliquée en prod par `prisma migrate deploy` du Procfile Scalingo au boot.
- **`backend/src/devis/convention-couverture.pdf.tsx`** : nouvelle page react-pdf **générique** (parties, dates, effectifs, tableau financier, signatures) sans texte spécifique centre.
- **`devis.service.ts`** : branching dans `buildConventionScolairePdf()` — si `centre.conventionPdfUrl` renseigné → couverture LIAVO + fetch PDF centre + merge via `pdf-lib`. Sinon → legacy Sauvageon inchangé.
- **`centre.controller.ts` + `centre.service.ts`** : endpoints `POST /centres/convention-pdf` + `POST /centres/convention-pdf/supprimer` (pattern brochure mirroré, avec suppression de l'ancien fichier avant nouveau upload — mieux que brochure).
- **Frontend** : type + fonctions API dans `frontend/src/lib/centre.ts`, section « Convention / Conditions générales » dans page profil hébergeur après brochure.
- **Folder S3** : `centres/{centreId}/conventions-centre` (dans `PUBLIC_FOLDERS` → fetch backend fonctionne sans auth pour la fusion `pdf-lib`).

### Flux utilisateur
Après signature devis (statuts SELECTIONNE/SIGNE_DIRECTION/FACTURE_ACOMPTE/FACTURE_SOLDE), dans l'onglet Devis & Facturation du séjour, deux boutons apparaissent :
- **Prévisualiser** → ouvre le PDF dans un nouvel onglet, sans effet de bord
- **Générer et envoyer la convention** → upload OVH + email au contact enseignant/organisateur + log CRM. Idempotent, chaque clic recrée le PDF avec l'état courant.

### Statut clients
- **Sauvageon** : reste sur legacy (pas de PDF uploadé, template hardcodé continue de marcher).
- **Choucas & Pôle Montagne** : messages WhatsApp envoyés à Nora et Yves pour uploader leur PDF conditions générales. Basculement auto sur nouveau flux dès qu'ils l'ont uploadé.

### Leçons retenues
1. **Procfile `prisma migrate deploy` au boot** applique automatiquement les migrations committées. La règle « SQL manuel uniquement » vaut pour `prisma migrate dev` (interdit), pas pour les migrations SQL committées. À noter pour éviter le stress inutile de « la colonne n'existe pas en prod » — elle existe déjà via le Procfile.
2. **Folder S3 public vs privé** = décision architecturale à conscientiser : si le backend doit `fetch()` le fichier (ex. merge pdf-lib), le folder doit être public OU utiliser `StorageService.fetchAsBuffer()`. Ici, `centres/` public choisi car conditions générales n'ont rien de confidentiel.

---

## SESSION 01/07/2026 (matinée) — Upgrades Pilotage + SearchableSelect

### Upgrades Pilotage (SQL prod)
Yves Massard (Pôle Montagne) confirmé au téléphone → upgrade PILOTAGE sur ses 2 centres actifs. Puis même upgrade sur Choucas à la demande de Théo.

```sql
UPDATE centres_hebergement SET plan_abonnement = 'PILOTAGE' 
WHERE nom IN ('Chalet Le Florimont', 'Chalet YAKA') AND abonnement_statut = 'ACTIF';

UPDATE centres_hebergement SET plan_abonnement = 'PILOTAGE' 
WHERE nom ILIKE '%choucas%' AND abonnement_statut = 'ACTIF';
```

**À noter pour les prochains scripts SQL** : nom de table `centres_hebergement` (avec S), colonne `abonnement_actif_jusqua` (pas `jusqu_au`). Le nom du Florimont a été importé plusieurs fois via APIDAE (DECOUVERTE/INACTIF, ne pas toucher).

### Composant `SearchableSelect<T>` (livré)
Remplace les `<select>` natifs devenus inutilisables avec 20+ items (page Rentabilité pour liaison factures↔séjours : titre tronqué après sélection, pas de dédoublonnage).

**Livré** : composant générique `frontend/src/components/SearchableSelect.tsx` (props : items, valueFn, labelFn, subLabelFn, value, onChange, placeholder, excludeValues, className, disabled). Filtrage insensible accents/casse via `normalize('NFD')`, keyboard nav ↓/↑/Enter/Escape, click-outside via ref+mousedown listener, `excludeValues` calculé sur les autres lignes de ventilation.

Intégré dans `rentabilite/page.tsx`. Réutilisable ailleurs (CRM, DevisBuilder). Les 3 composants API-based existants (CatalogueSuggestionInput, EtablissementSearch, OrganisationSearch) restent tels quels — périmètre différent (recherche API-driven, pas filtrage local).

---

## SESSION 30/06/2026 — Sécurité + Pilotage + UX sidebar + Traçabilité catalogue

### Résumé

Session complète en une journée : **LOT 6 sécurité code finalisé** (6g/6k/6a/6j/6b/6l), **checklist hors-code H1-H9 fermée**, **politique confidentialité corrigée** (Mollie + IBAN + redirect), **sidebar hébergeur restructurée** (Activité/Gestion/Pilotage/Paramètres + cadenas plan + tri séjours non-lus), **Module Pilotage complet** (PlanGuard strict, 4 endpoints backend, page CA & Remplissage avec recharts, Comptabilité export CSV, Rentabilité migrée, Équipe placeholder), **UI polish** (vrai logo, tooltip ?, Prévisionnel ambre), **produitCatalogueId** sur LigneDevis (traçabilité catalogue → ventilation CA par produit).

### Lots livrés

| Lot | Description |
|---|---|
| LOT 6g | AllExceptionsFilter — stack traces masquées en prod |
| LOT 6k | searchPublic + getPublic filtrent statut ACTIVE |
| LOT 6a | Logs sensibles → Logger NestJS, tokenAcces supprimé |
| LOT 6j | Ownership check getOrdreMissionHtml — IDOR fermé |
| LOT 6b | escapeHtml() 49 occurrences (19 méthodes email) |
| LOT 6l | DTO class-validator 38 champs POST /public/demande |
| H1-H9 | Bucket OVH, npm audit, Helmet, SSL DB, DNS email, DPA ×3, politique confidentialité, logs |
| H8 corrections | Mollie sous-traitant + correction claim IBAN + redirect /politique-confidentialite |
| Sidebar restructurée | 5 sections (Activité/Gestion/Pilotage/Paramètres), cadenas plan, highlight sous-routes |
| Séjours tri non-lus | Non-lus remontés en tête de la page séjours |
| Type PILOTAGE frontend | Ajouté dans Centre + CentreResume |
| PlanGuard strict | Mode strict bloque les GET (analytics/exports) |
| Pilotage backend A | Endpoints remplissage + CA (nuitées, ventilation type/source, N-1) |
| Pilotage backend B | Export CSV factures + versements (StreamableFile, BOM UTF-8) |
| Pilotage frontend | Layout tabs + CA & Remplissage (4 KPIs + recharts) + Comptabilité + Équipe placeholder + Rentabilité migrée |
| UI polish | Vrai logo sidebar, tooltip ?, Pipeline→Prévisionnel, couleur ambre #F59E0B |
| produitCatalogueId | FK nullable sur LigneDevis + DTO + 3 builders frontend + script backfill Sauvageon |
| CA par produit | Ventilation CA par produit catalogue dans endpoint + carte frontend |

---

## ÉTAT PROD AU 30/06/2026

### Sécurité — VERROUILLAGE COMPLET
LOT 6 code : 6g/6k/6a/6j/6b/6l/6m/6n/6i — tous livrés.
Checklist infra : H1-H9 — tous vérifiés et fermés.
Reste LOT 6 maintenance (au fil de l'eau, non bloquant) : 6c/6d/6e/6f/6h/6o.

### Module Pilotage — LIVRÉ
- CA & Remplissage : 4 KPIs (réalisé/prévisionnel/encaissé/reste dû), graphique mensuel recharts (réalisé bleu/prévisionnel ambre/encaissé vert), ventilation type/source/produit, comparaison N-1 (masquée si pas de données), tooltips explicatifs, taux remplissage mensuel avec seuils couleur
- Rentabilité : page existante migrée dans les onglets Pilotage
- Comptabilité : export CSV factures + versements (format Excel FR, BOM UTF-8, sélecteur période)
- Équipe : placeholder "Bientôt disponible"
- PlanGuard strict sur analytics (PILOTAGE), export sur COMPLET

### Sidebar — RESTRUCTURÉE
5 sections : vide (Tableau de bord) / Activité (Séjours, Planning, Demandes) / Gestion (Devis & Facturation, CRM clients 🔒) / Pilotage (Pilotage 🔒) / Paramètres. Cadenas affiché quand plan insuffisant, PlanInsufficientModal au clic sur feature bloquée.

### Traçabilité catalogue — LIVRÉE
produitCatalogueId FK nullable sur LigneDevis. Les 3 builders de devis (nouveau, modifier, TabDevisFacturation) sauvent l'ID du produit catalogue. Ventilation CA par produit dans Pilotage. Script backfill Sauvageon prêt (docs/scripts/).

### Responsive mobile — LIVRÉ
Dashboard hébergeur, planning, pages publiques, ~60 pages sweep. Drawer overlay mobile < 768px, desktop inchangé. Vérifié sur vrai téléphone avec données réelles (hébergeur Sauvageon).

### Clients
- **Sauvageon** : PILOTAGE gratuit permanent (2099-12-31)
- **Les Choucas** : trial Complet actif. **Deadline ~17/07 — premier paiement.**
- **Alticlub** : trial Complet actif jusqu'au 10/09/2026
- **Pôle Montagne** : trial Complet actif jusqu'au 01/12/2026

---

## PROCHAINS CHANTIERS (par priorité)

### 1. Démarchage commercial (immédiat)
- [ ] Facturer Les Choucas via POST /admin/facturer-centre
- [ ] Vidéo motion design landing page
- [ ] Pitch Alticlub conversion trial → payant
- [ ] Démarcher centres IDDJ (54 importés)

### 2. Cron alertes expiration
- [ ] NestJS @Cron ou Scalingo scheduler — filet de sécurité

### 3. Module Pilotage itérations
- [ ] Conversion funnel (demandes → devis → signés)
- [ ] Export PDF rapport mensuel
- [ ] Planning équipe (modèle de données à créer)

### 4. Dette technique
- [x] ~~Modules devis partagés~~ (Run 1 Fable 5 — 3 modules extraits, logique commune mutualisée)
- [x] ~~Découper sejour/[id]/page.tsx~~ (Run 2 Fable 5 — 194KB → 20KB, 9 composants)
- [x] ~~DashboardShell unification~~ (Run 3 Fable 5 — HebergeurShell + TopBarShell)
- [x] ~~Responsive mobile~~ (Fable 5 overnight + 2 fixes manuels, 8 commits, déployé 03/07)
- [ ] Merge complet 3 DevisBuilder → 1 paramétrique (prochaine modif devis)
- [ ] Double bandeau sous-pages organisateur/admin (chantier 4.5)
- [ ] DMARC p=none → p=quarantine
- [ ] Chiffrement IBAN en base
- [ ] Créer `frontend/.env.local` avec `NEXT_PUBLIC_API_URL=http://localhost:3001` (une bonne fois pour toutes)

---

## STACK & COMMANDES
- **Backend** : NestJS 11, Prisma, PostgreSQL 17, Scalingo Paris
- **Frontend** : Next.js 16.1.6, React 19, TypeScript 5, Tailwind 4, recharts, Scalingo Paris
- **Stockage** : OVH Object Storage Gravelines
- **Emails** : Brevo FR | **PSP** : Mollie (SEPA, clé live)
- **Repo** : `C:\Users\Roche-Loison\Desktop\sejour-jeunesse`
- **CC** : `cd C:\Users\Roche-Loison\Desktop\sejour-jeunesse && claude`
- **SQL prod** : `scalingo --app liavo-backend --region osc-fr1 pgsql-console`
- **Déploiement** : auto sur push main
