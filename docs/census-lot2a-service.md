# Census Lot 2a — abonnement.service.ts basculé sur l'Organisation (conception, lecture seule)

**Date : 06/08/2026 — LECTURE SEULE.** Aucun fichier modifié. Référence : `docs/census-lot2-abonnement-org.md` §4, §9. Code au commit courant (L2b mergé : `resync-montant.helper.ts`, `mollie.client.ts`, `centsToMollie` exporté de `abonnement.constants.ts:25-27`).

---

## ⚠️ DÉCISION PRÉALABLE À TRANCHER — stratégie de déploiement (le cadrage L2 est en tension avec la cadence réelle)

Le census L2 posait « **L2 (écritures) et L3 (lectures) déployés ENSEMBLE** » — or la cadence réelle de ce chantier est *un sous-lot = un push = un deploy* (L1, L2b déjà déployés isolément, sans risque car inertes). **L2a n'est PAS inerte** : s'il part seul en écrivant l'org SANS plus écrire le centre, `PlanGuard`/`demande.service`/`rooming`/cron (L3, lisant encore le centre) verront un abonnement centre périmé → features coupées pour tout nouveau souscripteur/trial. Deux options :

- **(a) DOUBLE ÉCRITURE transitoire (RECOMMANDÉ)** : L2a écrit l'org **ET** continue d'écrire le centre à l'identique (mêmes champs, mêmes valeurs). L'org devient la source naissante, le centre reste un miroir entretenu. L3 basculera les lectures puis supprimera les writes centre. Chaque sous-lot reste déployable seul, zéro fenêtre de régression, coût = quelques lignes temporaires.
- (b) Un seul deploy L2a+L3 : fidèle au cadrage initial mais impose de geler les pushes — contraire à la pratique de la session, fenêtre de merge longue, risque humain.

Le reste de ce census est écrit pour **(a)** ; si (b) est choisi, retirer simplement les writes centre des diffs ci-dessous.

## 1. Diff conceptuel des 8 méthodes (`abonnements/abonnement.service.ts`)

**Socle commun** : résolution = `getCentreForUser(prisma, userId, centreId)` (inchangé) → `const organisationId = centre.organisationId` ; si null → `ConflictException` 409 « Ce centre n'est rattaché à aucune organisation » (0 cas en prod, fail-fast). Import du singleton `mollieClient` depuis `./mollie.client.js` et de `centsToMollie` depuis `./abonnement.constants.js` (§5).

| Méthode | Lignes | Diff conceptuel |
|---|---|---|
| `simuler` | :38-56 | Gardée (décision). `update` → `organisation.update` (abonnement, statut, expiration, plan) + miroir centre (option a). Pas de garde PROPRIETAIRE (admin/test, endpoint `@Roles(HEBERGEUR)` existant :18-22 — inchangé). |
| `activerTrial` | :60-105 | **+ garde PROPRIETAIRE** (§4). Gardes :63-69 lues sur l'ORG (`org.trialStartedAt`, `org.mollieMandatId`) ; écriture :75-83 sur l'org (PILOTAGE/ACTIF/expiration/trialStartedAt) + miroir centre. Emails :85-102 inchangés (le nom du centre reste le contexte affiché). |
| `demanderExtension` | :112-157 | **+ garde PROPRIETAIRE**. Gardes :116-125 sur l'org (trialStartedAt/mollieMandatId/abonnementActifJusquAu) ; écriture :132-135 sur l'org + miroir. Seuil +40j inchangé. |
| `getStatut` | :161-193 | Lecture pure → tout dériver de l'ORG (statut, expiration, plan, mandat, subscription, isTrial/trialExpire/trialUsed). PAS de garde PROPRIETAIRE (un collaborateur peut VOIR le statut ; il ne peut plus AGIR). Champ `type: centre.abonnement` :181 → `org.abonnement`. |
| `souscrire` | :197-334 | Le cœur — détail ci-dessous. |
| `handleWebhook` | :338-417 | §2. |
| `annuler` | :421-484 | **+ garde PROPRIETAIRE**. Cancel Mollie :424-433 depuis `org.mollieSubscriptionId/CustomerId` ; `update { mollieSubscriptionId: null }` :436-443 sur l'org + miroir centre. Emails inchangés. |
| `getFactures` | :486-489 | → `factureLiavoService.lister` par **organisationId** (`where: { organisationId }` — les 0 factures prod n'ont pas de legacy à couvrir, les nouvelles porteront toutes l'org). Nécessite la variante §3. |

