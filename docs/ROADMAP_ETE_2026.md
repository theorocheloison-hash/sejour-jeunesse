# LIAVO — Roadmap Été 2026

> **Rédigé le 18/06/2026** — Issue d'un audit exhaustif code × docs.
> **Dernière mise à jour : 13/07/2026** — **Bloc 🔴 ex-nihilo RÉSOLU** (10 commits, recette prod de bout en bout : inscription → justificatif → validation admin → devis ENVOYÉ). L'analyse initiale du bloc était partiellement fausse — corrigée ci-dessous. **Nouveau bloc 🔴** : déploiement frontend silencieusement cassé 12→13/07 (HOSTNAME × Next standalone, résolu `88e49ec`, leçon à retenir). Voir SESSION_STATE 13/07.
> *(12/07/2026)* — **Export ZIP des factures PDF LIVRÉ** (§2.8 ci-dessous) : ZIP + index CSV, avoirs inclus dans le ZIP ET dans l'export CSV comptable, **bug multi-centre des exports réparé** (les `<a href download>` court-circuitaient axios → le header `X-Centre-Id` ne partait jamais → tout hébergeur multi-centre exportait son 1er centre, silencieusement). 3 commits poussés (`6023edc`, `f0f96f8`, `b0a1ed3`), recette prod validée (62 PDF Sauvageon, ~10 s). **Statut corrigé** : `28e364a` (fix SIRET) était noté « non poussé » ici — il est **en prod depuis le 09/07** ; en revanche le SIRET **n'est pas réglé** (cf. 4e cause du bloc 🔴). Voir SESSION_STATE 12/07.
> *(08/07/2026, soir)* — Run dette §4 : 4.6 (escapeHtml) et 4.10 (jspdf) constatés déjà faits → actés ; 4.9 partiel (SequenceService couvert par la suite invariants) ; **4.15 LIVRÉ** (bandeau « nouvelle version » non-destructif dans global-error.tsx, jamais de reload auto) ; **4.11 LIVRÉ** (13 vulns → 3 : audit fix + next 16.2.10 + @types/react-pdf mort supprimé ; xlsx = risque ACCEPTÉ ; postcss vendored Next non actionnable) ; **4.7 étape 1 prête** (`docs/AUDIT_FLOAT_DECIMAL.md`, requêtes prod à exécuter par Théo, migration non engagée). Après-midi : chantier 10.1 livré de bout en bout, deadline 26/09 NEUTRALISÉE (cron exclut VIREMENT + Choucas marqué, facture échéance/mention dynamiques, badge Paiement, relance J-30, self-service +14j) ; edge cases onboarding soldés ; compte de test neutralisé. Soir (tard) : fix page abonnement — libellés neutres (amorce §2.4) + bouton « plan actuel / Nous contacter » dérivé du plan courant (`PricingTable`). Matin : onboarding phase 2 (§10.11) + 3 bugs smoke-test corrigés. Voir §2/§4/§10 + SESSION_STATE 08/07.
> *(07/07 : Refonte planning ↔ groupes m2m livrée. Fix crash boot Scalingo P3015. Refactor PDF extraction dynamic imports. Item dette 4.18 ajouté.)*
> *(03/07 : Sécurité verrouillée, Mollie live, Pilotage livré, conventions configurables, contrat événement. Dette 4.1-4.3 livrée. Responsive mobile livré. Diagnostic dette Fable 5.)*
> **Auteur** : Théo + Claude (sparring partner)
> **Ce document remplace** : ROADMAP_POST_DEMO.md, ROADMAP_COMPLETE.md, TIER1_CHANTIERS.md comme source de priorisation.
> **Règle** : les docs ci-dessus restent comme archives de décision. Celui-ci est le seul qui dit quoi faire et dans quel ordre.

---

## ✅ RÉSOLU 13/07/2026 — Parcours inscription hébergeur ex-nihilo (identifié 09/07, ex-🔴 URGENT)

**Symptôme initial** : un hébergeur qui s'inscrivait seul avec un centre HORS catalogue pouvait finir avec un compte détruit à l'inscription (cas Louise Giard / PULSE SPORTS, rattrapée en SQL), une checklist « Déposer un justificatif » en boucle infinie, et des envois externes bloqués sans issue apparente.

**⚠️ L'analyse initiale de ce bloc racontait une histoire que la session du 13/07 a DÉMENTIE — corrections :**
- ❌ *« ni en self-service, ni par l'admin via l'UI »* : **FAUX**. L'admin POUVAIT déjà valider : le dashboard admin consomme `/centres/admin/claims` → `centreService.validateClaim`, qui **accepte `EN_ATTENTE_DOCUMENT`**. Il n'y a jamais eu de cul-de-sac admin — il y a en revanche trois implémentations divergentes du même workflow (cf. 🟡 DETTE 13/07 §2).
- ❌ *Le SIRET comme cause* : c'était un **SYMPTÔME**. La cause racine était l'**absence d'atomicité** dans `registerHebergeur` : `centre.create` hors transaction → toute erreur en aval laissait un user orphelin et un **email brûlé à vie** (ConflictException à chaque retry). Le SIRET était juste le champ qui a fait tomber Louise.
- ❌ *« 1 CTA cassé »* : il y en avait **TROIS** (OnboardingChecklist + 2 bannières dashboard), tous vers `/documents` — dont l'upload alimente la table `Document`, jamais lue par `getOnboardingStatus`.
- ✅ **5e cause découverte, jamais identifiée** : les emails post-inscription étaient **`await`és après le commit**. Un échec Brevo (timeout, rate-limit) → 500 → compte créé quand même → email brûlé. **Même symptôme que le bug d'atomicité, par une autre porte.** Corrigé (fire-and-forget avec log exploitable).

**Les 5 causes réelles, toutes corrigées le 13/07** :
1. **Atomicité** (`60eb12f`) : transaction interactive user + centre + organisation + membership + consentement RGPD, mapping d'erreurs (P2002 → 409, P2000 → 400 FR actionnable), tous les emails après commit, rollback prouvé sur vraie base.
2. **SIRET `@Length(14,14)`** + strip sur les 3 DTO register/create/update (`b1bbcd4`) — filet de sécurité, PAS la réparation (c'est l'atomicité qui répare).
3. **`motDePasseDefini`** dans `centre.service.register()` (`5e59e28`) — bug dormant corrigé AVANT la correction du routage cas 2 qui l'aurait réveillé.
4. **Écran justificatif** (`ba54a8c`, `c90fd53`, `39aae43`, `6f765fa`, `74adee8`, `81e4315`) : `/dashboard/hebergeur/justificatif` appelle les VRAIS endpoints ((A) `upload-kbis` champ `file` / (B) `upload-justificatif` champ `document`), refetch post-upload (la boucle infinie ne peut plus se reproduire), les 3 CTA rebranchés, boucle résiduelle « centre couvert par un claim en attente » fermée, `/centre/[id]/claim` élargi PDF/JPG/PNG.
5. **Emails non bloquants** (`2a07b7b`) : `sendVerificationEmail` / `sendHebergeurAccountPending` en fire-and-forget, porte de sortie `resendVerification` vérifiée de bout en bout (bouton login inclus).

