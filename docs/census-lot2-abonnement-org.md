# Census Lot 2 — bascule des ÉCRITURES d'abonnement sur l'Organisation

**Date : 06/08/2026 — LECTURE SEULE.** Aucun fichier modifié, aucun write en base. Code au commit courant (post-L1 déployé : `7faf569` migration + vérif prod verte). Référence : `docs/census-lot1-schema-backfill.md`, `docs/census-lot0-register.md`.

Rappel de périmètre : L2 = écritures sur l'org, L3 = lectures, **déployés ensemble** (entre L2 et L3, le code mixte ne doit jamais partir seul en prod).

---

## 1. ANGLE MORT PRINCIPAL — transitions de statut d'un centre (admin.service.ts + claim.service.ts)

Inventaire exhaustif des writes de `centres_hebergement.statut` (grep total sur `backend/src`) :

| Flux | Fichier:ligne | Transition | Mono/multi | Transaction ? | resync à brancher ? |
|---|---|---|---|---|---|
| `validerHebergeur` | admin.service.ts:103-127 | `updateMany WHERE userId` PENDING→ACTIVE | **MULTI** (tous les centres du user) | NON (updateMany isolé, trial :127 après) | **OUI** — 1 appel par org distincte des centres activés |
| `activerCentre` | admin.service.ts:1426-1441 | update single PENDING→ACTIVE | mono | NON | **OUI** — org du centre |
| `refuserCentre` | admin.service.ts:1461-1472 | update single PENDING→SUSPENDED | mono | NON | Non nécessaire (un PENDING ne comptait pas dans le supplément) — appel idempotent toléré |
| `refuserHebergeur` | admin.service.ts:204-228 | **`deleteMany` centres + `delete` user** (hard delete) | MULTI | NON | **OUI si l'org survit** (elle survit : rien ne supprime l'organisation) — et voir risque RESTRICT §9 |
| `validerClaim` | claim.service.ts:580-636 | :613-616 rattache les orphelins (`userId: null` → user), :617-620 `updateMany` PENDING→ACTIVE **de TOUTE l'org** | **MULTI** | membership+user en `$transaction` :593-609, mais les 2 `updateMany` centres et le trial :624 sont HORS transaction | **OUI** — org du membership (un seul orgId, cas simple) |
| `register` (invitation) | centre.service.ts:988-1088 | crée/active en ACTIVE (3 cas) | mono | NON (fix Lot 0 = transaction) | **OUI** — après la transaction du fix L2c |
| `createCentre` | centre.service.ts:266-360 | crée en PENDING | mono | OUI | Non nécessaire (PENDING) — l'activation ultérieure (validerClaim/activerCentre) portera le resync |
| `syncApidae` import | admin.service.ts:888 | crée ACTIVE **userId: null** (catalogue) | multi (boucle) | NON | NON — mais voir le piège Q7 §9 (comptage) |
| `syncLmdj` import | admin.service.ts:1124 | idem catalogue | multi | NON | NON — idem |
| `attachOrganisation` (validation claim centre / imports) | admin.service.ts:897-915, 1037, 1096-1138 | pose `organisationId` (pas le statut) | — | NON | Changer l'org d'un centre ACTIVE changerait N des deux orgs → **OUI en théorie** ; en pratique idempotent « si null » seulement — à noter en commentaire |

**Aucun flux ACTIVE→SUSPENDED ni SUSPENDED→ACTIVE n'existe** pour un centre exploité (le « kill switch » admin passe par `updateUtilisateur` :261-285 → `compteValide=false`, gate JWT `jwt.strategy.ts:59-61`, sans toucher `centre.statut`). Le jour où une vraie suspension de centre naîtra, elle devra appeler le resync — à écrire dans le doc du helper.

**Autres sites admin à basculer (lectures/calculs, frontière L2/L3)** :
- `facturerCentre` :1693-1754 — écrit plan/statut/expiration/`modePaiement: VIREMENT` **sur le centre** :1739-1748 et calcule le montant **sans supplément** (`PRIX_ANNUEL/PRIX_MENSUEL[plan]` direct :1723). L2d : écrire sur l'org + `calculerMontantAbonnementCents(plan, freq, N ACTIVE org)` + `FactureLiavo` avec `organisationId`.
- `genererDevisLiavo` :1756-1779 + `facture-liavo.service.ts:16-17` (map de prix locale sans supplément) — même unification.
- `getMetriquesAbonnements` :352-388 — MRR = somme des prix **par centre** (:369-380) → devra sommer par org (`calculerMontantAbonnementCents` par org abonnée). L3 mais dans le même fichier.
- `getAbonnements` :324-343, `getHebergeurs` :68-102 (:95), `getCentres` :287-323 (:311, :329-337), vue :1640-1652 — selects/list par centre → L3.

