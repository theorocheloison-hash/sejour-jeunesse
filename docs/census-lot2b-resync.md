# Census Lot 2b — helper `resyncMontantOrganisation` (conception, lecture seule)

**Date : 06/08/2026 — LECTURE SEULE.** Aucun fichier modifié, SQL prod en SELECT uniquement. Référence : `docs/census-lot2-abonnement-org.md` §2, §3, §9. Ce document CONÇOIT le helper ; il ne l'écrit pas.

---

## 1. Signature Mollie confirmée (`@mollie/api-client@4.5.0` installé)

Les deux copies de types sont **identiques** (`dist/types/binders/customers/subscriptions/parameters.d.ts` et `dist/types/src/binders/customers/subscriptions/parameters.d.ts`, lignes 1-13) :

- `UpdateParameters` (`parameters.d.ts:11`) = `ContextParameters (customerId: string) & Pick<SubscriptionData, 'mandateId'> & PickOptional<…, 'amount' | 'description' | 'interval' | 'metadata' | 'startDate' | 'times' | 'webhookUrl'>` → **`customerId` ET `mandateId` REQUIS**, `amount` optionnel. (La doc Mollie dit « each field is optional » — le SDK 4.5.0 exige `mandateId` : passer `org.mollieMandatId` systématiquement.)
- `update(id, parameters)` : `CustomerSubscriptionsBinder.d.ts:60-61` ; doc-comment :53-58 : « Some fields of a subscription can be updated by calling PATCH […] **You cannot update a canceled subscription.** » Prise d'effet au prochain cycle, pas de prorata (doc Mollie update-subscription).

**Forme d'appel exacte à écrire :**
```ts
await mollie.customerSubscriptions.update(org.mollieSubscriptionId, {
  customerId: org.mollieCustomerId,   // requis
  mandateId:  org.mollieMandatId,     // requis par le type SDK 4.5.0 (pas par l'API)
  amount: { currency: 'EUR', value: centsToMollie(montantCents) }, // "123.00"
});
```

## 2. `calculerMontantAbonnementCents` (abonnement.constants.ts:25-34)

`calculerMontantAbonnementCents(plan: string, frequence: string, nbCentresActifs: number): number` — **centimes**. Prix plan (`PRIX_MENSUEL/ANNUEL` :7-16, plan inconnu → 0) + `max(0, n-1)` × supplément (`CENTRE_SUPP_MENSUEL = 3900` / `CENTRE_SUPP_ANNUEL = 39000`, :17-18). Fréquence : passer `org.abonnement ?? 'MENSUEL'` (même fallback que le webhook actuel, abonnement.service.ts:395).

⚠️ Dépendance manquante : **`centsToMollie` est privée dans `abonnement.service.ts:15-17`** (`(cents/100).toFixed(2)`). À déplacer dans `abonnement.constants.ts` (export) au Lot 2b — le service et le helper l'importeront du même endroit.

## 3. Modèle `Organisation` post-L1 — champs confirmés lisibles

`schema.prisma` (modèle Organisation) : `abonnement` :1577 (fréquence, nullable), `abonnementStatut` :1579, `planAbonnement` :1580, `mollieCustomerId` :1581, `mollieSubscriptionId` :1582, `mollieMandatId` :1583, `modePaiement` :1586. Tous `@map` snake_case alignés sur la migration L1 (déployée + vérifiée en prod le 06/08). Rien à ajouter au schéma pour le helper.

## 4. Patron « helper pur » : `trial.helper.ts` + sa spec

