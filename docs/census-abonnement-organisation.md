# Census — abonnement porté par l'Organisation (chantier « 1 abonnement / organisation »)

**Date : 06/08/2026 — LECTURE SEULE.** Aucun fichier de code modifié, aucune migration, aucun write en base.
Décision de cadrage (Théo) : l'abonnement LIAVO est porté par l'**Organisation**, plus par le centre — 1er centre au tarif du plan, +39 €/mois par centre rattaché.

---

## 1. Ce qui est déjà acté (docs de cadrage — ne pas relitiger)

1. **Grille tarifaire** 0/39/59/79 € HT/mois (Découverte/Essentiel/Complet/Pilotage), remise 17 % annuel, PSP Mollie SEPA live (§9, 30/06).
2. **Angle mort documenté le 20/07** (`ROADMAP_ETE_2026.md:99-107`) : `souscrire()` travaille par centre, montant = plan + (centres actifs du compte − 1) × 39 €, **aucune garde** anti double souscription → 2 mandats facturant chacun le total = surfacturation quadratique. Impact prod nul à date (aucun mandat Mollie), risque dormant à réveiller **avant Pôle Montagne et Tereva**.
3. **Essai : un compte = UN essai** (14/07) — `demarrerOuAlignerTrial` est la source unique, tout nouveau centre s'aligne sur la même expiration, jamais de 2e essai ; seule soupape = extension self-service +14 j.
4. **Résolution d'organisation par la DONNÉE** (14/07) : SIRET → SIREN, sinon membership VALIDE le plus ancien, sinon dédup/création ; `claimStatut` dérive de la relation user × organisation.
5. **L'Organisation est déjà l'émetteur légal** des factures clients : `emetteurId = centre.organisationId ?? centre.id` (devis.service.ts:97, 1168, 1399, 1475 ; facture.service.ts:226 ; séquences scopées dessus).

---

## 2. Census du code — qui lit/écrit l'état d'abonnement du centre

### 2.0 Le stock d'état (schema.prisma, modèle `CentreHebergement`)

`backend/prisma/schema.prisma:596-605` : `abonnement` (fréquence MENSUEL/ANNUEL, nullable), `abonnementActifJusquAu`, `abonnementStatut` (default INACTIF), `planAbonnement` (default DECOUVERTE), `mollieCustomerId`, `mollieSubscriptionId`, `mollieMandatId`, `trialStartedAt`, `dernierEmailAlerteAt` (tampon anti-répétition du cron), `modePaiement`.
Satellites centre-scopés : `FactureLiavo.centreId` (schema:676-696, **onDelete: Cascade**), `AcceptationCgv.centreId` (schema:698-711).
`Organisation` (schema:1544-1579) ne porte **aucun** champ d'abonnement aujourd'hui.

### 2.a Lecteurs / écrivains, par famille

**AbonnementService** (`backend/src/abonnements/abonnement.service.ts`) — l'épicentre, tout passe par `getCentreForUser` + `X-Centre-Id` :
- `simuler` :47-55 — update du centre (admin/test).
- `activerTrial` :60-105 — gardes sur `centre.trialStartedAt`/`mollieMandatId`, update du centre.
- `demanderExtension` :112-157 — +14 j, garde dérivée des dates du centre.
- `getStatut` :161-193 — lecture pure, dérive `actif`/`isTrial`/`trialExpire`/`mandatActif` du centre. Consommé par le frontend.
- `souscrire` :197-334 — **le cœur du chantier** : annule l'ancienne subscription DU CENTRE (:218-231), compte les centres `WHERE { userId, statut: 'ACTIVE' }` (:234-236, ⚠️ scope **userId**, pas organisation), customer Mollie nommé « user — centre » (:242-246), mandat + subscription (:250-271), pose mollie*/plan/statut sur LE centre (:282-293), `AcceptationCgv` centre-scopée (:295-303). Aucune garde « ce compte/cette org a déjà un mandat ».
- `handleWebhook` :338-417 — `findFirst({ mollieCustomerId })` → **UN** centre (:354-360), idempotence via `FactureLiavo.molliePaymentId` (:364-368), prolonge le centre (:381-387), recompte par `centre.userId` (:391-393), émet la FactureLiavo sur `centre.id` (:397-399).
- `annuler` :421-484 — cancel Mollie + `mollieSubscriptionId: null` sur le centre.
- `getFactures` :486-489 → `factureLiavoService.lister(centre.id)`.