## 2. `resyncMontantOrganisation(orgId)` — faisabilité Mollie

**Confirmé sur `@mollie/api-client@4.5.0` installé** (`package.json` `^4.5.0`) :
- `mollieClient.customerSubscriptions.update(id, parameters)` existe (`CustomerSubscriptionsBinder.d.ts:60-61`) — PATCH sur la subscription, « Each field is optional. **You cannot update a canceled subscription.** » (:53-58).
- `UpdateParameters` (`binders/customers/subscriptions/parameters.d.ts:11`) = `{ customerId } & Pick<SubscriptionData, 'mandateId'> & PickOptional<…, 'amount' | 'description' | …>`. **⚠️ Piège de typage : `mandateId` est REQUIS** (Pick non optionnel) alors que la doc Mollie le dit optionnel — passer `org.mollieMandatId` systématiquement (on l'a, sinon la subscription n'existerait pas).
- Comportement API (doc Mollie update-subscription) : le nouveau `amount` prend effet **au prochain cycle de prélèvement** — pas de prorata, pas de prélèvement immédiat. Exactement la sémantique voulue (« le centre ajouté est facturé au prochain cycle »).

**Forme du helper** (décision cadrage confirmée réalisable) : `resyncMontantOrganisation(orgId)` → charge l'org ; **no-op si `mollieSubscriptionId` null** ; compte les centres ACTIVE de l'org (cf. piège Q7 §9) ; `calculerMontantAbonnementCents(org.planAbonnement, org.abonnement ?? 'MENSUEL', n)` ; `customerSubscriptions.update(subId, { customerId, mandateId, amount })` ; log succès/échec. **Appelé HORS transaction DB, après commit, fire-and-forget** (`.catch(log)`).

**Points d'appel** (dérivés du tableau §1) : `validerHebergeur` (par org distincte), `activerCentre`, `validerClaim`, `refuserHebergeur` (post-delete), `register` (post-transaction), `souscrire`/`annuler` n'en ont pas besoin (ils créent/annulent la subscription eux-mêmes), `createCentre` non (PENDING). Placer le helper dans `abonnements/` (il consomme `abonnement.constants` + le client Mollie) et l'exporter — attention au cycle de modules admin↔abonnements (AdminModule importe déjà AbonnementModule, admin.module.ts:11 — OK).

## 3. ROBUSTESSE du resync — tranché : (a) auto-correction par le webhook, avec un correctif de cohérence facture

Si le PATCH Mollie échoue (réseau, 5xx) après une transition, la subscription garde l'ancien montant → sous/sur-facturation au prochain prélèvement.

- **(a) Auto-correction par le webhook — RECOMMANDÉ, structure vérifiée compatible** : `handleWebhook` (abonnement.service.ts:338-417) traite chaque prélèvement récurrent `paid` (:363) et **recalcule déjà le montant théorique** à la facturation (:391-396). Il suffit d'y ajouter, après l'émission de la facture, un appel `resyncMontantOrganisation(org.id)` (fire-and-forget) : tout écart est corrigé **au plus tard au cycle suivant**, sans état supplémentaire ni cron. Le webhook est déjà idempotent (garde `FactureLiavo.molliePaymentId` :364-368) et le resync est lui-même idempotent (PATCH du même montant = no-op côté Mollie).
  **⚠️ Correctif de cohérence à intégrer au passage (L2a)** : la facture émise au webhook utilise aujourd'hui le montant **recalculé** (:394-396), pas le montant **réellement prélevé** (`payment.amount.value`). Si la subscription a un vieux montant (resync raté), la facture dirait X alors que le client a payé Y — une facture doit refléter le prélèvement réel. → facturer `payment.amount`, et laisser le resync réaligner la subscription pour le cycle suivant.
- **(b) resync rejouable (bouton admin / cron de réconciliation)** : plus d'infrastructure (endpoint + UI ou cron quotidien comparant montant théorique vs `subscription.amount` via `customerSubscriptions.get`), pour couvrir le même trou avec une latence équivalente (le prélèvement suivant reste faux si la réconciliation n'a pas tourné avant). Utile un jour comme outil de support, pas nécessaire au L2.

