# Census Lot 0 — `centre.service.register()` et l'organisationId (phase 1, lecture seule)

**Date : 06/08/2026 — LECTURE SEULE.** Aucun fichier de code modifié, aucune migration, aucun write en base. Code au commit `cc7945c`.

---

## ⚠️ ERRATUM — la prémisse du cadrage est fausse (et le census initial avec)

**`register()` pose DÉJÀ organisation + membership, pour les 3 cas**, via un bloc commun `centre.service.ts:1099-1129` introduit par `44caf8c` (04/05/2026, « SC5bis corrections A+B+C + Route 6 invitation admin hébergeur »). Le census initial (`census-abonnement-organisation.md` §2.e) avait lu le fichier jusqu'à la ligne ~1090 et conclu à tort que CAS 2/3b créaient des orphelins définitifs. C'est cohérent avec la prod : 0 orphelin.

**Le vrai reliquat du Lot 0 n'est donc pas « poser l'org » mais trois choses plus fines :**
1. **Aucune transaction** — 8+ writes séquentiels ; un crash au milieu laisse un état partiel (dont, fugacement, un centre ACTIVE orphelin — la fenêtre existe, elle n'est juste jamais restée ouverte en prod).
2. **`claimStatut: 'NON_APPLICABLE'`** au lieu du `VALIDE` décidé au cadrage (invitation admin = pré-validé) — avec des cascades réelles (§5).
3. **L'invitation est brûlée (`utilisedAt`) AVANT** le bloc org/membership : un échec après la ligne 1097 laisse un compte partiel **et** une invitation inutilisable.

---

## 1. `register()` pas à pas (centre.service.ts:937-1148)

Ordre exact des writes — **tous hors transaction** :

| # | Write | Lignes |
|---|---|---|
| 0 | Lectures/gardes : invitation (`token`, garde `utilisedAt`) :938-942 ; CAS 1 centre revendiquable (existe, `userId` null) :945-955 ; email non pris :957-960 | — |
| 1 | `user.create` (HEBERGEUR, `motDePasseDefini: true`) | :964-975 |
| 2 | Notif admin (fire-and-forget, `.catch(() => {})`) | :977-981 |
| 3a | **CAS 1** (`centreExistantId`) : `update` centre `{userId, statut: 'ACTIVE'}` **puis 2e update** `{planAbonnement: 'COMPLET', abonnementStatut: 'ACTIF', abonnementActifJusquAu: trialExpiration()}` | :988-1001 |
| 3b | **CAS 2** (`centrePrecreerNom`) : `create` centre (nom/adresse/ville/CP/capacité/**siret = centrePrecreerSiret**/département/email invitation, `ACTIVE`, **sans organisationId**) puis même update abonnement | :1002-1025 |
| 3c | **CAS 3** : matching APIDAE par email :1029-1035, fallback nom+ville insensitive :1038-1047 → **3a** `update` merge non-écrasant `{userId, ACTIVE}` :1049-1062 / **3b** `create` depuis le dto (**sans siret — le DTO n'en a pas**, sans organisationId) :1063-1078 ; puis même update abonnement :1080-1087 | :1026-1088 |
| 4 | `invitationHebergement.update {utilisedAt}` | :1094-1097 |
| 5 | **Bloc commun org** : si `!centre.organisationId` → `findOrCreateOrganisation` alimentée depuis **le centre** (nom/adresse/CP/ville/email/tel/siteWeb/siret + `siren = siret.substring(0,9)`, `source: APIDAE si 3a sinon MANUAL`, `sourceId: apidaeId`) puis `update` `centre.organisationId` | :1099-1121 |
| 6 | `findOrCreateMembership` `{PROPRIETAIRE, isPrimary: true, claimStatut: 'NON_APPLICABLE'}` | :1123-1129 |
| 7 | JWT + refresh token (`user.update`) | :1131-1140 |

**Bilan par cas** : organisationId → posé dans les 4 sous-cas (idempotent : seulement si null — CAS 1/3a, centres pré-existants, l'ont souvent déjà). Membership → posé, mais `NON_APPLICABLE`. Plan → `COMPLET/ACTIF/+30j` **sans `trialStartedAt`** dans les 3 cas (= « abonnement offert » au sens de trial.helper).

**Fenêtres d'incohérence (l'absence de transaction)** :
- Crash après #1 : user HEBERGEUR sans centre, **email consommé** (la garde :957-960 rend toute nouvelle tentative impossible : « Cet email est déjà utilisé ») — l'invitation reste valable mais inutilisable pour cet email.
- Crash entre #3 et #5 : **centre ACTIVE orphelin** (le scénario redouté) + invitation déjà brûlée si le crash est après #4.
- Crash entre #5 et #6 : org posée sans membership — rien ne le rejoue jamais.
- La route est publique (`POST /centres/register`, centre.controller.ts:178-183) : un timeout client/serveur au mauvais moment suffit.

## 2. Champs disponibles pour `findOrCreateOrganisation`

**`RegisterCentreDto`** (`dto/register-centre.dto.ts:4-57`) : `token`, `password`, `prenom?`, `nomContact?`, `nom?`, `adresse?`, `ville?`, `codePostal?`, `telephone?`, `capacite?`, `description?`, `reseau?`. **Pas de `siret`**, pas d'email (il vient de l'invitation).

**`InvitationHebergement`** (schema.prisma:805-832) : `email`, `nomCentre`, `token`, `utilisedAt`, `centreExistantId`, et le bloc pré-création : `centrePrecreerNom/Adresse/Ville/CodePostal/Capacite/`**`Siret`**`/Departement`.

Par cas — le bloc commun :1102-1115 lisant tout **depuis le centre**, l'alimentation est correcte par construction :
- **CAS 1** : données du centre pré-existant ; dédup SIREN possible si `centre.siret` non null, sinon nom+ville.
- **CAS 2** : `centrePrecreerSiret` est recopié sur `centre.siret` à la création (:1011) → **dédup SIREN opérationnelle** si l'admin l'a saisi.
- **CAS 3a** : centre APIDAE (siret rarement renseigné) → nom+ville le plus souvent, `source: 'APIDAE'` + `sourceId` posés.
- **CAS 3b** : **aucun SIRET possible** (absent du DTO) → dédup textuelle nom+ville uniquement. Ajouter `siret` optionnel au DTO serait l'alignement avec `createCentre` (décision §9 14/07 : « le SIRET saisi n'est jamais ignoré ») — extension possible, pas indispensable au Lot 0.

