# Rapport — Flux inscription hébergeur ex-nihilo (A/B/C)

**Date :** 13/07/2026
**Branche :** `main` (3 commits locaux, non poussés)
**Chantier :** bloc URGENT roadmap — atomicité inscription + validation SIRET + motDePasseDefini

## Commits

| Commit | Périmètre |
|---|---|
| `60eb12f` | (A) Atomicité `registerHebergeur()` + élargissement type des helpers |
| `b1bbcd4` | (B) `@Length(14,14)` SIRET sur les 3 DTO + tests 13/15 chiffres |
| `5e59e28` | (C) `motDePasseDefini: true` dans `centre.service.register()` |

## A — Atomicité (`backend/src/auth/auth.service.ts`)

Bug racine : `$transaction([user.create])` seul, `centre.create` et tout le rattachement
organisation/membership hors transaction. Échec en aval → user orphelin, email pris à vie
(cas Louise Giard / PULSE SPORTS).

**Nouveau flux mode normal** — transaction interactive `$transaction(async tx => {...}, { timeout: 10000 })` englobant, dans l'ordre :
1. `user.create`
2. `centreHebergement.create` (statut PENDING)
3. `findOrCreateOrganisation(tx, …)`
4. `centre.update({ organisationId })`
5. vérification `claimValideAutre` (anti-claim concurrent)
6. `findOrCreateMembership(tx, …)` (EN_ATTENTE_DOCUMENT ou NON_APPLICABLE)
7. `consentementRgpd.create` — **entré dans la transaction** (sinon rollback = user annulé
   mais trace DPA orpheline… ou pire, user commité sans trace DPA)

**Après commit uniquement :** `collaborateurCentre.updateMany` (non critique),
`invitationCentreExterne.updateMany` (avec `centre.id` lu depuis le **retour** de la
transaction), `notifyAdminNewAccount`, `sendVerificationEmail`, `sendHebergeurAccountPending`.
L'admin n'est plus notifié de comptes sans centre.

**Mapping d'erreur** (fini le 201 mensonger et le 500 opaque) :
- `P2002` → 409 `ConflictException('Cet email est déjà utilisé')` — course entre le
  `findUnique` d'entrée et le commit.
- `P2000` (valeur trop longue / VarChar dépassé) → 400 avec message FR incluant la colonne
  si Prisma la fournit.
- Reste → rethrow (500) **après** `console.error` détaillé avec l'email du prospect —
  visible dans les logs Scalingo.

**Invariants respectés :**
- `bcrypt.hash` hors transaction (inchangé).
- Mode `claimCatalogueId` strictement inchangé : le bloc claim (tentative
  `claimFromCatalogue`, gestion `claimError`, RGPD, emails, shape de réponse) est identique.
  Seul changement mécanique : le `user.create` partagé (ex-`$transaction([create])`, sémantique
  identique à un `create` simple) vit désormais dans la branche claim, et
  `notifyAdminNewAccount` y est appelé au même point qu'avant, mêmes arguments.
- Le try/catch qui avalait l'échec organisation/membership a disparu : rollback complet.
- Aucun email dans la transaction.

**Helpers** (`organisation.helpers.ts`) : `findOrCreateOrganisation` et
`findOrCreateMembership` acceptent désormais `PrismaLike = PrismaService | Prisma.TransactionClient`.
Aucune duplication ; tous les appelants (`registerOrganisateur`, `registerSignataire`,
`createCentre`, `materialiserCentreEN`, `claim.service`, `admin.service`, `public.service`,
`centre.service.register`) compilent sans changement — vérifié par `tsc --noEmit`.

**Point 10 (spec) :** `auth.service.spec.ts` ne mocke pas `$transaction` et ne teste pas
`registerHebergeur` → rien à adapter. Suite verte.

## B — SIRET `@Length(14,14)` (3 DTO)

Message : `Le SIRET doit contenir exactement 14 chiffres.`

- **b1** `auth/dto/register-hebergeur.dto.ts` : `@Length` ajouté après le `@Transform` de
  strip existant (class-transformer s'exécute avant class-validator — `transform: true`
  au ValidationPipe global).
- **b2** `centres/dto/create-centre.dto.ts` : ajout du **couple** `@Transform` (strip
  espaces/points/tirets) + `@Length` — le frontend d'ajout de centre envoie le SIRET brut,
  `@Length` seul aurait été un régresseur.
- **b3** `centres/dto/update-centre.dto.ts` : même couple. Vérifié côté frontend
  (`dashboard/hebergeur/profil/page.tsx:181`) : `siret: form.siret || undefined` → clé
  absente quand vide, l'édition sans SIRET n'est pas affectée.