**Décision proposée : (a)**, avec le correctif « facturer le montant payé ». (b) reste en backlog outillage admin.

## 4. Refonte `souscrire` / `handleWebhook` / `annuler` (abonnement.service.ts) — point par point

`souscrire` :197-334 :
1. Résolution : `getCentreForUser` (inchangé) → `centre.organisationId` ; si null → 409 « centre sans organisation » (n'existe pas en prod, mais fail-fast).
2. **Garde PROPRIETAIRE** : `membership.findUnique({ userId_organisationId })` + `role === 'PROPRIETAIRE'` → sinon 403. N'exige PAS `claimStatut VALIDE` (décision cadrage). Exclut mécaniquement les collaborateurs (pas de membership).
3. Annulation d'une subscription existante : lire `org.mollieSubscriptionId/CustomerId` (:218-231 aujourd'hui sur le centre) — c'est LA garde anti-double-souscription du compte multi-centre : le 2e centre de la même org retombe sur la même subscription et la remplace au lieu d'en créer une 2e.
4. Comptage :234-236 : `count({ where: { organisationId, statut: 'ACTIVE' } })` au lieu de `userId` (+ décision Q7 §9 sur `userId NOT NULL`).
5. Customer Mollie :240-247 : réutiliser `org.mollieCustomerId` ; à la création, `name` = `org.raisonSociale ?? org.nom` (plus « user — centre »), email du user souscripteur.
6. Description subscription :267 : nommer l'ORG (« Abonnement LIAVO {plan} {freq} — {org.nom} »).
7. Écritures :282-293 : `organisation.update` (mollie*/plan/frequence/statut/expiration). **Pendant la transition L2+L3 déployés ensemble, ne plus écrire sur le centre** ; l'état centre devient legacy en lecture morte (nettoyage = lot ultérieur).
8. `AcceptationCgv` :295-303 : + `organisationId`, `centreId` conservé en trace.
9. Grace period :275-280 : lire `org.abonnementActifJusquAu`.

`handleWebhook` :338-417 :
- :354-360 : `organisation.findFirst({ where: { mollieCustomerId } })` — résolution **unique garantie par l'index partiel L1** (`organisations_mollie_customer_id_key`). Le fallback centre n'est pas nécessaire (0 mandat en prod, aucun customer legacy à résoudre).
- :370-387 : fréquence + prolongation sur l'org.
- :391-399 : comptage par org, **facture = montant payé** (§3), `factureLiavoService.emettre` enrichi de `organisationId` (+ destinataire = raison sociale org — frontière L4 mais même signature, à faire d'un coup).
- Fin de traitement : `resyncMontantOrganisation` fire-and-forget (§3a).

`annuler` :421-484 : garde PROPRIETAIRE identique à souscrire ; cancel Mollie via l'org ; `organisation.update { mollieSubscriptionId: null }` (statut reste ACTIF jusqu'à expiration, commentaire :440-442 inchangé).

`simuler` :38-56 et `getFactures` :486-489 (→ `lister` par organisationId), `getStatut` :161-193 (lecture → L3 mais même fichier — basculer en même temps).

## 5. Trial → organisation (`trial.helper.ts:37-147`)

Nouvelle signature : `demarrerOuAlignerTrial(prisma, email, organisationId)` — toutes les requêtes internes passent de `where: { userId }` à `where: { organisationId }` (:45), les gardes a/b/c/d (:60-93) et les `updateMany` (:97-105, :111-119) inchangés dans leur logique. **Le trial s'écrit sur l'ORG** (colonnes L1) ; pendant la transition, ne plus écrire les centres.

Impact sur les 4 appelants (tous passent `userId` aujourd'hui) :
- **login** (auth.service.ts:462 zone) : résoudre les orgs des centres possédés du user (`SELECT DISTINCT organisationId FROM centres WHERE userId`) → 1 appel par org. Multi-société : chaque org a son essai (décision Q4 assumée : « une org = un essai » remplace « un compte = un essai » du 14/07 — la décision §9 de la roadmap devra être amendée).
- **validerClaim** (claim.service.ts:624) : l'orgId est DÉJÀ là (`membership.organisationId`) — le cas le plus simple.
- **activerCentre** (admin.service.ts:1440) : `centre.organisationId` — direct.
- **validerHebergeur** (admin.service.ts:127) : orgs distinctes des centres du user, 1 appel chacune.

`activerTrial` :60-105 et `demanderExtension` :112-157 : gardes et écritures sur l'org (trialStartedAt/mollieMandatId/abonnementActifJusquAu de l'org) + garde PROPRIETAIRE cohérente avec souscrire (un collaborateur ne consomme pas l'essai de l'org). `getStatut` :161-193 lit l'org (L3).

