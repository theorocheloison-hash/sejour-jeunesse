# Rapport — Suite de tests des invariants de sécurité et d'onboarding

**Session nocturne du 07/07/2026 — branche `test/invariants-onboarding` (non poussée).**
Backend uniquement. Aucun fichier de `src/` (code de production) modifié — uniquement des `*.spec.ts` nouveaux + la config Jest de `backend/package.json`. Prisma entièrement mocké, aucun accès base réelle, aucune nouvelle dépendance (jest-mock-extended non nécessaire : mocks objets simples suffisants).

## Bilan

| Suite | Fichier | Tests |
|---|---|---|
| Baseline préexistante | `app.controller.spec.ts`, `organisations.service.spec.ts` | 16 |
| 1. assertEnvoiExterneAutorise | `src/centres/centre.helper.spec.ts` | 20 |
| 2. getCentreForUser / getCentresForUser / getCentreIdsForUser | `src/centres/centre.helper.spec.ts` | 24 |
| 3. PlanGuard | `src/auth/guards/plan.guard.spec.ts` | 24 |
| 4. activerTrialPremiereConnexion (via login) | `src/auth/auth.service.spec.ts` | 12 |
| 5. SequenceService | `src/sequence/sequence.service.spec.ts` | 13 |
| 6. CronAlertesService | `src/abonnements/cron-alertes.service.spec.ts` | 17 |
| **Total** | 7 suites | **122 verts** |

Gates avant chaque commit : `npx tsc --noEmit` = 0, `npm run build` = 0, `npm test` = 0.

## Rejouer

```bash
cd backend
npm test                                  # toute la suite (122 tests, ~2 s)
npx jest src/centres/centre.helper.spec.ts    # une suite précise
```

## Couverture par cible

### 1. `assertEnvoiExterneAutorise` (gate anti-phishing)
- **Self-exception prioritaire sur tout** : autorisée même centre PENDING et même claim REFUSE ; insensible à la casse, aux espaces, aux deux combinés ; la requête membership ne part même pas ; `destinataireEmail` null/undefined ne déclenche PAS l'exception.
- **PENDING bloqué** : ForbiddenException, message préfixé du code machine `CENTRE_EN_VALIDATION|`, mention de l'adresse du compte ; tout statut non-ACTIVE bloque (SUSPENDED inclus) ; membership jamais consulté sur ce chemin.
- **ACTIVE + claim** : `EN_ATTENTE_DOCUMENT` / `EN_ATTENTE_VALIDATION` / `REFUSE` → bloqué avec message « revendication » ; `VALIDE`, `NON_APPLICABLE`, membership absent, `organisationId` null (legacy), `userId` null → autorisés (les deux derniers sans requête membership).
- La requête vise bien le **propriétaire** : clé composite `{userId: centre.userId, organisationId: centre.organisationId}`.

### 2. Helpers d'accès centre
- **SUSPENDED = kill switch** : 404 pour le propriétaire lui-même, un collaborateur accepté, un tiers — indistinguable d'un centre inexistant.
- **PENDING opérable** : propriétaire et collaborateur accepté passent ; tiers → 404 **jamais 403** (centre non sondable par ID).
- **ACTIVE + tiers → 403** (comportement historique) ; collaborateur non accepté = tiers (le WHERE exige `acceptedAt: {not: null}`, vérifié sur les 4 fonctions).
- Résolution implicite (sans centreId), fusion sans doublon (`getCentresForUser`), union dédupliquée d'IDs et délégation avec propagation 404/403 (`getCentreIdsForUser`).

### 3. `PlanGuard`
- Court-circuits : pas de decorator, pas de user, rôle non-HEBERGEUR (4 rôles testés), GET/HEAD en mode soft — tous passent sans requête ; mode strict soumet aussi les GET ; centre non résoluble → fail-open.
- **Plan effectif** : ACTIF + date future = plan réel ; date passée, statut INACTIF, date null ou `planAbonnement` null → DECOUVERTE.
- **Hiérarchie** DECOUVERTE < ESSENTIEL < COMPLET < PILOTAGE : 8 combinaisons actif/requis.
- Corps de la 403 : `PLAN_INSUFFICIENT` + `planRequired` + `planActuel` ; header `x-centre-id` en tableau → première valeur.

### 4. Trial 30j Pilotage à la première connexion
- **Les trois gardes** vivent dans le WHERE du `updateMany` (pas dans du code conditionnel) : le test vérifie la clause exacte `{trialStartedAt: null, mollieMandatId: null, abonnementStatut: 'INACTIF'}` + le court-circuit `count === 0` (ni lookup centres ni notif). *Limite assumée : Prisma étant mocké, le filtrage effectif de ces gardes est garanti par la base, pas rejoué en unitaire — c'est l'invariant « la clause est bien celle-là » qui est verrouillé.*
- INACTIF vierge → PILOTAGE, ACTIF, `trialStartedAt` posé, expiration à 30 jours calendaires (tolérance DST 1 h).
- **Non bloquant** : échec de la notif admin ET échec du `updateMany` lui-même → le login réussit quand même (console.error vérifié).
- Rôles non-HEBERGEUR (4 testés) → aucune tentative ; mot de passe invalide ou email non vérifié → login rejeté sans activation.