**`souscrire` :197-334, point par point** :
1. Validations plan/fréquence/CGV :198-206 — inchangées.
2. Résolution :208 + org (socle commun) + **garde PROPRIETAIRE** (§4).
3. **Annulation d'une subscription existante :218-231 → lue sur l'ORG** (`org.mollieSubscriptionId/CustomerId`). C'est LA garde anti-double-souscription : le 2e centre d'une org abonnée retombe sur la même subscription (remplacée), plus jamais 2 mandats. Le reset `mollieSubscriptionId: null` :227-230 s'écrit sur l'org (+ miroir).
4. **Comptage :234-236** → `count({ where: { organisationId, statut: 'ACTIVE', userId: { not: null } } })` (exclusion catalogue, aligné sur le resync L2b).
5. **Customer Mollie :240-247** : réutiliser `org.mollieCustomerId` ; à la création, `name: org.raisonSociale ?? org.nom` (charger l'org : `organisation.findUnique` — nécessaire de toute façon pour :3), `email: user.email` inchangé.
6. Mandat :250-255 inchangé (IBAN/titulaire du DTO).
7. Subscription :263-271 : `description` nommée par l'ORG (« Abonnement LIAVO {plan} {freq} — {org.nom} ») ; `amount` via `centsToMollie` importé.
8. Grace period :275-280 : `currentExp` lu sur `org.abonnementActifJusquAu`.
9. **Écritures :282-293 → `organisation.update`** (mollieCustomerId/MandatId/SubscriptionId, plan, fréquence, ACTIF, expiration) **+ miroir centre** (option a).
10. **`AcceptationCgv` :295-303** : `+ organisationId`, `centreId` conservé (trace du centre depuis lequel on a souscrit).
11. Emails :305-331 inchangés (contexte centre conservé, montant déjà en param).

## 2. `handleWebhook` :338-417 — diff conceptuel

- **Résolution :354-360** : `organisation.findFirst({ where: { mollieCustomerId: customerId } })` — unicité garantie par l'index partiel L1 (`organisations_mollie_customer_id_key`). Plus de fallback centre (0 customer legacy en prod).
- Idempotence :364-368 (`factureLiavo.findFirst({ molliePaymentId })`) — inchangée.
- Prolongation :370-387 : fréquence = `org.abonnement`, expiration prolongée sur l'**org** (+ miroir sur les centres exploités de l'org : `updateMany({ organisationId, userId: { not: null } })` — option a).
- **Facture = MONTANT RÉELLEMENT PRÉLEVÉ** : remplacer le recalcul :391-396 par `payment.amount` (§6) : `const montantCents = Math.round(Number(payment.amount.value) * 100)`. Le recalcul théorique disparaît de ce chemin (c'est le resync qui réaligne la subscription).
- **`emettre(...)` :397-399** : + `organisationId` (§3) + un `centreId` représentatif pour la trace et le fallback destinataire actuel : premier centre exploité de l'org (`findFirst({ organisationId, statut: 'ACTIVE', userId: { not: null }, orderBy: { createdAt: 'asc' } })`) — déterministe, garde `emettre` inchangé sur le destinataire (L4).
- **Branchement resync APRÈS la facture** : `resyncMontantOrganisation(this.prisma, mollieClient, org.id).catch(err => console.error('[mollie-webhook] resync', err))` — fire-and-forget, dernier geste du chemin `paid`/`recurring` (auto-correction §3 du census L2).
- Chemins `failed/expired/canceled` :409-414 et retours divers — inchangés.

## 3. `emettre()` (facture-liavo.service.ts:104-207) — forme MINIMALE

Signature actuelle : `emettre(centreId, montantCentimes, plan, type, molliePaymentId, destinataire?)`. Ajout **rétro-compatible** : 7e paramètre `organisationId?: string | null`, écrit dans le create :122-135 comme `organisationId: organisationId ?? centre.organisationId ?? null` (le centre est déjà chargé :114-117 → **fallback automatique** : même les appelants non migrés — `admin.facturerCentre` :1751 jusqu'à L2d — produiront des factures correctement rattachées). AUCUN autre changement : mapping destinataire :155-158 intact (L4), PDF intact, email intact. `lister` :209-214 : variante par organisation (`lister(organisationId)` en `where: { organisationId }`, ou nouveau `listerParOrganisation` — préférer le nouveau nom, zéro impact sur les appels existants). `facturerCentre` (L2d) et le webhook (L2a) partagent la signature enrichie sans conflit.

## 4. Garde PROPRIETAIRE — forme exacte

```ts
// abonnement.service.ts, méthode privée (seul ce service en a besoin en L2a ;
// à promouvoir en helper partagé si un autre lot le réclame)
private async assertProprietaireOrganisation(userId: string, organisationId: string): Promise<void> {
  const membership = await this.prisma.membership.findUnique({
    where: { userId_organisationId: { userId, organisationId } },
    select: { role: true },
  });
  if (!membership || membership.role !== 'PROPRIETAIRE') {
    throw new ForbiddenException("Seul le propriétaire de l'organisation peut gérer l'abonnement.");
  }
}
```
Clé composite `userId_organisationId` confirmée (schema Membership, utilisée par centre.helper.ts:106-113 et organisation.helpers.ts:115-123). `role` = enum `RoleMembership`, `PROPRIETAIRE` = valeur par défaut des créations (organisation.helpers.ts:129). **N'exige PAS `claimStatut: 'VALIDE'`** (décision : payer ≠ envoyer des emails externes). 403 `ForbiddenException` simple (pas de code structuré type PLAN_INSUFFICIENT — le frontend n'a pas de modale dédiée à câbler en L2a ; message français propre). Appliquée à : `souscrire`, `annuler`, `activerTrial`, `demanderExtension`. PAS sur `getStatut`/`getFactures`/`simuler`.

## 5. Nettoyage des doublons L2b — consommateurs vérifiés (grep exhaustif)

- `centsToMollie` privée : **utilisée UNIQUEMENT dans abonnement.service.ts** (:265, seule occurrence hors définition :15-17). → suppression sûre, remplacée par l'import depuis `./abonnement.constants.js` (:25-27).
- `createMollieClient` local :8-13 : **seul abonnement.service.ts** l'instancie (l'autre instanciation est `mollie.client.ts:3-5`, le singleton cible). ⚠️ L'import :8 porte AUSSI `MandateMethod` (utilisé :252) → conserver `import { MandateMethod } from '@mollie/api-client'` en retirant seulement le default import.
- Aucun autre fichier n'importe ces symboles — zéro cascade.