- **Réception des dépendances** (trial.helper.ts:37-41) : fonction exportée `(prisma: PrismaService, email: { sendNotifAdmin: … }, userId)` — prisma typé nominalement (`import type`), **email typé STRUCTURELLEMENT** avec doc-comment « ce helper ne doit pas importer EmailService (aucune dépendance de module, aucun cycle possible) » (:32-35). Erreurs englouties par un try/catch total : « Non bloquant : un échec ne doit JAMAIS faire échouer un login… » (:34-36, :144-146).
- **Import/appel** : import direct de la fonction (`import { demarrerOuAlignerTrial } from '../centres/trial.helper.js'`) depuis auth.service, claim.service, admin.service — aucun module NestJS, aucun provider.
- **Mock en spec** (trial.helper.spec.ts:14-30, 46-55) : `mockPrisma()` = objet littéral `{ centreHebergement: { findMany: jest.fn(), updateMany: jest.fn() }, user: { findUnique: jest.fn() } }` casté, `email = { sendNotifAdmin: jest.fn() }`, `console.error` spié. Zéro TestingModule — c'est le patron à répliquer pour la spec du resync.

## 5. Client Mollie : injection en paramètre (préféré) + singleton partagé

Instanciation actuelle : `abonnement.service.ts:11-13` — `const mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY ?? '' })` au niveau module, privé au fichier. Les futurs appelants (admin.service, claim.service, centre.service) n'ont pas de client.