- **b4 (vérifié AVANT commit)** : `CreateCentreDto` n'est référencé que par
  `POST /centres` (`centre.controller.ts:162`). Les syncs LMDJ/APIDAE et imports de
  centres ne passent pas par ce DTO → **aucun import cassé**.

**Tests** (`register-hebergeur.dto.spec.ts`) : +5 cas — 13 chiffres (rejet), 15 chiffres
(rejet), 14 chiffres (accepté), 14 chiffres avec espaces (strip avant validation, accepté),
absent (`@IsOptional` skippe). 9/9 verts.

**Rappel phase 1 :** les 3 formulaires frontend envoient `siret: form.siret || undefined`
et axios supprime les clés `undefined` du JSON → la clé est absente quand le champ est
vide, `@IsOptional` skippe, aucune inscription sans SIRET ne casse.

## C — `motDePasseDefini` (`centre.service.ts` l.952)

`motDePasseDefini: true` ajouté au `user.create` de `register()` (POST /centres/register,
inscription via invitation). Sans lui, `login()` compare contre `DUMMY_HASH`
(`auth.service.ts:535`) → reconnexion impossible. Bug dormant en prod (aucun compte avec
`mot_de_passe_defini=false`), corrigé avant la réparation du routage cas 2 qui rendra ce
chemin actif.

## Vérifications

- `tsc --noEmit` : 0 erreur (avant chacun des 3 commits).
- `npm run build` (prisma generate + nest build) : exit 0 (avant chacun des 3 commits).
- `jest src/auth src/organisations src/centres` : **106/106 verts** après les 3 commits.
- Aucune migration Prisma, aucun changement de schéma, aucun changement de contrat API
  (mêmes routes, mêmes shapes de réponse).
- Les 4 méthodes admin de `centre.service.ts` et les routes `/centres/admin/*` : intouchées.

## Points d'attention pour la relecture

1. **Validation centre avant création du user** : auparavant, un payload mode normal sans
   adresse/ville/CP/capacité créait le user PUIS levait le 400 (email brûlé au passage).
   La vérification est désormais placée avant la transaction : 400 identique, plus aucune
   écriture. C'est un durcissement voulu, même contrat API.
2. En mode claim, `notifyAdminNewAccount` part toujours avant la tentative de claim
   (position historique conservée) ; en mode normal il part après commit.
3. `sendVerificationEmail` / `sendHebergeurAccountPending` restent `await`és (comportement
   historique) : un échec SMTP après commit renvoie une erreur au prospect alors que le
   compte existe. Hors périmètre, mais candidat à un `.catch` fire-and-forget.

## Preuve de rollback sur vraie base (13/07/2026)

Méthode : Postgres 16 jetable (conteneur Docker `liavo-rollback-proof`, port 55432,
schéma appliqué par `prisma db push`), puis appel du **vrai `AuthService` compilé**
(`dist/src/auth/auth.service.js`) avec le vrai `PrismaService` (adapter pg) — aucun mock
de `$transaction`, seuls les emails sont stubbés (déjà fire-and-forget post-commit).
Sabotage : `nomCentre` de 300 caractères > `VarChar(255)` → P2000 dans
`centreHebergement.create`, c'est-à-dire APRÈS `user.create`, au milieu de la transaction.
Aucune modification du code source (valeur injectée via le DTO du script de test).

**1. Inscription sabotée** → `BadRequestException` (400) « Une des informations saisies
est trop longue. Corrigez-la puis réessayez. » (le mapping P2000 fonctionne aussi).

**2. Base après l'échec** (sortie psql brute) :

```
           table_           | lignes_email
----------------------------+--------------
 utilisateurs               |            0
 centres_hebergement        |            0
 consentements_rgpd         |            0
 organisations              |            0
 memberships                |            0
 utilisateurs (TOTAL table) |            0
```

**3. Réinscription immédiate avec LE MÊME email, données valides** → succès
(« Inscription réussie. Votre compte est en attente de validation. ») :

```
                email                 |   role    | mot_de_passe_defini |         centre         | statut  |     siret      |    claim_statut     |      organisation      | consentements
--------------------------------------+-----------+---------------------+------------------------+---------+----------------+---------------------+------------------------+---------------
 louise.preuve-rollback@test.liavo.fr | HEBERGEUR | t                   | Centre Preuve Rollback | PENDING | 81374122000020 | EN_ATTENTE_DOCUMENT | Centre Preuve Rollback |             1
```

Plus `organisation_liee = t` sur le centre (le `centre.update(organisationId)` de la
transaction est bien appliqué). `git status` propre (hors ce rapport non tracké),
conteneur jetable détruit après la preuve.

**Conclusion : l'échec au milieu de la transaction ne laisse RIEN en base et l'email est
réutilisable immédiatement — le scénario Louise Giard est éteint.**

**Non poussé** — relecture Théo puis push.