### 5. `SequenceService`
- Numérotation **par scope** `(emetteurId, année courante, typeDoc)` : émetteurs et types indépendants, chacun démarre à 1.
- **Jamais de décrément** : suite strictement croissante 1→5, et structurellement `update = {increment: 1}` / `create = 1` sur chaque appel.
- **`apercu()` ne consomme pas** : aucune transaction ni upsert, stable sur appels répétés, et `generer()` attribue ensuite exactement le numéro annoncé.
- Retry P2002 (create concurrent) : un seul retry puis succès ; toute autre erreur propagée sans retry.

### 6. `CronAlertesService`
- **Garde `ENABLE_CRON`** : absente, `'false'`, `'TRUE'` (sensibilité à la casse), `'1'` → return immédiat, zéro requête, zéro email ; `'true'` → les trois étapes ; l'échec d'une étape n'empêche pas les suivantes.
- **Ciblage essais uniquement** d'`envoyerAlertes` : WHERE = ACTIF + `trialStartedAt {not: null}` + `mollieMandatId: null` + fenêtre J..J+21 + anti-spam 6 jours.
- Paliers J-21/14/7/3/1 → envoi + tampon `dernierEmailAlerteAt` ; J-20/10/5/2 → rien ; centre sans email ou sans date ignoré ; échec d'envoi sur un centre → pas de tampon pour lui, les suivants continuent (dates figées via fake timers).

## Blocages rencontrés

**Aucune fonction intestable** — les six cibles ont pu être testées sans toucher à `src/`.

Deux points d'outillage/limites à connaître :

1. **Config Jest complétée (commit dédié `e8612ae`)** : les imports ESM `./x.js` des sources n'étaient résolus par Jest que lorsqu'ils étaient type-only (élidés à la transpilation). Le premier import de **valeur** traversé (`PLAN_KEY` de `plan.decorator.js`) a échoué → ajout du `moduleNameMapper` standard `"^(\\.{1,2}/.*)\\.js$": "$1"` dans le bloc `jest` de `backend/package.json`. La baseline passait avant par chance, pas par construction.
2. **Gardes en clause WHERE** (trial, cron) : quand un invariant est implémenté comme filtre Prisma, le test unitaire vérifie la clause envoyée et les courts-circuits, pas le filtrage SQL réel — ce serait le rôle d'un test e2e sur base éphémère si on veut le rejouer de bout en bout.

## Invariants non couverts (todo)

Trois invariants connus mais non couverts par la suite, capturés en `it.todo` (affichés *pending* par Jest, n'échouent pas) pour qu'ils restent visibles à chaque run :

1. **Centre payant par virement → pas d'alerte essai** (`cron-alertes.service.spec.ts`, describe `envoyerAlertes`) — un centre passé en payant hors Mollie (virement) garde un `trialStartedAt` résiduel et n'a pas de `mollieMandatId` : le ciblage actuel le prend pour un essai actif et lui enverrait des alertes d'expiration. Invariant du chantier 10.1, à faire passer avant le 26/09.
2. **Renouvellement : supplément multi-centre +39 €/centre** (`cron-alertes.service.spec.ts`, nouveau describe `envoyerAlertesRenouvellement`) — le montant annoncé dans l'email vient de `PRIX_ANNUEL_MAP[plan]` seul ; le supplément multi-centre est actuellement ignoré (bug 10.5). Le test ne peut pas passer tant que le calcul n'est pas corrigé côté prod.
3. **Rollover d'année civile → séquence repart à 1** (`sequence.service.spec.ts`, describe `generer`) — `annee` fait partie de la clé composite, donc le 1er janvier chaque scope repart à 1. Non couvert ici car `generer()` lit `new Date().getFullYear()` en dur : le tester proprement demande des fake timers autour du service (faisable, non fait cette nuit).

## Commits de la branche

```
2539344 test(centres): invariants d'assertEnvoiExterneAutorise (gate anti-phishing)
863cc1f test(centres): invariants d'accès getCentreForUser/getCentresForUser/getCentreIdsForUser
e8612ae test(jest): moduleNameMapper pour résoudre les imports ESM .js vers les sources .ts
c7189ef test(auth): invariants du PlanGuard (plan effectif, hiérarchie, fail-open)
be47c7a test(auth): gardes du trial 30j Pilotage a la premiere connexion (via login)
6bbecbe test(sequence): numerotation atomique par (emetteur, annee, type), apercu sans consommation
82b9159 test(abonnements): garde ENABLE_CRON et ciblage essais-uniquement des alertes
```