## 6. Format Mollie `payment.amount` (SDK 4.5.0) et reconversion en centimes

`Amount { currency: string; value: string }` (`dist/types/data/global.d.ts:82-85`) — `value` est une **chaîne décimale** (« 147.00 »). Reconversion : **`Math.round(Number(payment.amount.value) * 100)`** — le `Math.round` est obligatoire (`146.80 × 100 = 14680.000000000002` en flottant IEEE). Garde de bon sens : si `!payment.amount?.value` ou reconversion `NaN`/≤0 → log + fallback recalcul théorique actuel (:391-396 conservé en secours) plutôt qu'une facture à 0.

## 7. Specs

**`abonnement.service.spec.ts` n'existe PAS** (seuls `cron-alertes.service.spec.ts` et `resync-montant.helper.spec.ts` dans le dossier) → **à créer**, patron mocks littéraux. ⚠️ Le service importera le singleton `mollie.client.js` au chargement du module → la spec doit soit mocker `./mollie.client.js` (`jest.mock`), soit ne tester que les chemins sans I/O Mollie ; le plus simple : `jest.mock('./mollie.client.js', ...)` + mock de `resync-montant.helper.js`. Cas :
- `souscrire` : (1) garde PROPRIETAIRE — collaborateur sans membership → 403, membership MEMBRE → 403, PROPRIETAIRE → passe ; (2) centre sans organisationId → 409 ; (3) comptage `{ organisationId, statut: 'ACTIVE', userId: { not: null } }` ; (4) écritures sur `organisation.update` (+ miroir centre si option a) ; (5) annulation de l'ancienne subscription de l'ORG ; (6) AcceptationCgv avec organisationId + centreId.
- `handleWebhook` : (1) résolution `organisation.findFirst({ mollieCustomerId })` ; (2) facture = `payment.amount.value` reconverti (cas « 147.00 » → 14700) ; (3) fallback recalcul si amount absent/NaN ; (4) `emettre` reçoit organisationId + centreId représentatif ; (5) resync appelé après la facture ; (6) idempotence molliePaymentId inchangée.
- `annuler` : garde PROPRIETAIRE + reset `mollieSubscriptionId` sur l'org.

