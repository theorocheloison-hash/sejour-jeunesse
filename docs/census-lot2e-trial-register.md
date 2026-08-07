# Census Lot 2e — trial → organisation + register() (Lot 0 intégré) — conception, lecture seule

**Date : 06/08/2026 — LECTURE SEULE.** Aucun fichier modifié. Références : `docs/census-lot0-register.md` (pas-à-pas register, non refait ici), `docs/census-lot2-abonnement-org.md` §5-§7, `docs/census-lot2a-service.md` (double écriture). Code au commit courant (L2a mergé).

Décision Q4 actée : **« une organisation = un essai »** — amende la décision §9 du 14/07 (« un compte = un essai ») ; la roadmap devra être mise à jour au merge de ce lot.

---

## 1. `demarrerOuAlignerTrial` — forme actuelle et forme cible

**Actuelle** (`centres/trial.helper.ts:37-147`) : `(prisma, email: { sendNotifAdmin }, userId)` — helper pur, try/catch total. Lit `findMany({ where: { userId } })` (:45-57, select id/nom/statut/trial/statut abo/exp/mandat/modePaiement). Gardes : a) compte payant (mandat OU VIRETMENT sur un centre, :60) ; b) offert (ACTIF sans trial ni mandat, :62-70) ; c) éligibles = ACTIVE + vierges (:73-79) ; d) référence = trialStartedAt non null le plus récent (:83-85). **Alignement** = `updateMany({ id: { in: eligibles }, trialStartedAt: null })` avec LES VALEURS du centre référence (:97-105, jamais de prolongation) ; sinon nouveau trial 30j (:111-119). Notifs par centre éligible (:131-143).

**Cible** : `(prisma, email, organisationId)` — reste PUR, même patron. L'« alignement » inter-centres disparaît comme mécanisme de vérité (l'état est UN, sur l'org) et devient un **miroir** :

```
1. org = organisation.findUnique(organisationId, select trial/mandat/modePaiement/statut/exp/plan) ; !org → return
2. Gardes (sur l'ORG) :
   a) payante : org.mollieMandatId OU org.modePaiement === 'VIREMENT' → return
   b) offerte : ACTIF sans trialStartedAt ni mandat → return (Sauvageon, register COMPLET)
   c) trialStartedAt non null :
      - essai EXPIRÉ (exp ≤ now ou null) → return (jamais de 2e essai)
      - essai EN COURS → pas de write org ; MIROIR seulement : aligner les centres
        exploités nouvellement ACTIVE encore vierges (cf. 4) + notif « ajouté à l'essai »
   d) org vierge (INACTIF, ni trial ni mandat) :
      - centresEligibles = findMany({ organisationId, statut: 'ACTIVE', userId: { not: null }, trialStartedAt: null })
      - AUCUN centre ACTIVE exploité → return (invariant : un PENDING ne consomme jamais l'essai — porté au niveau org)
      - sinon : organisation.update { PILOTAGE, ACTIF, trialStartedAt: now, abonnementActifJusquAu: trialExpiration() }
3. MIROIR centres (cas c-en-cours et d) : updateMany({ organisationId, statut: 'ACTIVE',
   userId: { not: null }, trialStartedAt: null }, data = valeurs de l'org)
   — garde `trialStartedAt: null` conservée : ne réécrit jamais un timestamp historique
   (cas YAKA, dérive de ms bénigne, L3 cessera de lire les centres)
4. Notifs admin par centre miroité (capturés AVANT l'update, comme aujourd'hui :124-125)
```

`trialExpiration()`/`TRIAL_DUREE_JOURS` (:5-15) inchangés.

## 2. Les 4 appelants — résolution de l'organisationId

Règle transverse : **l'org du/des centre(s) concerné(s) par l'ACTION — jamais `getOrganisationPrincipale`** (isPrimary désignerait une org arbitraire en multi-société).