**Forme la plus testable (proposée)** :
1. Nouveau `abonnements/mollie.client.ts` : le singleton déménagé (3 lignes), exporté ; `abonnement.service.ts` l'importe (suppression de sa copie locale).
2. Le helper le reçoit **en paramètre**, typé **structurellement** (patron email de trial.helper — pas d'import de type Mollie, pas de couplage de version) :
```ts
export async function resyncMontantOrganisation(
  prisma: PrismaService,
  mollie: { customerSubscriptions: { update: (id: string, params: Record<string, unknown>) => Promise<unknown> } },
  organisationId: string,
): Promise<void>
```
3. Les appelants font `resyncMontantOrganisation(this.prisma, mollieClient, orgId).catch(err => console.error('[resync]', err))` — fire-and-forget hors transaction. En spec : `mollie = { customerSubscriptions: { update: jest.fn() } }`, aucun mock de module.

(Alternative écartée : ré-instancier dans le helper — non testable sans mocker `@mollie/api-client` entier, et 1 client par appel.)

## 6. Corps conceptuel du helper (pseudo-code, à écrire en Phase 2)

```
resyncMontantOrganisation(prisma, mollie, organisationId):
  try:
    org = prisma.organisation.findUnique(id, select: mollieSubscriptionId, mollieCustomerId,
                                          mollieMandatId, planAbonnement, abonnement)
    si !org OU !org.mollieSubscriptionId OU !org.mollieCustomerId OU !org.mollieMandatId → return (NO-OP :
      org inexistante / trial / offert / virement — rien à patcher)
    n = prisma.centreHebergement.count({ organisationId, statut: 'ACTIVE', userId: { not: null } })
      // userId NOT NULL = centres EXPLOITÉS ; exclut les fiches catalogue APIDAE/LMDJ (admin.service.ts:888, :1124)
    montant = calculerMontantAbonnementCents(org.planAbonnement, org.abonnement ?? 'MENSUEL', n)
    si montant <= 0 → log + return (plan inconnu : ne jamais patcher un montant nul)
    mollie.customerSubscriptions.update(org.mollieSubscriptionId,
      { customerId, mandateId, amount: { currency: 'EUR', value: centsToMollie(montant) } })
    log succès (orgId, n, montant)
  catch err:
    console.error('[resync] échec organisation', organisationId, err)   // JAMAIS de throw
```
Contraintes tenues par construction : helper pur (aucun import de module Nest), pas de paramètre `tx` (inappelable dans une transaction), try/catch total (un échec Mollie ne remonte jamais), idempotent (PATCH du même montant = no-op Mollie). Auto-correction résiduelle : le webhook rappelle le resync à chaque prélèvement (décision §3 du census L2) — un patch raté est réparé au cycle suivant.

## 7. Structure de la spec neuve (`abonnements/resync-montant.helper.spec.ts`)

Patron trial.helper.spec (mocks littéraux, pas de TestingModule) :
1. **No-op sans subscription** : org `mollieSubscriptionId: null` → `mollie.customerSubscriptions.update` JAMAIS appelé, `count` jamais appelé (ou toléré), aucune erreur.
2. **No-op org introuvable** : `findUnique → null` → aucun appel Mollie.
3. **Montant correct N centres** : org PILOTAGE/MENSUEL avec subscription, `count → 3` → update appelé avec `{ customerId, mandateId, amount: { currency: 'EUR', value: '147.00' } }` (6900 + 2×3900 = 14700 cts — erratum : une première version de ce doc disait 14680, erreur d'arithmétique attrapée par la spec) — vérifier aussi le `where` du count : `{ organisationId, statut: 'ACTIVE', userId: { not: null } }` (le cœur de l'exclusion catalogue).
4. **Fréquence annuelle + fallback** : `abonnement: null` → calcul en MENSUEL ; `abonnement: 'ANNUEL'` → montant annuel.
5. **Échec Mollie non-bloquant** : `update` rejette → la promesse du helper RÉSOUT (pas de throw), `console.error` appelé.
6. **Montant nul** : plan inconnu/`DECOUVERTE` → return sans appel Mollie.

## 8. SQL prod (SELECT read-only, 06/08/2026) — résultat brut

```
             nom              | exploites | catalogue 
------------------------------+-----------+-----------
 Pôle Montagne                |         2 |         0
 PULSE SPORTS CAMPUS VALLOIRE |         2 |         0
(2 rows)
```

→ **`catalogue = 0` partout** : aucune org multi-centre n'a de fiche catalogue non revendiquée dans son périmètre. Le comptage actuel (par userId) n'est pas faussé aujourd'hui ; la clause `userId: { not: null }` est **préventive** (elle deviendra critique à la première org dont le SIREN matche des fiches APIDAE importées — scénario Tereva).

## 9. Cascades / risques

- **Ordre d'appel aux transitions** : le resync doit lire l'état POST-commit (compter les centres APRÈS l'updateMany d'activation). Fire-and-forget lancé après l'await de l'update → séquencement naturel ; ne jamais le déplacer avant.
- **Course entre deux transitions rapprochées** (ex. validerHebergeur active 2 orgs, ou 2 activations simultanées) : deux resyncs concurrents PATCHent la même subscription — le dernier gagne, et les deux recalculent depuis la base → convergent vers le même montant. Pas de verrou nécessaire.
- **`abonnementStatut` non consulté** : une org annulée (subscription cancel côté LIAVO → `mollieSubscriptionId: null`, abonnement.service.ts:436-443) est no-op par la garde subscription. Une subscription annulée CÔTÉ MOLLIE mais encore référencée en base → `update` lève (« cannot update a canceled subscription ») → attrapé, loggé, sans effet. Acceptable ; le log est le signal.
- **`montant <= 0`** : plan `DECOUVERTE`/inconnu retourne 0 (`?? 0`, abonnement.constants.ts:31) — garde explicite pour ne jamais patcher une subscription à 0,00 € (Mollie la refuserait ou, pire, l'accepterait).
- **Typage structurel du client** : si le SDK change la forme d'update (v5), le helper compile encore — la spec d'intégration (forme d'appel exacte, §7 cas 3) est le filet. Documenter dans le doc-comment que `mandateId` est requis par le TYPE 4.5.0.
- **Cycle de modules : aucun.** Helper pur importé par fonction, `mollie.client.ts` sans décorateur — le graphe NestJS n'est pas touché (patron trial.helper prouvé sur 4 appelants).
- **Secret Mollie en local/CI** : `MOLLIE_API_KEY` absent → `createMollieClient({ apiKey: '' })` au chargement du module — comportement ACTUEL déjà (abonnement.service.ts:11-13), le déménagement dans `mollie.client.ts` ne change rien ; les specs n'importent jamais le singleton (client mocké en paramètre).

---

*Census Lot 2b réalisé en lecture seule le 06/08/2026. STOP — zéro écriture.*