**Specs existantes à risque** : `refuser-centre.spec.ts` (mocke `FactureLiavoService` en classe vide :8 — insensible au 7e paramètre) ; `cron-alertes.service.spec.ts` (L3, intouchée) ; `facture.service.spec.ts` (séjours, sans rapport) ; `trial.helper.spec.ts`/`auth.service.spec.ts` (L2e). Avec l'option a (double écriture), **rien d'existant ne casse** — les lectures centre restent vraies.

## 8. CASCADES / RISQUES

- **Webhook sur org sans subscription (rollback applicatif)** : un customer créé puis code reverté → le webhook prolonge une org qui n'a plus de subscription en base. Sans gravité (idempotence facture + logs) ; ne PAS ajouter de garde bloquante (un webhook doit toujours répondre 200).
- **Collaborateur → 403 sur souscrire/annuler/trial/extension** : voulu. La page frontend abonnement (`frontend/app/dashboard/hebergeur/abonnement/page.tsx`) affichera l'erreur axios brute — acceptable en L2a, message propre à prévoir au lot frontend (L5). `getStatut` reste ouvert → la page se charge normalement.
- **Reconversion `payment.amount`** : sans `Math.round`, centimes flottants (14680.000000000002) → `montantHT` Int Prisma rejetterait/tronquerait. Garde NaN → fallback recalcul (§6) pour ne jamais émettre une facture à 0 €.
- **Suppression des doublons** : grep §5 = zéro consommateur externe ; seul piège réel = perdre `MandateMethod` dans le retrait de l'import :8.
- **Double écriture (option a)** : divergence impossible par construction si CHAQUE write org a son miroir centre dans le même flux — la revue du diff L2a doit vérifier le 1:1 (checklist : simuler, activerTrial, demanderExtension, souscrire ×2 [reset + final], webhook prolongation, annuler). Le re-backfill de sécurité (census L2 §7) reste utile en filet au moment de L3.
- **`getFactures` par org** : les factures émises AVANT L2a n'ont pas d'organisationId — 0 en prod, aucun trou réel ; ne pas écrire de OR legacy.
- **Miroir webhook multi-centres** : la prolongation miroir `updateMany({ organisationId, userId: { not: null } })` prolonge TOUS les centres exploités de l'org — c'est le comportement cible (un abonnement d'org couvre ses centres) et il est cohérent avec ce que liront les guards L3 ; en attendant L3, il est strictement plus juste que l'actuel (qui ne prolongeait qu'UN centre du compte multi-centre).

## Questions ouvertes

1. **Option (a) double écriture vs (b) deploy couplé L2a+L3** — à trancher AVANT la Phase 2 (recommandation : a).
2. `getStatut` expose `mollieSubscriptionId` :188 au frontend — conserver tel quel (déjà le cas) ou masquer aux collaborateurs ? (cosmétique, proposer : tel quel.)

---

*Census Lot 2a réalisé en lecture seule le 06/08/2026. STOP — zéro écriture.*