**Recette prod 13/07, validée de bout en bout** : inscription ex-nihilo (`ZZZ RECETTE 13-07`) → dépôt justificatif (checklist bascule « en cours d'examen » SANS reload) → validation admin → **devis DEV-2026-0001 créé et ENVOYÉ à un destinataire externe**. Le gate `assertEnvoiExterneAutorise` est levé en réel — pas seulement son miroir `envoisBloques`.

**Reste ouvert (hors périmètre du chantier)** : le **routage cas 2** (invitation admin pré-remplie routée vers `/auth/register/hebergeur` → PENDING, au lieu de `/centres/register` → ACTIVE ; le code ACTIVE du cas 2 reste mort côté UI). `motDePasseDefini` a été corrigé en amont précisément pour que ce chantier ne réveille pas le bug de reconnexion. Voir aussi 🟡 DETTE 13/07 §2 (workflow admin) et 🟠 TRIAL 30J.

---

## 🔴 DÉPLOIEMENT FRONTEND SILENCIEUSEMENT CASSÉ 12→13/07 (résolu `88e49ec` — LEÇON À RETENIR)

**Découvert par accident** pendant le chantier ex-nihilo — hors sujet initial, mais bloquait TOUT : plus aucun déploiement frontend ne passait depuis le **12/07 15h42**. Trois deploys consécutifs en `timeout-error` (`ae4c498`, `dc845a2`, `2a07b7b`). **La prod servait du code périmé, SANS ALERTE** : le site répondait 200 (ancien container), les builds réussissaient, seul le boot échouait.

**Cause prouvée** : Next 16 standalone génère `const hostname = process.env.HOSTNAME || '0.0.0.0'` et Scalingo injecte `HOSTNAME=<nom-du-container>`. Next binde donc **uniquement l'IP du container**. Le trafic routé passe (il vise cette IP), mais la sonde de boot Scalingo (loopback) ne voit rien → timeout 60 s → SIGTERM. **Preuve en one-off dans le runtime Scalingo** : `LOOPBACK_REFUSED` / `HOSTNAME_OPEN` ; contre-épreuve `HOSTNAME=0.0.0.0` → `LOOPBACK_OPEN`. (Les 3 commits déclencheurs étaient doc-only : le code n'a jamais été en cause.)

**Fix** (`88e49ec`) : Procfile → `web: HOSTNAME=0.0.0.0 node .next/standalone/server.js`, et les deux `cp -r` sortent du boot (budget 60 s) vers un hook npm `postbuild` (`scripts/prepare-standalone.mjs`, cross-platform). Déploiement suivant : **success**, vérifié.

**⚠️ LEÇON À RETENIR** : un déploiement peut échouer en silence pendant 24 h sans qu'aucun client ne s'en aperçoive — l'ancien container continue de servir — pendant que le backend, lui, continue de se déployer. **Backend et frontend divergent alors sans alerte** (seul signal faible : les erreurs « Failed to find Server Action » des clients au bundle périmé). **VÉRIFIER `scalingo deployments` APRÈS CHAQUE PUSH.**

---

## 🟡 DETTE IDENTIFIÉE LE 13/07 — à traiter à froid (aucun client impacté)

Trois constats issus du chantier inscription ex-nihilo. Aucun ne bloque personne aujourd'hui ; les trois sont des bombes à retardement.

### 1. `createCentre` avale encore l'échec organisation — même bug, autre porte

`centre.service.ts:295-297` : le `try/catch` autour de `findOrCreateOrganisation` fait `console.error` **puis continue**. C'est exactement le pattern qu'on vient de supprimer de `registerHebergeur` (chantier atomicité du 13/07).

Conséquence : un hébergeur existant qui ajoute un centre peut se retrouver avec un **centre orphelin sans organisation ni membership**. Il n'est pas détruit (le compte existe déjà), mais son centre est dans un état bâtard. Le cas est déjà couvert côté UX par l'endpoint (B) `upload-justificatif`, qui n'exige aucune organisation — mais la donnée reste sale.

**Fix** : même traitement que `registerHebergeur` — transaction interactive `centre.create` + `findOrCreateOrganisation` + `centre.update(organisationId)` + `findOrCreateMembership`. Les helpers acceptent déjà `Prisma.TransactionClient` (fait le 13/07).

### 2. Trois implémentations divergentes du workflow admin de validation

| Source | Méthodes | Exposé par | Règle |
|---|---|---|---|
| `claim.service.ts` | `getClaimsEnAttente`, `validerClaim`, `refuserClaim` | `/admin/claims/*` | **strict** : `validerClaim` refuse `EN_ATTENTE_DOCUMENT` |
| `centre.service.ts` | `getClaimsPending`, `validateClaim`, `getCentresPending`, `validateCentrePending` | `/centres/admin/*` | **permissif** : accepte `EN_ATTENTE_DOCUMENT` |
| `admin.service.ts` | `getCentresPending` (3ᵉ version), `activerCentre` | `/admin/centres/*` | filtre sur `organisation.memberships.some(VALIDE)` |

**Le dashboard admin consomme les routes `/centres/admin/*`** (la version permissive). Les deux autres coexistent avec des règles différentes sur la même question métier.

Différences réelles entre `centreService.validateClaim` et `claimService.validerClaim` : la première ne touche ni `compteValide`, ni `emailVerifie`, ni `isPrimary`, **n'envoie aucun email à l'hébergeur**, et active *tous* les centres PENDING du user (toutes orgs) là où l'autre se limite à l'organisation du membership.

⚠️ Les deux `getCentresPending` (centre.service vs admin.service) **ne renvoient pas la même liste** — c'est pour ça que certains centres apparaissent dans un onglet et pas dans l'autre.

**Décision prise (non exécutée)** : `claim.service` devient la source unique. Ordre impératif : (1) assouplir `claimService.validerClaim` pour accepter `EN_ATTENTE_DOCUMENT` sur action admin explicite — **sinon on supprime la seule capacité de débloquer un hébergeur ex-nihilo** ; (2) rebrancher `/centres/admin/*` en préservant URLs **et** shapes de réponse (le dashboard admin ne doit pas bouger) ; (3) supprimer les méthodes de `centre.service`. Ne jamais inverser cet ordre.