## 6. `register()` — Lot 0 intégré + abo sur l'org

Pas-à-pas déjà censusé dans **`docs/census-lot0-register.md`** (§ « Fix proposé », ne pas re-détailler) : `$transaction` englobant user→centre→abonnement→org→membership, `utilisedAt` en **dernier** write, `claimStatut: 'VALIDE'` + `claimValidatedAt` (étendre `findOrCreateMembership` ou update dans la tx), fusion des doubles updates, mapping P2002/P2000, spec neuve.
**Delta L2** : le bloc « abonnement offert COMPLET/ACTIF/+30j » (:994-1000, :1018-1024, :1080-1087) se pose **sur l'ORG** (dans la même transaction, l'org étant résolue/créée AVANT — inverser l'ordre actuel : org d'abord, abo ensuite) et **sans `trialStartedAt`** (sémantique « offert » conservée, garde b du trial.helper). Post-commit : `resyncMontantOrganisation` (no-op tant que l'org n'a pas de subscription).

## 7. Re-backfill de sécurité (fenêtre L1→L2)

Toute écriture d'abonnement entre le deploy L1 (06/08 17:23 UTC) et le deploy L2 ne touche QUE les centres → l'état org peut avoir dérivé. **Forme : migration SQL dans le commit L2** (`prisma/migrations/<ts>_rebackfill_abonnement_organisation/migration.sql`) **rejouant à l'identique le bloc c) de L1** (le `WITH ref AS (DISTINCT ON …) UPDATE organisations`, copié verbatim — il est idempotent et rejouable par construction, classement total). Rejeu COMPLET plutôt que restreint aux orgs divergentes : le filtre de divergence coûterait plus cher à écrire juste que le rejeu intégral (155 lignes), et le rejeu écrase par la même règle → même résultat. Elle s'applique au boot AVANT le démarrage du code L2/L3 (Procfile) : le nouveau code démarre sur un état org strictement à jour. Aucun write applicatif sur l'org n'existe avant L2, donc pas d'écrasement possible dans l'autre sens.

## 8. Specs à réviser / créer