## 3. Signatures des helpers (`organisations/organisation.helpers.ts`)

- **`findOrCreateOrganisation(prisma, params)`** :20-93 — `params` : `nom` et `source` **requis**, tout le reste optionnel (`siren, siret, uai, rna, raisonSociale, adresse, codePostal, ville, departement, emailContact, telephoneContact, siteWeb, typeStructure, academie, sourceId`). Retour `{ organisation, created }`. Dédup en cascade : **SIREN** (`findUnique`) :43-48 → **UAI** :51-56 → **nom+ville** insensitive :59-67 → create :70-92.
- **`findOrCreateMembership(prisma, params)`** :104-137 — `userId, organisationId` requis ; `role` (déf. `PROPRIETAIRE`), `isPrimary` (déf. `true`), `claimStatut` (déf. `NON_APPLICABLE`), `claimSubmittedAt`. Idempotence via `findUnique` sur la clé composite `userId_organisationId` :115-123 — ⚠️ **retourne l'existant SANS le modifier** (pas d'upsert : un membership existant avec un autre claimStatut n'est jamais mis à jour ; sans objet dans `register()` où le user vient d'être créé).
- Les deux acceptent `PrismaLike = PrismaService | Prisma.TransactionClient` (:9) → **transactionnables tels quels** (déjà utilisés en `tx` par `registerHebergeur`, auth.service.ts:361-400, et `createCentre`).
- ⚠️ `findOrCreateMembership` n'accepte **pas** `claimValidatedAt`/`claimValidatedById` (schema:1593-1594) : pour poser un `VALIDE` daté, il faudra étendre le helper ou faire un `update` complémentaire.