### 3. Node 20 en fin de vie — le build va casser

Le buildpack Scalingo avertit à chaque déploiement :

> *Node.js 20.20.2 is now End-of-Life (EOL). […] In a future buildpack release, this warning will become a build error.*

`frontend/package.json` → `"engines": { "node": "20.x" }`. Le jour où le buildpack durcit, **plus aucun déploiement ne passe**. À planifier avant que ça n'arrive en pleine urgence — vérifier la compat Next 16 / NestJS 11 / Prisma avant de bumper.

---

## 🟠 TRIAL 30J DÉMARRE PENDANT L'ATTENTE DE VALIDATION (identifié 13/07/2026, recette prod)

**Symptôme** : le trial 30j Pilotage s'active au **premier login**, alors que le centre est encore `PENDING` et le claim en `EN_ATTENTE_DOCUMENT`. L'hébergeur voit son essai gratuit s'écouler **sans pouvoir rien faire** — `envoisBloques` reste `true` tant que le centre n'est pas `ACTIVE` : ni devis, ni email externe.

**Constaté en recette prod (13/07)** : compte `recette-exnihilo-13-07` — inscription 14h51, **trial démarré 14h54** (email « Nouveau trial », expiration 12/08), justificatif déposé 14h55, claim validé ~15h30. Entre 14h54 et 15h30, le compte à rebours tourne dans le vide. Sur un vrai prospect validé le lundi après une inscription du vendredi soir, c'est **10 % de l'essai perdu** sans avoir touché au produit. Jamais validé → 100 % perdu, sans que le prospect comprenne pourquoi.

**Cause on-code** : `AuthService.activerTrialPremiereConnexion()` (`auth.service.ts`) filtre sur `trialStartedAt: null`, `mollieMandatId: null`, `abonnementStatut: INACTIF`. **Aucune condition sur `centre.statut`.** Un centre `PENDING` déclenche donc son trial au premier login.

**Non détecté avant** : tous les hébergeurs existants (Sauvageon, Choucas, Pôle Montagne, Louise/PULSE) ont été activés à la main, hors du parcours nominal. Le premier ex-nihilo réel sera le premier à le subir.