| Spec | Impact |
|---|---|
| `centres/trial.helper.spec.ts` | RÉÉCRITURE partielle : scope organisationId, gardes sur l'état org |
| `auth/auth.service.spec.ts` (:59-123 trial au login) | résolution orgs du user + nouvelle signature |
| `centres/create-centre.spec.ts` | inchangé sur le fond (PENDING, pas de resync) — vérifier les mocks membership |
| `auth/guards/plan.guard.spec.ts` | L3 (lecture org) — même déploiement |
| `abonnements/cron-alertes.service.spec.ts` | L3 (requêtes org + tampon org) — même déploiement |
| `chambres/rooming.service.spec.ts` | L3 (plan effectif lu sur l'org) |
| `admin/refuser-centre.spec.ts` | inchangé (PENDING→SUSPENDED) |
| **NOUVEAUX** | `abonnement.service.spec.ts` (souscrire : garde PROPRIETAIRE, comptage org, écritures org ; webhook : résolution org, facture=montant payé, resync appelé) ; `resync-montant.spec.ts` (no-op sans subscription, montant, échec Mollie non-bloquant) ; `register.spec.ts` (Lot 0 : 3 cas, transaction, VALIDE, utilisedAt dernier, abo sur l'org) |

## 9. CASCADES / RISQUES

- **⚠️ Piège Q7 — centres catalogue dans le comptage** : `syncApidae`/`syncLmdj` créent des centres **ACTIVE avec `userId: null`** (:888, :1124) rattachés à une organisation (dédup SIREN/nom+ville :897-915). Compter « centres ACTIVE de l'org » gonflerait le supplément avec des centres catalogue jamais revendiqués. **Proposition : `count({ organisationId, statut: 'ACTIVE', userId: { not: null } })`** (centres exploités seulement) — à valider, c'est un affinement de Q7, pas une remise en cause.
- **Collaborateurs** : perdent souscrire/annuler/trial/extension (garde PROPRIETAIRE) — voulu. Vérifier que le frontend abonnement (`page.tsx`) affiche un message propre sur le 403 (L5/frontend, à minima ne pas crasher).
- **Webhook** : la résolution `organisation.findFirst({ mollieCustomerId })` est sûre (index unique partiel L1). Risque résiduel : un customer créé par L2 mais un webhook reçu APRÈS un rollback applicatif → org sans subscription → le webhook prolonge une org sans facture ; la garde `factureLiavo.molliePaymentId` et les logs couvrent le diagnostic.
- **Trial multi-société** : « une org = un essai » ouvre N essais à un user à N sociétés — assumé (Q4), mais **amender la décision §9 du 14/07 dans la roadmap** pour ne pas laisser deux règles contradictoires.
- **resync et transactions** : jamais DANS une transaction (un échec Mollie ne doit pas rollbacker une activation de centre) — décision cadrage, à faire respecter par construction (le helper ne prend pas de `tx`).
- **`refuserHebergeur` (hard delete)** : avec L1, `FactureLiavo.centre_id` passe à NULL (facture survit ✅) mais **`acceptations_cgv.centre_id` est `ON DELETE RESTRICT`** → le `deleteMany` des centres **plantera** dès qu'un centre refusé aura une acceptation CGV (0 en prod, latent). À traiter au L2 (soit exclure ce cas, soit décider du sort des CGV d'un compte refusé).
- **`facturerCentre` (L2d)** : appliquer le supplément change le montant facturé aux clients VIREMENT multi-centres — c'est le BUT (Q8), mais prévenir Théo que la prochaine facture Choucas/offerts multi ne sera plus « prix plan sec ».
- **Fenêtre de déploiement** : L2 (écritures) et L3 (lectures) partent ENSEMBLE — un déploiement partiel écrirait sur l'org ce que les guards liraient encore sur le centre (features coupées à tort). Le re-backfill §7 est le filet côté données ; côté code, un seul commit/deploy pour L2+L3.
- **Cycle de modules** : `resyncMontantOrganisation` dans `abonnements/` importé par admin/claim/centres — AdminModule importe déjà AbonnementModule (admin.module.ts:11), ClaimService et CentreService devront importer le module ou le helper pur (préférer un helper pur + client Mollie passé/importé, zéro dépendance NestJS, comme trial.helper).

## Découpage proposé en sous-lots d'écriture

| Sous-lot | Contenu | Fichiers principaux |
|---|---|---|
| **L2a** | souscrire/webhook/annuler/simuler/trial-endpoints sur l'org + garde PROPRIETAIRE + facture=montant payé | `abonnements/abonnement.service.ts`, `abonnement.controller.ts` (inchangé ou presque), spec neuve |
| **L2b** | `resyncMontantOrganisation` (helper pur) + branchements transitions (validerHebergeur, activerCentre, validerClaim, refuserHebergeur) + hook webhook | `abonnements/resync-montant.helper.ts` (nouveau), `admin/admin.service.ts`, `organisations/claim.service.ts`, spec neuve |
| **L2c** | register() : transaction Lot 0 + VALIDE + abo COMPLET sur l'org + resync post-commit | `centres/centre.service.ts`, `organisations/organisation.helpers.ts` (claimValidatedAt), `register.spec.ts` neuf |
| **L2d** | facturerCentre + genererDevisLiavo : supplément + organisationId + unification map de prix | `admin/admin.service.ts`, `facture-liavo/facture-liavo.service.ts` |
| **L2e** | trial.helper scope org + 4 appelants | `centres/trial.helper.ts`, `auth/auth.service.ts`, `claim.service.ts`, `admin.service.ts`, `trial.helper.spec.ts` |
| **re-backfill** | migration rejouant le bloc c) de L1 verbatim | `prisma/migrations/<ts>_rebackfill_abonnement_organisation/` |

(L3 lectures — PlanGuard, rooming, demande.service, cron-alertes, getStatut, métriques admin, listes — est le lot suivant, même commit de déploiement.)

## Questions ouvertes restantes

1. **Q7 affiné** : exclure les centres catalogue (`userId: null`) du comptage du supplément ? (recommandé §9 — à valider par Théo.)
2. **CGV d'un compte refusé** (`refuserHebergeur` × RESTRICT) : exclure les centres à CGV du hard delete, ou passer la FK en SetNull ? (latent, 0 ligne en prod.)
3. **Amendement roadmap** : réécrire la décision « un compte = un essai » (14/07) en « une organisation = un essai » quand L2e sera mergé.
4. `simuler` (admin/test) : basculer sur l'org ou supprimer ? (2 lignes, à trancher au L2a.)

---

*Census Lot 2 réalisé en lecture seule le 06/08/2026. STOP — zéro écriture.*