| Appelant | Appel | Résolution de l'org | Multi-société |
|---|---|---|---|
| **validerClaim** | claim.service.ts:624 | **L'a déjà** : `membership.organisationId` (les updateMany :613-620 activent précisément les centres de CETTE org) | Trivial : l'org du claim validé, aucune ambiguïté |
| **activerCentre** | admin.service.ts:1440 | Dérivée du **centre activé** : `centre.organisationId` (centre chargé :1427-1430 sans select → champ dispo). Si null (théorique, 0 en prod) → skip + log | L'org du centre qu'on vient d'activer — c'est l'action |
| **validerHebergeur** | admin.service.ts:127 | À dériver : l'updateMany :122-125 active TOUS les centres du user → `findMany({ where: { userId: id }, select: { organisationId: true }, distinct: ['organisationId'] })` → **boucle : 1 appel helper par org non-null** | Chaque org dont un centre vient d'être activé reçoit SON traitement (les gardes org filtrent ensuite org par org) |
| **login** | auth.service.ts:648-650 | **Cas délicat — question ouverte §7.** Le login est un FILET « première connexion » (comptes dont les centres étaient déjà ACTIVE avant la règle du 07/07, chemins d'activation ratés) sans centre précis. Option (i) proposée : itérer sur les orgs des centres **possédés** du user (même `findMany distinct` que validerHebergeur — fidèle au comportement actuel, qui filtre par `userId` propriétaire, jamais les collaborateurs :644-647). Option (ii) : supprimer l'appel (couvert par les 3 autres chemins + register) — mais perd le filet pour les comptes legacy ACTIVE sans trial | (i) : chaque org de SES centres est un candidat, les gardes org décident ; (ii) : sans objet |

## 3. `register()` — diff (Lot 0 + abo sur l'org)

Pas-à-pas actuel et fix détaillés dans **`census-lot0-register.md`** (§1 ordre des 8 writes hors transaction, § « Fix proposé ») — non refaits ici. Ce qui change/se confirme pour L2e :

- **`$transaction` interactive** (`{ timeout: 10000 }`, patron `createCentre` :273-360 / `registerHebergeur` auth.service.ts:361-400) englobant : user.create → centre (create/update selon cas, **sans** le bloc abo) → **résolution org + membership** (remontés AVANT l'abo — inversion de l'ordre actuel où l'org vient en :1099-1121 après tout) → **abo COMPLET offert sur l'ORG + miroir centre** (`{ planAbonnement: 'COMPLET', abonnementStatut: 'ACTIF', abonnementActifJusquAu: trialExpiration() }`, **sans trialStartedAt** — sémantique « offert », garde b du helper) → **`invitation.utilisedAt` en DERNIER write**. Hors transaction, après commit : notif admin, JWT/refresh. bcrypt AVANT la transaction.
- **Helpers compatibles tx confirmés** : `PrismaLike = PrismaService | Prisma.TransactionClient` (organisation.helpers.ts:9), déjà utilisés en `tx` par registerHebergeur et createCentre.
- **`claimStatut: 'VALIDE'` + `claimValidatedAt`** : `findOrCreateMembership` n'accepte pas `claimValidatedAt/ById` (params :104-113) → **étendre le helper** (2 params optionnels, défauts null — rétro-compatible) plutôt qu'un update post-create (1 write de moins, atomique par nature). `claimValidatedById: null` (l'InvitationHebergement ne trace pas l'admin émetteur, schema:805-832).
- **Miroir centre de l'abo** : update du centre du cas courant (CAS 1/2/3) avec le même `data` — dans la transaction.
- **Resync post-commit : inutile** (l'org d'un register vient de naître ou n'a pas de subscription → no-op garanti) — ne pas l'appeler, le documenter.
- **Cascades** (détail census L0 §5, verdicts inchangés) : `getOnboardingStatus` → `justificatif: 'VALIDE'` (checklist cohérente pour un compte invité par l'admin ✅) ; `shouldRequireKbis` → plus de Kbis sur cette org (voulu : invitation admin = validation humaine — à écrire dans la décision §9) ; `getCentresPending` → les futurs centres PENDING du user sortent dans la bonne liste + rejoignent la même org via la résolution (2) de createCentre ✅ ; `assertEnvoiExterneAutorise` → inchangé (VALIDE ne bloque pas).

## 4. Re-backfill final (filet, dans le commit L2e)

- **Emplacement** : `backend/prisma/migrations/<ts>_rebackfill_abonnement_org/migration.sql` (convention standard, appliquée par `migrate deploy` au boot AVANT le code L2e).
- **Forme** : rejeu **verbatim** du bloc c) de `20260806150000_abonnement_organisation/migration.sql` (le `WITH ref AS (SELECT DISTINCT ON (organisation_id) … ORDER BY <classement total>) + alerte AS (MAX) + UPDATE organisations`). Rien d'autre — pas de re-ADD de colonnes (elles existent), pas de re-CREATE d'index.
- **Sûreté du rejeu confirmée** : le `DISTINCT ON` a un ordre TOTAL (mandat > VIREMENT > plan > exp NULLS LAST > non-SUSPENDED > created_at > id) → déterministe, même entrée = même sortie ; l'UPDATE pose des valeurs absolues (aucun incrément) → idempotent. Interaction avec L2a : les centres étant devenus MIROIRS de l'org (double écriture), recopier centre→org est un no-op sur les chemins déjà migrés ; il ne répare que les writes centre-seuls de la fenêtre L1→L2e (trial/register). Divergence dangereuse mesurée aujourd'hui : 0 (seul YAKA, dérive de timestamp bénigne — le rejeu recopiera la même référence Florimont, YAKA reste tel quel : sans conséquence).

## 5. Specs

| Spec | Impact |
|---|---|
| `centres/trial.helper.spec.ts` (7 cas, :63-172) | **Les 7 cassent** (signature userId→organisationId, mocks `findMany({userId})` → `organisation.findUnique` + centres de l'org + `organisation.update`). Réécriture : gardes org (payante a, offerte b, essai expiré c), nouveau trial d (write org + miroir `{ organisationId, statut ACTIVE, userId not null, trialStartedAt null }`), miroir « centre ajouté à l'essai en cours », **org PENDING-only → rien**, notifs par centre |
| `auth/auth.service.spec.ts` (:10, :53-123) | **Casse** : exerce le trial via `login()` avec des mocks centre-scopés (`arg.where {id in, trialStartedAt null}` :107/115) → à réécrire pour la résolution distinct-orgs du login (selon l'option retenue §7) + mocks organisation |
| `centres/create-centre.spec.ts` | Intact (createCentre n'appelle pas le trial) |
| `admin/refuser-centre.spec.ts` | Intact |
| **`register.spec.ts` — À CRÉER** (aucune spec aujourd'hui, census L0 §6) | 3 cas + 3a/3b, rollback transactionnel (échec à mi-course → ni user ni centre ni invitation brûlée), claimStatut VALIDE + claimValidatedAt, abo COMPLET sur l'org + miroir, utilisedAt dernier write |
| `organisation.helpers` (pas de spec dédiée) | Extension findOrCreateMembership rétro-compatible — couverte via register.spec |

## 6. CASCADES / RISQUES

- **Login qui n'alignerait plus (option ii)** : les comptes legacy à centres ACTIVE sans essai ne démarreraient plus jamais leur trial — c'est le filet historique du 07/07. Recommandation : option (i), coût identique à l'actuel (1 findMany par login HEBERGEUR).
- **Mauvaise org en multi-société** : neutralisé par la règle « l'org de l'action » (tableau §2) et l'interdiction de `getOrganisationPrincipale`. validerHebergeur/login itèrent sur TOUTES les orgs des centres du user — les gardes org (payante/offerte/expirée) font le tri org par org, aucun essai croisé possible.
- **Transaction register à mi-course** : tout-ou-rien désormais — plus de user à email consommé ni de centre orphelin ; l'invitation (utilisedAt dernier) reste utilisable après un échec. Emails/JWT après commit : un échec d'email ne rollbacke rien (fire-and-forget existant conservé).
- **Miroir trial multi vs mono-centre** : mono-centre = comportement identique à aujourd'hui ; multi-centre = TOUS les centres exploités ACTIVE vierges de l'org s'alignent en un updateMany (aujourd'hui c'était par userId — différence réelle uniquement pour une org à plusieurs propriétaires de centres, cas inexistant en prod).
- **`claimStatut VALIDE` court-circuite `shouldRequireKbis`** : voulu (invitation admin = pré-validation humaine) — à consigner dans les décisions §9 de la roadmap au merge, avec l'amendement Q4.
- **Fenêtre résiduelle** : entre le deploy L2a (fait) et le deploy L2e, les 4 chemins trial écrivent encore le centre seul — divergence dangereuse mesurée 0 aujourd'hui, le re-backfill du commit L2e la referme au boot même si un essai naît entre-temps.
- **Notifs admin** : le helper notifie par centre miroité — une org multi-centres vierge génère N notifs « Nouveau trial » (une par centre) comme aujourd'hui pour un user multi-centres ; acceptable, ne pas sur-ingénierer.

## 7. Questions ouvertes

1. **Le login (PRIORITAIRE)** : option (i) filet conservé en itérant sur les orgs des centres possédés (recommandée), ou (ii) suppression de l'appel au login. À trancher par Théo avant la Phase 2.
2. Le miroir doit-il forcer `trialStartedAt` sur un centre qui en porte déjà un divergent (cas YAKA) ? Proposé : NON (garde `trialStartedAt: null` conservée, dérive bénigne, L3 coupe les lectures centre).
3. Amendements roadmap §9 au merge : « une organisation = un essai » (remplace 14/07) + « invitation admin ⇒ claimStatut VALIDE (Kbis court-circuité) ».

---

*Census Lot 2e réalisé en lecture seule le 06/08/2026. STOP — zéro écriture.*