## 4. Le pattern de référence `createCentre` (centre.service.ts:266-360)

- **`$transaction`** interactive, `{ timeout: 10000 }`, autour de TOUT (résolution org → create centre → dérivation claim → membership) ; mapping d'erreurs `P2002` (ConflictException) / `P2000` (BadRequestException) au catch :361-376.
- Résolution org :285-311 : (1) `dto.siret` → `findOrCreateOrganisation` (dédup SIREN) ; (2) sinon **membership VALIDE le plus ancien** (`orderBy claimValidatedAt asc`) ; (3) sinon dédup textuelle/création.
- `claimStatut` **dérivé de la relation** :339-350 : membership VALIDE du user sur cette org OU claim VALIDE d'un tiers → `NON_APPLICABLE` ; sinon `EN_ATTENTE_DOCUMENT` + `claimSubmittedAt`.

**À RÉPLIQUER dans `register()`** : la `$transaction` (helpers déjà compatibles), le mapping P2002/P2000, l'ordre « tout ou rien ».
**À ADAPTER** : (a) la résolution (2) « membership VALIDE le plus ancien » est **sans objet** — le user vient d'être créé (garde email :957-960), il n'a aucun membership ; (b) la dérivation de claimStatut est remplacée par la décision de cadrage : **`VALIDE` direct** (invitation admin = validation humaine en amont), là où `createCentre` dériverait `EN_ATTENTE_DOCUMENT`. Suggestion : poser aussi `claimValidatedAt = now()` (`claimValidatedById` restant null ou pointant l'admin émetteur de l'invitation — l'`InvitationHebergement` **ne stocke pas** l'admin créateur, donc null + commentaire).

## 5. Cascades si `register()` pose org + membership VALIDE en transaction