**Deux options, à trancher à froid** :
- **A. Démarrer le trial à l'activation du centre** (`claim.service.validerClaim` / `admin.service.activerCentre`) plutôt qu'au login. Le plus juste métier. ⚠️ Vérifier d'abord qu'aucun autre chemin ne dépend du déclenchement au login (magic link, refresh token, invitation).
- **B. Ajouter `statut: 'ACTIVE'` au `where` de `activerTrialPremiereConnexion`.** Une ligne. Le trial démarre au premier login **après** activation. Moins élégant (le trial peut ne jamais démarrer si l'hébergeur ne se reconnecte pas), mais quasi sans risque de régression.

**Priorité** : à traiter avant le premier vrai self-signup hébergeur. Pas de client impacté aujourd'hui.

---

## 🟠 CONTRE-TEST EN ATTENTE — multi-centre sur les exports (à passer au 2e centre de Louise)

**Contexte** : le 12/07, les 3 exports de Pilotage → Comptabilité (CSV factures, CSV versements, ZIP PDF) sont passés de `<a href download>` à axios, ce qui rétablit l'envoi du header `X-Centre-Id`. **Avant ce fix, tout hébergeur multi-centre exportait TOUJOURS son premier centre, silencieusement** (Pôle Montagne = 2 centres actifs).

**Ce qui est prouvé** : `localStorage['liavo-centre-actif']` est bien renseigné (même en mono-centre) et l'interceptor axios pose le header → le maillon cassé est refait. **Ce qui ne l'est pas** : le changement effectif de contenu quand on bascule de centre — impossible à tester sur Sauvageon (mono-centre : le fallback « premier centre possédé » donne le bon résultat par accident, le test serait aveugle).

**→ Dès que le 2e centre de Louise (Chambéret / Corrèze) existe** : basculer de centre via le `CentreSelector`, relancer les 3 exports, **vérifier que le contenu change**. Si non, le fix n'a pas pris. Ne pas laisser une cliente le découvrir à notre place.

---

## 0. État du produit au 18/06/2026

### Ce qui est en production et fonctionne

**Cœur produit (~90% livré)** : flow séjour DIRECT complet (création → devis → signature → facturation acompte/solde/avoir → envoi email PDF), flow COLLABORATIF (invitation → acceptation → espace partagé), facturation Factur-X EN 16931, arrondi TTC-first systémique, ajustement devis post-acompte, CRM hébergeur (pipeline dérivé automatique du devis le plus avancé, contacts, rappels, activités, kanban), planning couleurs par statut (5 états PMS), page liste séjours avec filtres/recherche/badges non-lus, module rentabilité (factures prestataires, ventilation par séjour, marges), page équipe/collaborateurs (permissions par module), dashboard global multi-centre, dashboard réseau (KPIs, scoring, invitation), import APIDAE (81 LMDJ + 54 IDDJ), catalogue public, landing page, autorisations parentales, journal séjour parents, page abonnement (frontend, non connectée au PSP).

**Architecture UX séjour (~70% livré)** : 4 composants extraits (SejourHeader, TabDevisFacturation, TabNotes, TabParticipantsSaisieDirecte), migrations schema faites (notesInternes sur Sejour, sejourId sur Rappel et ActiviteClient), page liste séjours livrée.

**Infra** : Scalingo Paris (2×M + PG Starter 512M = ~36€ HT/mois), OVH Object Storage Gravelines, Brevo FR, DNS OVH. Stable.

### Ce qui ne fonctionne PAS encore

- **Sécurité** : LOT 0 fait (trust proxy + throttle). LOTs 1 à 5 = 0 ligne de code. IDOR critiques ouverts.
- **Monétisation** : 0€ de revenu. Pas de PSP, pas de gating, pas de PlanGuard. Enum PlanAbonnement manque PILOTAGE.
- **Intégrations** : aucune (pas d'iCal, pas d'export CSV, pas de webhooks, pas de Chorus Pro service).
- **Notifications** : l'hébergeur ne reçoit pas de notification quand l'organisateur poste un message collab.
- **Labels** : termes scolaires encore présents dans le body de page.tsx séjour (TIER1 Ch.4 non terminé).

### Données production

- ~63 séjours/événements (Sauvageon)
- ~40 factures émises
- 1er client signé hors Sauvageon : Les Choucas (2 mois gratuits, plan Complet)
- 3 centres Pôle Montagne actifs (trial 6 mois)
- 81 centres LMDJ importés, 54 centres IDDJ importés
- Compte démo réseau : `demo-lmdj@liavo.fr` / `LMDJ2026!`

### Échéances

| Date | Événement |
|---|---|
| 30/06/2026 | CA LMDJ — Marie porte le dossier LIAVO |
| 01/09/2026 | Obligation réception e-invoicing (toutes entreprises) |
| ~Sept 2026 | Potentiel démarrage pilote LMDJ (si accord CA) |
| 31/12/2026 | Clôture 1er exercice LIAVO SASU |
| 01/09/2027 | Obligation émission e-invoicing (PME) |

---

## 1. Priorités P0 — Bloquant adoption (faire IMMÉDIATEMENT)

### 1.1 ~~Notif hébergeur messages collaboratifs~~ — ✅ LIVRÉ

### 1.2 ~~LOT 1 sécurité — IDOR ownership helper~~ — ✅ LIVRÉ

### 1.3 ~~LOT 3 sécurité — Storage privé + URL signées~~ — ✅ LIVRÉ

**Total P0 : TERMINÉ.**

---

## 2. Priorités P1 — Forte valeur (semaines 2-4, avant ou juste après CA LMDJ)

### 2.1 ~~LOT 2 sécurité — Auth hardening JWT refresh~~ — ✅ LIVRÉ

### 2.2 ~~Migration enum PILOTAGE~~ — ✅ LIVRÉ

### 2.3 ~~PSP Mollie SEPA~~ — ✅ LIVRÉ (mode live, webhook validé, première échéance Choucas ~17/07)

### 2.7 ~~Refonte planning ↔ groupes many-to-many~~ — ✅ LIVRÉ (07/07)

Table de jointure `PlanningActiviteGroupe`, refonte `genererPlanningIA` (1 activité par cluster au lieu de N), UI multi-select dans TabPlanning, PDF adapté. Anne (Choucas) et Yves (Pôle Montagne) peuvent maintenant construire leurs plannings 6 mois avant les inscriptions, avec activités rattachées à plusieurs groupes (ex: "Escalade Groupe 1 + Groupe 3"). Voir SESSION_STATE 07/07 + `docs/audit-planning-cascade.md`.

### 2.4 TIER1 Ch.4 — Labels universels — ~1j (amorcé)

**PARTIEL.** Amorce 08/07 : 2 libellés scolaires neutralisés dans `PricingTable.tsx` (« Signature électronique directeur » → « en ligne », « Espace collaboratif hébergeur + enseignant » → « partagé »). **Reste** : les termes scolaires dans le body de `sejour/[id]/page.tsx` en contexte EVENEMENT.

### 2.5 ~~Export CSV factures~~ — ✅ LIVRÉ (Comptabilité dans module Pilotage, BOM UTF-8)

### 2.8 ~~Export ZIP des factures PDF~~ — ✅ LIVRÉ (12/07)

`GET /pilotage/export/factures-pdf[/preview]` (`@RequirePlan('COMPLET', strict)`). ZIP des PDF Factur-X déjà stockés sur OVH + `_factures.csv` en index + `_PDF_MANQUANTS.txt` si des PDF manquent (deux causes distinguées : jamais généré / introuvable au fetch). `StorageService.zipFromUrls()` **générique** (`{nom, url}`) — l'extension aux **factures prestataires** (`FacturePrestataire.fichierUrl`, le comptable veut les achats autant que les ventes) coûtera ~30 lignes. **Zéro dépendance ajoutée** (`pizzip` déjà présent), compression STORE, fetch par lots de 5, plafond dur 300 factures.

**Effets de bord assumés** : les **avoirs** sont désormais inclus dans l'export CSV factures (un avoir est une pièce comptable — son exclusion rendait le CSV faux) + **colonne `Type`** ajoutée. Les 3 exports passent par axios (fix multi-centre, cf. bloc 🟠 ci-dessus).

**Recette prod** : Sauvageon 62 factures / 62 PDF, ZIP ~10 s. **Non recetté en prod** : les avoirs (0 en base) → couverts par tests unitaires uniquement, à revérifier au premier avoir émis.

### 2.6 LOT 4a — Cookie httpOnly — EN PAUSE

Reverté. Root cause : axios 1.13.6 + turbopack fetch adapter ne forward pas `credentials: 'include'` cross-origin. Solution recommandée : Next.js rewrites. Helmet livré.

**Total P1 restant : 2.4 labels (~1j) + 2.6 httpOnly (~1j quand Next.js rewrites en place).**

---

## 3. Priorités P2 — Nice to have (juillet-août)

| # | Chantier | Effort | Trigger |
|---|---|---|---|
| 3.1 | ~~LOT 5 — Purge IBAN git~~ | ✅ | LIVRÉ |
| 3.2 | Refonte page Devis envoyés (tableau filtrable/triable) | 2-3j | Quand 100+ devis en base |
| 3.3 | Flux iCal lecture seule (`GET /centres/:id/calendar.ics`) | 0.5j | 1er hébergeur qui demande |
| 3.4 | SC7 — Notif centres APIDAE non inscrits | 2-3h | Après validation commerciale LMDJ |
| 3.5 | Concept Réponse PDF (adhérents LMDJ Découverte) | 1j | Si accord CA LMDJ |
| 3.6 | Fix "dont X€ via réseau" (mauvais fichier global→hebergeur) | 0.5j | Quick fix |
| 3.7 | Intégration APIDAE LMDJ (1 ligne dans syncApidae) | 15min | Quand credentials Amandine reçus |
| 3.8 | SSO APIDAE OAuth2 | 0.5j | Quand credentials APIDAE Connect reçus |
| 3.9 | Onboarding première connexion (flag premiereConnexion) | 1-2j | Avant ouverture grand public |
| 3.10 | ~~Responsive mobile~~ | 1 nuit + fixes | — | ✅ LIVRÉ (Fable 5 overnight, drawer mobile, planning responsive, sweep ~60 pages, déployé 03/07) |

---

## 4. Priorités P3 — Dette technique (selon trigger)

| # | Chantier | Effort | Trigger | Statut |
|---|---|---|---|---|
| 4.1 | ~~Modules devis partagés~~ | 1 nuit | — | ✅ LIVRÉ (3 modules extraits : devis-calculs.ts, useDevisLignes.ts, DevisEditor.tsx — 949 ins / 982 del, delta -33 lignes). Les 3 fichiers DevisBuilder restent séparés mais partagent la logique commune. Merge complet → quand prochaine modif devis. |
| 4.2 | ~~DashboardShell unification~~ | 1 nuit | — | ✅ LIVRÉ (HebergeurShell + TopBarShell, dashboard/layout.tsx routeur de shell, 11 commits + 1 fix). Suivi : double bandeau sous-pages organisateur/admin à nettoyer. |
| 4.3 | ~~Découper page.tsx séjour~~ | 1 nuit | — | ✅ LIVRÉ (194KB → 20KB, -86%, 9 composants extraits : TabMessages, TabPlanning, TabGroupes, TabDocuments, TabBudget, TabProjetPedagogique, TabJournal, TabParticipantsCollab, InviteOrganisateurCard). |
| 4.4 | LOT 6 maintenance continue (logs, HTML injection emails, omit Prisma) | Au fil de l'eau | Quand on touche les fichiers | |
| 4.5 | Double bandeau sous-pages organisateur/admin | 0.5-1j | Quand on touche ces sous-pages | Suivi Run 3 DashboardShell |
| 4.6 | ~~escapeHtml notifications.service.ts + collaboration.service.ts~~ | 30min | — | ✅ LIVRÉ (constaté 08/07 : `utils/escape-html.ts` consommé par notifications, collaboration, devis et email.service). Reliquat : supprimer la branche locale `fix/escape-html-emails`. |
| 4.7 | Migration Float→Decimal montants devis/factures | 1-2j | **Audit prod à exécuter** (décision 08/07 : audit seul, sans migrer) | ◐ Étape 1 prête : `docs/AUDIT_FLOAT_DECIMAL.md` (requêtes de contrôle prod lecture seule Q1-Q5 + grille de lecture). Théo exécute en pgsql-console, colle les résultats → décision de migration sur le rapport d'écarts. Coût réel = code (Prisma.Decimal ≠ number). **NE PAS faire en Fable 5 overnight** — données prod en jeu. |
| 4.8 | CI minimale GitHub Actions (tsc + build) | 0.5j | Post-pitch | Diagnostic Fable 5. Actuellement zéro CI, gate = discipline manuelle. Candidat Fable 5 overnight. |
| 4.9 | Tests unitaires code financier (devis-calculs.ts, SequenceService, formule acompte) | 1-2j | Post-pitch | ◐ PARTIEL (08/07) : SequenceService couvert par la suite invariants (13 tests, scopes/monotonie/apercu/P2002) + PlanGuard, centre.helper, trial login, cron alertes — 136 tests backend au total. Reste : devis-calculs.ts (frontend, pas de harness Jest côté front) + formule acompte. |
| 4.10 | ~~Supprimer jspdf (dépendance morte, 0 import)~~ | 5min | — | ✅ FAIT (constaté 08/07 : absent des package.json frontend et backend). |
| 4.11 | ~~npm audit fix ciblé + décision xlsx~~ | 1h | — | ✅ FAIT (08/07) : 13 vulns → 3. `npm audit fix` (axios & co patchés), next 16.1.6→16.2.10 (advisories middleware/cache), `@types/react-pdf` supprimé (dépendance morte, 0 import, portait toute la chaîne pdfjs-dist vulnérable). Résiduel assumé : **xlsx (haute) = risque ACCEPTÉ** (décision Théo 08/07 — parsing limité aux fichiers de l'hébergeur authentifié sur ses propres données) ; postcss (2 modérées) = vendored dans Next, non actionnable sans casser (upstream). |
| 4.12 | Extraction helpers partagés frontend (StatutBadge ×4, KpiCard ×3, formatDate ×35 redéfinitions) | 1 nuit | Prochaine modif frontend transverse | Diagnostic Fable 5. Candidat Fable 5 overnight. |
| 4.13 | Extraction DEPT_TO_REGION + statuts devis constants backend | 0.5j | Prochaine modif backend devis | Diagnostic Fable 5. Table copiée dans 4 services, Set statuts réécrit ~10 fois, magic 30 dupliqué. |
| 4.14 | IBAN endpoint public getDevisPublicByToken | — | **Décision : ne pas fixer** | Diagnostic Fable 5. centre.iban exposé via GET /devis/public/:token (sans JWT). Décision 03/07 : le token UUID v4 EST l'auth, l'IBAN est nécessaire pour le PDF devis côté client, le retirer casserait DevisPDFButton sur la page de signature. Risque réel = faible (token indevinable). Le vrai fix IBAN = chiffrement en base (backlog existant). |
| 4.15 | ~~Erreurs `Failed to find Server Action` à chaque deploy~~ | 0.5j | — | ✅ FAIT (08/07, version non-destructive décidée par Théo) : `global-error.tsx` détecte l'erreur Server Action périmée (best-effort sur le message) et affiche « Une nouvelle version de LIAVO a été déployée » + bouton Recharger — **jamais de reload() automatique**. Les autres erreurs gardent le rendu générique. |
| 4.16 | Upgrade @react-pdf/renderer (dépendance fantôme pako) | 0.5j | Post-pitch | 05/07 : @react-pdf/pdfkit 4.1.0 lib/pdfkit.browser.js importe pako/lib/zlib/* sans déclarer pako. Fix actuel = pin pako@1.0.11 exact en dépendance directe (commit 8a60079). Vérifier si release react-pdf récente déclare pako correctement → retirer le pin. NE PAS passer pako en ^2/^3 (exports field bloque les subpaths). |
| 4.17 | Qté 0 affiche "0" dans PDF devis (lignes option Alticlub) | 15min | Si Alticlub s'en plaint | Workaround option = ligne qty 0 avec PU TTC visible (livré 05/07). Résidu cosmétique : "0" et "0,00 €" dans qty/totaux. Fix : afficher "—" quand qty=0 dans DevisPDF/FacturePDF/page signer. 3 lignes × 3 fichiers. |
| 4.18 | Refonte `regrouperParCreneau` dans journal public | 30min-1h | Si un client se plaint des badges groupes absents dans le journal public | 07/07 : la fonction parse les suffixes de titre ("Escalade — G1") pour afficher les badges groupes. Marchait avec l'ancien schéma (activités dupliquées par groupe, suffixe automatique). Ne marche plus avec la refonte m2m (1 activité par cluster, titre sans suffixe, groupes dans une table de jointure). Impact : dégradation cosmétique du journal public pour les nouveaux plannings. Fix : ajouter `groupes` au select backend `journal-public.controller.ts:39` + refondre `regrouperParCreneau` (page.tsx L89-133) pour lire les groupes structurés. Voir `docs/audit-planning-cascade.md` §C.2. |

---

## 5. Chantiers conditionnels (SI accord CA LMDJ)

Ces chantiers ne sont codés QUE si le CA LMDJ du 30/06 donne un accord de principe.

| # | Chantier | Effort | Source |
|---|---|---|---|
| 5.1 | Validation réseau avant dispatch (statut `EN_VALIDATION_RESEAU`) | 2-3j | Débrief Marie §1 — BLOQUANT pour LMDJ |
| 5.2 | Motif obligatoire refus centre + enseignant | 1j | Débrief Marie §3 |
| 5.3 | Multi-classes (niveauClasse string → string[]) | 0.5j | Débrief Marie §4 |
| 5.4 | Split maternelle/PMI (agrementPMI, filtre findOpen) | 1-1.5j | Débrief Marie §5 |
| 5.5 | Ratio demandes/devis par centre (enrichir KPIs réseau) | 0.5j | Débrief Marie §8 |
| 5.6 | Capture demandes 73/74 hors LMDJ sur dashboard réseau | 0.5-1j | Débrief Marie §2 |
| 5.7 | CRM hébergeurs côté réseau (prospection adhérents) | 2-3j | Débrief Marie §7 |
| 5.8 | Pricing bundlé LMDJ (business decision, pas du code) | — | Débrief Marie §10 |

**Total conditionnel : ~10j si tout est fait. Échelonnable en 3 sprints.**

---

## 6. Chantiers hors scope été (backlog)

Documentés pour mémoire. Ne pas commencer avant PMF.

- ~~Module Pilotage enrichi~~ — ✅ LIVRÉ (CA, remplissage, comparaison N-1, ventilation produit)
- Chorus Pro NestJS service (habilitation AIFE, ChorusProService)
- Webhooks événementiels (1-2j)
- Flow "Transmettre au gestionnaire" facture (token public, 2-3j)
- SC-MULTI-ORGANISATEURS (SejourCollaborateur)
- SC-PDF-DEVIS-EXTERNE (typeDevis UPLOAD_EXTERNE)
- SC-IMPORT-PARTICIPANTS (CSV Pronote)
- Intégration PMS (Mews, Amenitiz) — V2+
- ~~Convention configurable par centre~~ — ✅ LIVRÉ (couverture LIAVO + PDF centre mergé via pdf-lib)
- ~~Contrat événement~~ — ✅ LIVRÉ (guard Sauvageon, contratUrl persisté, exposé client+hébergeur)
- ~~App mobile PWA~~ — Responsive mobile livré 03/07. PWA (manifest + service worker) reste en backlog.
- Marketplace activités
- Appel d'offres transport
- **Grille tarifaire dégressive (besoin Yves/Pôle Montagne, 05/07)** — tarif/élève évoluant selon effectif + gratuités encadrants par palier (cf. fichier Cotation Ste Thérèse : 78 él. = 469€/él. + 6 gratuités → 65 él. = 482€ + 5). Options évaluées : PJ PDF (zéro dev), section grille sur devis (champ structuré + rendu PDF), paliers sur ProduitCatalogue (auto-calcul). Décision 05/07 : reporté, requalifier SI d'autres adhérents LMDJ expriment le besoin. Distinct du besoin "lignes option" Alticlub (résolu autrement).
- Forge française (Gitea OVH) — quand 2e dev ou appel d'offres public

---

## 7. Calendrier cible

```
Semaine 23/06 - 27/06 (avant CA)
├── Jour 1 : TIER1 Ch.1 notif hébergeur (1h) + début LOT 1 IDOR (ownership.helper.ts)
├── Jour 2-3 : LOT 1 IDOR (finir les ~30 call sites + tests)
├── Jour 4-5 : LOT 3 storage privé backend (getSignedUrl, endpoint /files/:key)
│
30/06 ★ CA LMDJ
│
Semaine 30/06 - 04/07
├── LOT 3 storage privé frontend (SecureFile, 14 call sites) + tokens expiration
├── LOT 2 JWT refresh (backend + frontend interceptor)
│
Semaine 07/07 - 11/07
├── Migration PILOTAGE + PSP choix + intégration (3-7j selon PSP)
│
Semaine 14/07 - 18/07
├── PSP fin + PlanGuard + gating frontend
├── Labels universels + export CSV factures
│
Semaine 21/07 - 25/07
├── LOT 4 httpOnly + Helmet
├── Si accord LMDJ : validation réseau (P0 LMDJ)
│
Août
├── P2 au fil de l'eau (iCal, refonte devis envoyés, notif APIDAE)
├── Si LMDJ : chantiers 5.2→5.7
├── LOT 5 purge IBAN
```

---

## 8. Métriques de suivi

| Métrique | Cible fin juillet | Cible fin août |
|---|---|---|
| Findings CRITIQUE restants | 0 | 0 |
| Findings HAUTE restants | ≤ 3 | 0 |
| PSP connecté + 1er paiement test | ✅ | ✅ |
| Centres payants | 1 (Les Choucas) | 3-5 |
| MRR | 49€ | 150-250€ |
| IDOR ownership helper déployé | ✅ | ✅ |
| Storage privé déployé | ✅ | ✅ |

---

## 9. Décisions de référence

| Sujet | Décision | Date |
|---|---|---|
| Grille tarifaire | 0/39/59/79€ HT/mois (Découverte/Essentiel/Complet/Pilotage), remise 17% annuel | 30/06/2026 |
| PSP | Mollie SEPA (EU). Mode live activé. Stripe écarté. | 30/06/2026 |
| CRM pipeline | Dérivé automatique côté frontend, plus de pipeline manuel | 18/06/2026 |
| Sécurité gate dur | LOTs 0-5 TOUS livrés. LOT 6 maintenance au fil de l'eau. | 30/06/2026 |
| Chantiers LMDJ | Conditionnés à l'accord CA 30/06, pas avant | 18/06/2026 |
| Positionnement | LIAVO = infrastructure technique modernisant la centrale, pas remplacement | 10/06/2026 |
| Commission réseau | 10% des abonnements LIAVO dès 2027 | 11/06/2026 |
| IBAN endpoint public | Token UUID v4 = auth suffisante, IBAN nécessaire pour PDF client. Ne pas retirer. Vrai fix = chiffrement en base. | 03/07/2026 |
| Float→Decimal devis | Chantier post-pitch, vérification données prod obligatoire, interdit en Fable 5 overnight | 03/07/2026 |
| TODO abonnement (devis.service:52, sejour.service:981) | Choix commercial conscient : ne pas réactiver tant que flux paiement pas stable (post-17/07 Choucas) | 03/07/2026 |
| Diagnostic dette technique | Source : audit Fable 5 03/07/2026, validé par lecture code MCP. Items intégrés en 4.6–4.14. | 03/07/2026 |
| Lignes option devis (Alticlub) | PAS de champ typeLigne (chantier ~10 fichiers écarté). Solution : ligne qty 0 + colonne PU TTC ajoutée et uniformisée sur DevisPDF, page publique signer, FacturePDF (7 colonnes : Désignation/Qté/PU TTC/TVA%/PU HT/Total HT/Total TTC). PU TTC dérivé du HT stocké, jamais persisté. | 05/07/2026 |
| Build local turbopack (pako) | Root cause : dépendance fantôme pako dans @react-pdf/pdfkit browser build. Fix : pin pako@1.0.11 exact (dépendance directe). 4 boutons PDF restructurés (extraction composant + dynamic import) au passage — amélioration structurelle, pas le fix. Build Scalingo n'a jamais été cassé. | 05/07/2026 |
| Grille tarifaire Yves | Reporté. Découplé du besoin Alticlub. Requalifier si signal d'autres adhérents LMDJ. | 05/07/2026 |
| Planning ↔ groupes m2m | Refonte complète via table de jointure `PlanningActiviteGroupe` (Option A), rejet des Options B (activités dupliquées) et C (array Postgres). `genererPlanningIA` refondu : 1 activité par cluster au lieu de N. Titre simplifié (plus de suffixe " — G1"). Audit exhaustif post-refonte : 0 cascade à fixer. Backfill à 0 confirmé (feature jamais utilisée en prod jusqu'ici). | 07/07/2026 |
| Migration SQL manuelle Prisma | Ne JAMAIS créer de sous-dossier dans `prisma/migrations/` pour autre chose que des migrations Prisma standards (nommage `YYYYMMDDHHMMSS_nom` + fichier `migration.sql`). `prisma migrate deploy` scanne tous les sous-dossiers et plante avec P3015 sinon. Pour les migrations SQL manuelles à référencer dans le repo : `prisma/manual-migrations/` (norme LIAVO) ou `docs/migrations/`. | 07/07/2026 |
| Ordre déploiement SQL + code | Toujours exécuter la migration SQL prod AVANT le push du code correspondant. Sinon fenêtre de risque : le nouveau backend démarre sur une base sans la structure attendue, crash au boot ou au premier `SELECT`. Confirmé 07/07 avec la refonte m2m (crash P3015 pendant ~10 min). | 07/07/2026 |
| xlsx vulnérable (4.11) | Risque ACCEPTÉ, documenté : pas de fix npm, parsing limité aux fichiers uploadés par l'hébergeur authentifié sur ses propres données → exposition réelle faible. Ni migration exceljs ni CDN SheetJS. À requalifier si le parsing s'ouvre à des fichiers tiers. | 08/07/2026 |
| Erreurs deploy Server Actions (4.15) | Version NON-destructive : error boundary (global-error.tsx) détecte l'erreur et propose « Recharger la page » — jamais de reload() automatique (saisie en cours). L'IDDJ n'est pas le trigger, le fix est fait pour lui-même. | 08/07/2026 |
| Float→Decimal (4.7) | Audit d'abord, migration ensuite (ou pas) : requêtes de contrôle prod dans `docs/AUDIT_FLOAT_DECIMAL.md`, décision sur le rapport d'écarts. Jamais en overnight. | 08/07/2026 |

---

## 10. Chantiers issus du run onboarding backend (07/07 — déployé en prod)

**Livré 07/07** : branche `feat/onboarding-register-trial` (26 commits) mergée et déployée. Compte hébergeur utilisable dès l'inscription (compteValide=true au register, kill switch conservé), trial 30j Pilotage auto à la première connexion (garde `abonnementStatut INACTIF` protège les clients existants), centres PENDING opérables (SUSPENDED seul bloquant), gates anti-phishing `assertEnvoiExterneAutorise` (10 sites, exception destinataire=soi-même), cron alertes branché (`@Cron` 8h Paris, garde `ENABLE_CRON`), justificatif ex-nihilo dans le tunnel claim (membership `EN_ATTENTE_DOCUMENT`), `Devis.dateEnvoi` (migration + backfill), endpoint `GET /centres/onboarding-status`. Recette régression Sauvageon validée 4/4. SQL memberships→VALIDE exécuté (5 clients).

**Livré 08/07** : phase 2 onboarding (§10.11) déployée — branche `feat/onboarding-phase2` (6a `envoisBloques` backend + 6b-1 modale test/réel + 6b-2 encart pré-envoi & message `extractApiError` + 6b-4 « Aller plus loin »). Recette prod 3/3 sur compte ex-nihilo frais. **3 bugs attrapés au smoke-test et corrigés (branches dédiées mergées)** : (1) **permissions PENDING** — `getUserCentrePermissions` gaté sur ACTIVE → proprio d'un PENDING en 403 partout, sidebar cassée pour tout nouvel ex-nihilo ; fix = aligné SUSPENDED-only + spec 6 cas (`fix/permissions-centre-pending`) ; (2) **lien devis** — étape 5 checklist → page suivi sans bouton créer ; fix = `onboarding-status` renvoie `sejour.id`, étape 5 → `/devis/nouveau?sejourDirectId` (`fix/onboarding-devis-link`) ; (3) **double bandeau** claim + PENDING redondants pour ex-nihilo ; fix = masque le claim si un centre PENDING affiche le sien (`fix/onboarding-double-banner`). Le parcours claim (centre catalogue ACTIVE + `userId` posé immédiatement) n'était touché par aucun des trois. **FeatureHint ×4 différé** (code mort sans placement + 4 ancrages diffus 119 KB).

**Livré 08/07 (suite)** : **chantier 10.1 COMPLET, deadline 26/09 NEUTRALISÉE.** Protection Choucas en 2 moitiés — code (enum `ModePaiement`, cron exclut les VIREMENT en null-safe, facture `emettre()` échéance/mention dynamiques, `facturerCentre` prolonge + marque VIREMENT, badge admin, relance admin J-30 virement, self-service `POST /abonnements/demander-extension` +14j + bouton) et données (Choucas marqué `mode_paiement='VIREMENT'` en prod). **Edge cases justificatif soldés** : (a) claim sans fichier et (b) logoUrl null PDF **déjà corrects** (lus sur code, aucun fix) ; (c) pied de checklist **fixé** (`OnboardingChecklist` dérive pied + séparateur d'`envoisBloques` au lieu de `centreValide` → cohérent pour revendication catalogue). **Compte de test 08/07 neutralisé** (`trochenrc@gmail.com`, centre `7882bda3…` : SUSPENDED + INACTIF + `compteValide=false`). Workflow : retour direct sur main (les branches par fix = détour). Détail SESSION_STATE 08/07 (suite).

| # | Chantier | Détail | Priorité / Deadline |
|---|---|---|---|
| 10.1 | ~~**Gestion admin des abonnements (virement/BdC)**~~ ✅ **LIVRÉ + DÉPLOYÉ 08/07** | Enum `modePaiement` + cron exclut les VIREMENT (null-safe), facture `emettre()` échéance/mention dynamiques, `facturerCentre` prolonge depuis fin actuelle + marque VIREMENT, `getAbonnements` + badge admin, relance admin J-30 virement, self-service `demander-extension` +14j (endpoint + bouton). Choucas marqué VIREMENT en prod. | ✅ **DEADLINE 26/09 NEUTRALISÉE** (code + données en place) |
| 10.2 | Onboarding phase 2 — frontend | 4a : messages register, CTA trial obsolète, parsing `CENTRE_EN_VALIDATION`, badge centre PENDING. 4b : checklist activation + welcome modal (consomme `onboarding-status`, repli localStorage). 4c : parcours test guidé (devis à sa propre adresse). 4bis backend : preview facture non-émise (`apercu()`) + `POST /abonnements/demander-extension` (+14j sur demande → notif admin). | Avant démarchage IDDJ |
| 10.3 | Extraction PlanningPDF | Stash `extraction PlanningPDF en cours` à dépiler → `npm run build` frontend → commit dédié si vert. Code actuellement dupliqué (composant inline + fichier extrait commité). | Hygiène, avec 10.2 |
| 10.4 | .gitignore | Ajouter `build-error*.txt` (frontend). | Avec 10.2 |
| 10.5 | Email renouvellement annuel | Montant ignore les suppléments multi-centre (+39€/centre) — faux pour Pôle Montagne (YAKA+Florimont). | Avec 10.1 |
| 10.6 | ~~Compte test recette~~ ✅ **FAIT 08/07** | Compte ex-nihilo `trochenrc@gmail.com` (centre `7882bda3…`) créé pour le smoke-test puis neutralisé en prod : `SUSPENDED` + `abonnement_statut INACTIF` + `compteValide=false` (transaction, réversible, jamais ciblé par le cron). | ✅ |
| 10.7 | CLI Scalingo | 1.44.1 obsolète (timeouts constatés sur `restart`), mettre à jour vers 1.47.0. | Hygiène |
| 10.8 | Vérif cron J1 | Après 8h le 08/07 : `scalingo logs | findstr cronQuotidien` — 3 lignes attendues. Si rien : le restart post-`env-set ENABLE_CRON` n'a pas pris, relancer `restart`. | 08/07 matin |
| 10.9 | **HOTFIX faille claim** | Gate fondé sur le claimStatut du propriétaire (pas le statut centre) — branche fix/gate-claim-validation. Faille prouvée (Brevo 21:31 : devis émis vers tiers par claimant non validé). Re-test ZZTEST à confirmer. | 07/07 nuit — déployé |
| 10.10 | Boîte admin contact@liavo.fr | Notifs délivrées en temps réel par Brevo mais relève avec heures de retard (probable Gmail POP3 sur OVH). Fix : redirection MX ou IMAP. Radar de secours : /dashboard/admin/claims chaque matin. | Avant démarchage |
| 10.11 | ~~Prompt 6 — parcours test + découverte~~ ✅ **LIVRÉ 08/07 (partiel)** | Modale de choix séjour test/réel (client=soi), encart proactif pré-envoi (`envoisBloques`), message revendication via `extractApiError`, « Aller plus loin » (3 liens). **FeatureHint ×4 DIFFÉRÉ** (code mort sans placement + ancrages diffus 119 KB — à poser en amortissant). Recette prod 3/3. | ✅ sauf FeatureHint |
| 10.12 | Nettoyage ZZTEST | Procédure détaillée en session state (UI puis SQL). APRÈS re-test hotfix. | 08/07 |

| Sujet | Décision | Date |
|---|---|---|
| Priorité 1 roadmap invalidée | "Premier paiement Choucas ~17/07 = validation Mollie bout-en-bout" : Choucas paie par BdC mairie (Pilotage annuel 690€), ne passera JAMAIS par Mollie. Extension manuelle posée (17/10). Premier vrai test Mollie = Alticlub (fin trial 10/09) ou Pôle Montagne (01/12). | 07/07/2026 |
| Frontière de sécurité onboarding | L'accès au centre n'est plus la frontière (PENDING opérable) : ce sont les gates d'envoi + le filtre ACTIVE du catalogue public. `compteValide` = kill switch par requête, `SUSPENDED` = kill switch centre. | 07/07/2026 |
| Checklist onboarding | 5 étapes dérivées des données (jamais de flags manuels) : profil, catalogue, conformité (justificatif+IBAN), 1er séjour, 1er devis envoyé. Pas de suppression : repli visuel localStorage. Activation = premier devis envoyé. | 07/07/2026 |
| Cron + deadline 10.1 | Cron laissé ALLUMÉ (option 1). ~~10.1 à livrer avant le 26/09~~ → **10.1 LIVRÉ + DÉPLOYÉ le 08/07, deadline 26/09 NEUTRALISÉE** : le cron exclut désormais les centres `modePaiement=VIREMENT` (dont Choucas, marqué en prod) de toutes les alertes d'essai. Choucas recevra à la place une relance admin J-30 (~17/09) pour ré-émettre la facture BdC. | 08/07/2026 |
| « Démarchage IDDJ » périmé | Le label « avant démarchage IDDJ » (§10.2/10.10) ne reflète plus la réalité : IDDJ est **attentiste/prospectif** (Robin Baladi, CA à consulter), pas un partenaire actif. Réseau actif = **LMDJ** (Théo admin depuis AG 01/06). Cadrage réel des chantiers restants : « rendre le produit solide avant d'ouvrir à de vrais partenaires », pas « pour IDDJ ». | 08/07/2026 |
| permission.helper aligné PENDING | `getUserCentrePermissions` ne gate plus sur `ACTIVE` mais sur `SUSPENDED` (proprio/collab d'un PENDING obtient ses permissions), aligné sur `getCentreForUser`. Bug trouvé au smoke-test 08/07 : sidebar cassée + 403 en masse pour tout nouvel hébergeur ex-nihilo. Envois externes toujours gatés séparément. | 08/07/2026 |

---

**Ce document est la source unique de priorisation pour l'été 2026. Les autres docs restent comme archives de décision.**