**AbonnementController** (`abonnement.controller.ts:18-64`) — 7 endpoints, tous `@Roles(HEBERGEUR)` + `@CentreId()`. NB : un **collaborateur accepté** d'un centre passe `getCentreForUser` → il peut aujourd'hui souscrire/annuler pour le centre.

**PlanGuard** (`auth/guards/plan.guard.ts:50-63`) — résout le centre via `getCentreForUser` (X-Centre-Id), plan effectif = `ACTIF && exp >= now ? planAbonnement : DECOUVERTE`. **Logique dupliquée** dans `chambres/rooming.service.ts:158-164` (même calcul inline, hors guard).

**Gates métier hors PlanGuard** :
- `demandes/demande.service.ts:159-162` — `accesComplet` dérivé de `centre.abonnementStatut`/`abonnementActifJusquAu` (floutage des demandes ouvertes).
- `devis/devis.service.ts:55` et `sejours/sejour.service.ts:982` — `TODO: ABONNEMENT` **désactivés** (décision §9 du 03/07 : ne pas réactiver tant que le flux paiement n'est pas stable). À réactiver directement en version organisation.

**Trial** (`centres/trial.helper.ts:37-147`) — voir 2.c.
Écritures directes hors helper : `abonnement.service.activerTrial` (:75-83) et **`centre.service.register()` (invitation admin/réseau, :937)** qui pose `COMPLET/ACTIF/trialExpiration()` en dur aux 3 cas (:995-1000, :1017-1024, :1079-1086) — **sans `trialStartedAt`** (= « abonnement offert » au sens de trial.helper, bloque tout essai futur du compte) et **sans `organisationId`** (voir 2.e).

**Cron** (`abonnements/cron-alertes.service.ts`) — 4 requêtes quotidiennes (8h Paris, garde `ENABLE_CRON`), toutes `findMany` sur `centreHebergement` :
- essai J-21→J-1 (:62-117) : `abonnementStatut ACTIF + trialStartedAt not null + mollieMandatId null + modePaiement ≠ VIREMENT`.
- essai expiré (:134-173) : même ciblage, `abonnementActifJusquAu < now`.
- renouvellement annuel J-30 (:193-225) : `mollieMandatId not null`, montant recalculé via `calculerMontantAbonnementCents(plan, 'ANNUEL', nb centres actifs du user)` (:216).
- relance virement admin (:250-274) : `modePaiement VIREMENT`.
Tampon partagé `dernierEmailAlerteAt` **sur le centre** (:74-75, 116, 139-140, 173, 196-197, 225, 254-255, 274). Spec riche : `cron-alertes.service.spec.ts` (invariants Choucas/Alticlub).

**Admin** (`admin/admin.service.ts`) :
- métriques dashboard (:355-380) : trials actifs/expirés, mandats, MRR = somme des prix **par centre** (`PRIX_MENSUEL_MAP[c.planAbonnement]`).
- listes centres (:95, 311, 329-337, 403, 511, 650) : selects des champs abonnement.
- vue abonnements (:1640-1652) : `isTrial = trialStartedAt && !mollieMandatId` par centre.
- `offrirAbonnement` (:1717-1751) : update du centre + `modePaiement: 'VIREMENT'`, prix `PRIX_ANNUEL/PRIX_MENSUEL[plan]` direct (:1723) — ⚠️ **sans le supplément multi-centre** (incohérent avec le cron J-30 qui, lui, l'inclut).
- `genererDevisLiavo` (:1756-1779) → FactureLiavoService, prix sans supplément non plus.
- import catalogue (:1126-1127) : centres créés `INACTIF`/`DECOUVERTE` (sain).

**Constantes** (`abonnements/abonnement.constants.ts`) : `PRIX_MENSUEL/ANNUEL`, `CENTRE_SUPP_MENSUEL 3900`/`ANNUEL 39000`, `calculerMontantAbonnementCents(plan, freq, nbCentresActifs)` = plan + (n−1)×39 €. ⚠️ `facture-liavo.service.ts:16-17` a sa **propre map locale de prix** (sans supplément) pour `genererDevisLiavo`.

**Auth** (`auth/auth.service.ts:462`) — commentaire : plus de trial à l'inscription, `demarrerOuAlignerTrial` au login. Spec `auth.service.spec.ts:59-123`.

**Frontend** :
- `frontend/src/lib/abonnement.ts` — `getAbonnementStatut`, `souscrireAbonnement`, `annulerAbonnement`, `demanderExtension`, `getFacturesLiavo` ; tout transite par `X-Centre-Id` (intercepteur `api.ts`).
- `frontend/app/dashboard/hebergeur/abonnement/page.tsx` — page souscription + bandeaux trial/actif/expiré (l'UI parle « votre centre »).
- `frontend/src/lib/api.ts:22-28` — intercepteur 403 `PLAN_INSUFFICIENT` → `PlanInsufficientModal.tsx` (lien vers la page abonnement).
- Types : `src/lib/admin.ts:249-311`, `src/lib/centre.ts:48-49, 318-319` ; `app/components/PricingTable.tsx`, mentions dans `HebergeurSidebar`/`HebergeurShell`/dashboards hébergeur & admin.

**Tests à réviser au chantier** : `cron-alertes.service.spec.ts`, `trial.helper.spec.ts`, `plan.guard.spec.ts`, `auth.service.spec.ts`, `rooming.service.spec.ts`, `create-centre.spec.ts`.

### 2.b `getCentreForUser` (centre.helper.ts:4-48) — expose-t-il l'organisation ?

Il retourne le **centre Prisma complet**, qui porte déjà la colonne `organisationId` → `centre.organisationId` est disponible **partout** où le helper est utilisé, sans requête supplémentaire. Résolution : `centreId` explicite (owner ou collaborateur accepté ; SUSPENDED = 404), sinon **premier** centre owned, sinon premier centre collaborateur. Deux pièges pour le chantier : (1) `organisationId` est **nullable** dans le schéma (0 null en prod hors SUSPENDED, cf. §3, mais le code devra traiter le cas) ; (2) les **collaborateurs acceptés** résolvent le centre comme le propriétaire → droit de souscription à trancher (Q3).

### 2.c `demarrerOuAlignerTrial` (trial.helper.ts:37-147) — userId ou organisation ?

**Réponse à la question ouverte : le trial est scopé `userId`**, pas organisation : `findMany({ where: { userId } })` (:45), toutes les gardes (compte payant :60, offert :62-70, éligibles :73-79, référence d'essai :83-85) et les `updateMany` (:97-105, :111-119) raisonnent sur les centres **du user**. Piège : un user rattaché à **deux sociétés** (createCentre permet une seconde organisation) partage quand même un seul essai — cohérent en « par compte », incohérent en « par organisation ». Appelé par 4 chemins : login (auth.service), `validerClaim` (claim.service), `activerCentre`/`validerHebergeur` (admin.service).

### 2.d FactureLiavo — créée / listée par centreId

- **Création** : `facture-liavo.service.ts` `emettre(centreId, …)` :104-207 — `factureLiavo.create({ centreId })` (:122-135), destinataire par défaut = **nom/adresse/siret du centre + email du user** (:155-158), pas la raison sociale de l'organisation. Appelée par le webhook Mollie (abonnement.service:397-399), `admin.offrirAbonnement` (:1751), et `genererDevisLiavo(centreId)` (devis commercial, non persisté).
- **Listage** : `lister(centreId)` :209-214 (hébergeur via `/abonnements/factures`, résolu X-Centre-Id) ; `listerToutes()` :216-221 (admin).
- Numérotation : séquence `FACTURE_LIAVO` sur l'UUID sentinelle LIAVO (:11, :30-34) — **indépendante du centre**, rien à migrer.
- ⚠️ `FactureLiavo.centreId` est `onDelete: Cascade` (schema:691) : supprimer un centre supprime ses factures LIAVO — déjà discutable légalement, à corriger au passage si on re-parente.

### 2.e organisationId à la création d'un centre — toujours posé ?

- **`createCentre`** (centre.service.ts:266-360) : **toujours posé**, dans la transaction, via la résolution SIRET→SIREN / membership VALIDE / dédup-création (:295-311, :326). Verrouillé par `create-centre.spec.ts`.
- **Inscription hébergeur** (auth.service.ts:375-394) : organisation + membership posés.
- **Claim** (claim.service.ts:142-248) : résout ou crée l'organisation.
- **Admin** (`attachOrganisation`, admin.service.ts:897-913, 1037, 1096-1138) : backfill à la validation + import catalogue.
- ⚠️ **TROU : `centre.service.register()` (invitation admin/réseau, :937-1090)** — les 3 cas (centre existant, pré-créé, matching APIDAE/création) posent `userId`, `statut ACTIVE` et l'abonnement COMPLET offert, **sans jamais poser `organisationId`**. Ce chemin peut produire de nouveaux orphelins (le stock prod est propre aujourd'hui, cf. §3, donc soit le chemin est peu utilisé, soit les orphelins ont été rattrapés par `attachOrganisation`). **À colmater dans le chantier** (prérequis pour rendre la lecture org fiable).

### Mécanique vs piège, par famille

| Famille | Centre → Organisation | Verdict |
|---|---|---|
| PlanGuard, getStatut, demande.service, rooming | remplacer la lecture `centre.*` par `centre.organisation.*` | **Mécanique**, sauf nullable + dupliqué dans rooming |
| souscrire / webhook / annuler | customer+mandat+subscription par org, comptage par org (pas userId), garde anti-double, description Mollie | **Refonte réelle** |
| trial.helper | scope userId → organisation (ou statu quo) | **Piège** : user multi-sociétés (Q4) |
| cron-alertes (4 requêtes + tampon) | requêtes par organisation, `dernierEmailAlerteAt` à déménager sur l'org | **Piège** : dédup des alertes multi-centre (déjà bricolée par userId dans les specs) |
| FactureLiavo / AcceptationCgv | re-parenter `organisationId` ou garder centreId + join | **Choix de schéma** (Q5) + cascade à retirer |
| admin (métriques, offrir, listes) | MRR par org, `offrirAbonnement` par org + supplément | Mécanique + **bug supplément à trancher** (Q8) |
| frontend | statut/souscription affichés « organisation, couvre N centres » | Mécanique + wording |

---

## 3. SQL prod (SELECT read-only via pgsql-console, 06/08/2026) — résultats bruts

```
-- orphelins (prérequis bloquant du chantier)
 orphelins | total
-----------+-------
         0 |   135

-- vrais multi-centres par organisation (statut ACTIVE)
           organisation_id            | count
--------------------------------------+-------
 1abae3f5-a7b3-48b2-adf2-c4569030e2ea |     2
 523fa43b-8555-48b5-a1ee-11c6f115bda8 |     2

-- état Mollie réel
 avec_mandat
-------------
           0

-- centres ACTIVE orphelins (candidats backfill)
(0 rows)
```

Contexte des 2 organisations multi-centres (requête complémentaire) :
- **Pôle Montagne** (`1abae3f5…`) : Chalet YAKA + Chalet Le Florimont — même user, PILOTAGE/ACTIF, trial aligné `2026-06-03` (donc expiré), pas de modePaiement.
- **PULSE SPORTS CAMPUS VALLOIRE** (`523fa43b…`) : Valloire + Chamberet — même user, PILOTAGE/ACTIF, trial aligné `2026-07-09`.

**Trois verdicts structurants** :
1. **Le backfill orphelins est SANS OBJET** — 0 orphelin sur 135 centres non-SUSPENDED. Le prérequis « bloquant » est déjà satisfait ; reste à colmater le chemin `register()` (2.e) pour qu'il le demeure, et éventuellement contraindre (Q6).
2. **La migration Mollie est à blanc** — 0 mandat en prod : aucun customer/mandat/subscription à re-parenter chez Mollie, on repart proprement au niveau organisation.
3. Les 2 orgs multi-centres ont des valeurs d'abonnement **identiques et alignées** sur leurs 2 centres → le backfill « copier l'état du centre vers son organisation » est trivial et sans conflit.

---

## 4. Périmètre estimé (fichiers à toucher, par lot)

**Lot 0 — Backfill orphelins : SANS OBJET** (0 orphelin). À la place : fix du trou `centre.service.register()` (pose d'`organisationId` aux 3 cas) + décision NOT NULL (Q6).

**Lot 1 — Schéma** : migration SQL manuelle (jamais `prisma migrate dev`) ajoutant sur `organisations` : `abonnement` (fréquence), `abonnement_statut`, `abonnement_actif_jusqua`, `plan_abonnement`, `mollie_customer_id/subscription_id/mandat_id`, `trial_started_at`, `mode_paiement`, `dernier_email_alerte_at` + backfill copie depuis les centres (trivial, cf. §3) + choix FactureLiavo/AcceptationCgv (Q5). Fichiers : `schema.prisma`, `prisma/migrations/<ts>_abonnement_organisation/migration.sql`.

**Lot 2 — Backend souscription + webhook** : `abonnements/abonnement.service.ts` (7 méthodes), `abonnement.controller.ts`, `abonnement.constants.ts` (sémantique de `nbCentres` = centres ACTIVE de l'org), garde « cette organisation a déjà un mandat », webhook résolvant l'**organisation** par `mollieCustomerId`.

**Lot 3 — Guards + lectures** : `auth/guards/plan.guard.ts`, `chambres/rooming.service.ts` (dupliqué), `demandes/demande.service.ts`, `centres/trial.helper.ts` (+ décision Q4), `abonnements/cron-alertes.service.ts` (4 requêtes + tampon), `admin/admin.service.ts` (métriques, listes, `offrirAbonnement`, vue abonnements), TODO devis.service.ts:55 / sejour.service.ts:982 si réactivés. Specs associées (6 fichiers).

**Lot 4 — FactureLiavo** : `facture-liavo/facture-liavo.service.ts` (emettre/lister/destinataire = raison sociale de l'org, prix map locale à unifier), retrait du Cascade, `admin` émission manuelle.

**Lot 5 — Frontend** : `src/lib/abonnement.ts`, `app/dashboard/hebergeur/abonnement/page.tsx` (wording « abonnement de votre organisation — couvre N centres »), `PlanInsufficientModal.tsx`, `src/lib/admin.ts`, `src/lib/centre.ts`, `PricingTable.tsx`, dashboards admin.

---

## 5. Questions ouvertes (à trancher avant de coder)

1. **Plan unique par organisation ?** Aujourd'hui le plan est par centre ; les 2 orgs multi ont le même plan partout donc la migration est indolore — mais il faut acter qu'un plan org s'applique à TOUS ses centres (pas de mix Essentiel/Pilotage dans une org).
2. **Supplément auto-patché sur Mollie ?** Quand un centre est ajouté/retiré d'une org abonnée, met-on à jour le montant de la subscription (`customerSubscriptions.update`) automatiquement, ou au prochain renouvellement, ou manuellement ? Sans réponse, le montant prélevé et le montant dû divergent dès le 1er centre ajouté.
3. **Qui souscrit / quel IBAN ?** La souscription engage l'organisation : réservée au propriétaire (`Membership isPrimary`/`PROPRIETAIRE` VALIDE) ? Aujourd'hui un **collaborateur accepté** d'un centre peut souscrire/annuler via `getCentreForUser`.
4. **Trial migré sur l'organisation ?** Aujourd'hui scopé `userId` (2.c). Par org : un user à 2 sociétés aurait 2 essais ; par user (statu quo) : une org à 2 propriétaires successifs pourrait en cumuler. Le « un compte = un essai » du 14/07 penche pour le statu quo userId, à confirmer.
5. **FactureLiavo re-parentée ?** Ajouter `organisationId` (et retirer le Cascade) vs garder `centreId` et lister par jointure. Le destinataire légal de la facture devrait de toute façon devenir la raison sociale de l'organisation.
6. **`organisation_id` NOT NULL sur `centres_hebergement` ?** 0 null hors SUSPENDED — vérifier les SUSPENDED avant, et colmater `register()` (2.e) d'abord.
7. **Sémantique de « nb centres » du supplément** : aujourd'hui `statut = 'ACTIVE'` du compte (userId). En org : centres ACTIVE de l'org ? Un centre PENDING compte-t-il ? Un centre volontairement laissé en Découverte ?
8. **`offrirAbonnement` admin sans supplément multi-centre** (admin.service.ts:1723) : bug à aligner sur `calculerMontantAbonnementCents`, ou choix commercial (offert = prix plan sec) à documenter ?

---

*Census réalisé en lecture seule le 06/08/2026 (code au commit `cc7945c`). SQL prod : SELECT uniquement.*