| Consommateur | Aujourd'hui (NON_APPLICABLE) | Après (VALIDE) | Verdict |
|---|---|---|---|
| `getOnboardingStatus` (centre.service.ts:97-107) | `justificatif = 'ABSENT'` → étape conformité **jamais ok**, la checklist réclame un justificatif à un compte invité par l'admin | `justificatif = 'VALIDE'` → conformité ok dès l'IBAN saisi | ✅ Amélioration voulue |
| `assertEnvoiExterneAutorise` (centre.helper.ts:104-123) | NON_APPLICABLE ne bloque pas (seuls EN_ATTENTE_*/REFUSE bloquent) | VALIDE ne bloque pas | = Aucun changement |
| `admin.getCentresPending` (admin.service.ts:1406-1423) | Les centres `register()` sont ACTIVE → jamais dans cette liste. Mais un **futur centre PENDING** du même user (via `createCentre`) raterait la résolution (2) (pas de VALIDE) → org potentiellement dupliquée + tunnel claim complet | Futur centre PENDING → rejoint la même org (résolution 2) et sort dans `/admin/centres/pending` | ✅ Ferme un 2e trou (invariant « tout PENDING visible » du 14/07 mieux servi) |
| `shouldRequireKbis` (organisation.helpers.ts:177-200) | Kbis exigé si ce user (ou un autre) claim l'org | Plus de Kbis sur cette org | ✅ Cohérent (déjà validé humainement) — à assumer |
| `demarrerOuAlignerTrial` (trial.helper.ts) | Scopé `userId`, ignore l'org. Le COMPLET/ACTIF **sans `trialStartedAt`** posé par `register()` = « abonnement offert » → garde b) (:62-70) → **aucun essai ne démarrera jamais** pour ce compte (ni au login, ni sur un centre ajouté) | Idem — le fix org/membership n'y touche pas | = Hors périmètre Lot 0 (mais à réconcilier au chantier abonnement-organisation : ce « offert » par centre devra devenir un état d'org) |
| `findOrCreateMembership` idempotence | — | Retourne l'existant sans update : inoffensif ici (user neuf, membership forcément absent) | = OK |
| `isPrimary: true` inconditionnel (:1127) | — | User neuf → premier membership → correct | = OK |

## 6. Tests asservis

**Aucune spec ne couvre `centre.service.register()`.** Specs existantes dans `centres/` : `centre.helper.spec.ts`, `permission.helper.spec.ts`, `trial.helper.spec.ts`, `create-centre.spec.ts` (verrouille `createCentre` uniquement, :82-173). `auth/dto/register-hebergeur.dto.spec.ts` concerne l'inscription ex-nihilo (auth), sans rapport. → **Rien ne cassera** ; le fix doit **créer** `register.spec.ts` : les 3 cas + 3a/3b, idempotence org (CAS 1 centre déjà rattaché), claimStatut VALIDE, rollback transactionnel (échec au milieu → ni user ni centre ni invitation brûlée).

## 7. SQL prod (SELECT read-only, pgsql-console, 06/08/2026) — résultats bruts

```
-- SUSPENDED orphelins (complément du census initial qui les excluait)
 orphelins_suspended | total_suspended
---------------------+-----------------
                   0 |               1

-- usage réel du chemin invitation (contexte)
 invitations_total | utilisees | en_attente
-------------------+-----------+------------
                 1 |         1 |          0
```

→ **Base 100 % couverte : 0 orphelin sur 136 centres, SUSPENDED compris.** Le prérequis données de la contrainte `NOT NULL` (Q6 du census initial) est levé. Et le chemin `register()` n'a servi **qu'une fois** en prod (1 invitation, utilisée, 0 en attente) : fenêtre de régression minuscule.

---

## Fix proposé (conceptuel, par cas — pas de code)

Commun aux 3 cas :
1. **Envelopper #1→#6 (user → centre → abonnement → org → membership → invitation) dans une `$transaction`** interactive `{ timeout: 10000 }`, pattern `createCentre`/`registerHebergeur` — les helpers acceptent déjà le `tx`. Restent hors transaction, après commit : notif admin (#2), JWT/refresh (#7).
2. **Déplacer `invitation.utilisedAt` en DERNIER write de la transaction** : un échec ne brûle plus l'invitation (aujourd'hui elle est consommée avant le bloc org).
3. **Membership `claimStatut: 'VALIDE'`** (+ `claimValidatedAt = now()`, `claimValidatedById = null` faute d'admin tracé sur l'invitation) au lieu de `NON_APPLICABLE` — nécessite d'étendre `findOrCreateMembership` (2 params optionnels) ou un `update` dans la même transaction.
4. **Fusionner les deux `update` consécutifs du centre** (statut puis abonnement) en un seul write par cas — micro-simplification qui réduit encore les fenêtres.
5. Mapping d'erreurs `P2002`/`P2000` au catch, comme `createCentre` :361-376.
6. **Nouvelle spec `register.spec.ts`** (cf. §6).

Par cas, rien d'autre ne change : le bloc org commun :1099-1121 est déjà correct (idempotent « si null », alimenté du centre, source APIDAE tracée). Option hors périmètre minimal : ajouter `siret?` au `RegisterCentreDto` pour donner une dédup SIREN au CAS 3b.

## Risques de cascade du fix

- **`VALIDE` est un choix qui engage** : il court-circuite Kbis (`shouldRequireKbis`) et le tunnel claim pour cette org, et fait sortir les futurs centres PENDING du user dans `/admin/centres/pending`. C'est le comportement voulu (« invitation admin = pré-validé ») — à écrire noir sur blanc dans la décision §9.
- **Timeout de transaction** : bcrypt (#0, hors tx) et les emails restent dehors ; le contenu transactionnel est purement DB, 10 s largement suffisants.
- **`checkInvitation`** (centre.controller.ts:174-175, service :1150+) : lecture seule, non touchée.
- **Aucun test existant ne casse** (§6). Les 4 chemins de création de centre restants (`createCentre`, `registerHebergeur`, claim, admin) sont hors périmètre et déjà corrects.
- Prod : 1 seule invitation jamais utilisée depuis mai → le fix peut se déployer sans backfill ni migration (zéro donnée à corriger).

---

*Census phase 1 réalisé en lecture seule le 06/08/2026. SQL prod : SELECT uniquement. STOP — pas de code écrit.*
