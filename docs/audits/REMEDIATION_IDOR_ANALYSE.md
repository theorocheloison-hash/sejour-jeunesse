# Remédiation IDOR — Analyse (Passe A, lecture seule)

> **Statut : PROPOSITION. Aucun fichier `.ts` modifié.** Ce document décrit la règle canonique,
> l'inventaire exhaustif des sites, le blast radius, les helpers proposés et les risques de
> sur-blocage. L'implémentation = passe B, après validation de Théo.
> Convention : **FAIT** (vu dans le code, `fichier:ligne`) / **INTERPRÉTATION** / **INCERTAIN**.

---

## 1. Règle canonique d'ownership (réutilisée, NON réinventée)

### R1 — « ce SIGNATAIRE est lié à ce SÉJOUR »

**FAIT.** Définition déjà en production dans `getAllSejoursSignataire` (`sejour.service.ts:189‑291`).
Un signataire « voit » un séjour ssi **au moins une** des 3 sources :

- **S1 — collègues d'organisation** (`:191‑203,227`) : `sejour.createurId ∈ collègues`, où
  `collègues` = tous les `userId` partageant une **organisation de Membership `isPrimary`** avec le
  signataire.
- **S2 — invitation directeur** (`:207‑211,228`) : `∃ InvitationDirecteur` avec
  `emailDirecteur == signataire.email` ET `sejourId == séjour.id`.
- **S3 — séjour DIRECT de l'organisation cliente** (`:214‑224,228`) : `séjour.modeGestion == 'DIRECT'`
  ET `séjour.clientOrganisationId ∈ orgIds(signataire)`.

**FAIT corroborant le flux invitation.** `invitations-directeur.service.ts:creer` (`:122‑165`)
résout `organisationId` du créateur et le pose sur l'`InvitationDirecteur` ; à l'inscription
(`/register/signataire?token=…`, `:168`) le signataire reçoit un Membership dans cette organisation
→ il devient « collègue » (S1) **en plus** de matcher S2 par email. Les deux chemins convergent.

> **INTERPRÉTATION.** R1 est la définition de référence : « voir dans la liste »
> (`getAllSejoursSignataire`) et « ouvrir le détail » DOIVENT utiliser exactement R1, sinon
> incohérence (un séjour visible en liste mais refusé au détail, ou l'inverse = l'IDOR actuel).

### R2 — « ce SIGNATAIRE est lié à cette DEMANDE »

**FAIT.** Une `DemandeDevis` porte `enseignantId` ET `sejourId` (`schema.prisma:775‑776`).
→ **R2 := R1 appliquée à `demande.sejourId`** (réutilisation directe). Équivalent : `demande.enseignantId ∈ collègues`.

### R3 — « ce HEBERGEUR (centre) est lié à cette DEMANDE »

**FAIT**, dérivée de la logique de liste `findOpen` (`demande.service.ts:185‑215`). Un centre est
légitimement lié à une demande ssi **au moins une** :

- **H1 — destinataire** : `demande.centreDestinataireId == centre.id` (`:211‑212`).
- **H2 — a déjà répondu** : `∃ Devis(demandeId, centreId == centre.id)` (`:192‑195`).
- **H3 — browse-pour-répondre** : `demande.statut == 'OUVERTE'` ET `centreDestinataireId == null`
  ET `matchesDemandeZone(demande, centre)` ET non ignorée (`:200‑240`).

> **INTERPRÉTATION — point sensible (sur-blocage).** H3 est le piège : un hébergeur ouvre
> légitimement le **détail** d'une demande ouverte de sa zone *avant* d'avoir déposé un devis
> (sinon il ne peut pas décider de répondre). Un contrôle limité à H1∪H2 **casserait** ce flux.
> Le contrôle de détail doit autoriser H1∪H2∪H3.

### R4 — « ce HEBERGEUR est lié à ce SÉJOUR » (collaboration)

**FAIT.** Déjà correct dans `verifyAccess` : `isHebergeur = sejour.hebergementSelectionne?.userId === userId`
(`collaboration.service.ts:54`). **Seule la branche SIGNATAIRE est cassée** (voir §3).

---

## 2. Inventaire EXHAUSTIF des sites (au-delà des 5 signalés)

Tous re-vérifiés dans le code. `[FAIT]` = absence de contrôle confirmée ; `[OK]` = déjà protégé
(inclus pour lever le doute).

### Catégorie 1 — SIGNATAIRE traité comme « directeur universel »

| Site | `fichier:ligne` réel | Endpoint | Donnée exposée / action | Règle à appliquer |
|---|---|---|---|---|
| **A1** `verifyAccess` | `collaboration.service.ts:68,79` | tout `/collaboration/:sejourId/*` | **Dossier médical mineurs** (`getParticipants:269` → `infosMedicales:284`, `documentMedicalUrl:285`), journal, docs, budget, **+ écritures** | R1 |
| **A2** `getSejourDetail` | `sejour.service.ts:294` (`findUnique{where:{id}}`, `user` non transmis) ; ctrl `sejour.controller.ts:100‑104` | `GET /sejours/:id/detail` | élèves (nom, parentEmail), accompagnateurs, créateur | R1 |
| **A3** `getDossierPedagogique` | `sejour.service.ts:345`, check ORG‑only `:411` | `GET /sejours/:id/dossier-pedagogique` | élèves (nom, date naissance, parentEmail, tel urgence, paiement) | R1 |
| **A5** `getComparatif` | `demande.service.ts:284`, check ORG‑only `:290` ; expose `iban/siret/tva` `:301‑303` | `GET /demandes/:id/devis/comparatif` | **IBAN/SIRET/TVA** centres + tous devis | R2 (+ retirer `iban`, voir §6) |
| **N1** `getDevisForDemande` | `devis.service.ts:398`, check ORG‑only `:399‑406` ; expose `iban` `:423` | `GET /devis/demande/:demandeId` | **IBAN/SIRET** centres + enseignant | R2 (+ `iban`) |
| **N2** `updateStatut` (devis) | `devis.service.ts:467`, SIGNATAIRE limité à `NON_RETENU` mais **sans ownership** `:488‑492` | `PATCH /devis/:id/statut` | **écriture** : refuser n'importe quel devis d'autrui | R2 (via `devis.demandeId`) |
| **N3** `signerDevis` | `devis.service.ts:593`, **aucun** check ownership (seul garde‑fou = statut `:602`) | `PATCH /devis/:id/signer` | **écriture juridique** : signer (SIGNE_DIRECTION) n'importe quel devis | R2 (via `devis.demandeId`) |
| **N4** `updateStatus` (séjour) | `sejour.service.ts:899`, check ORG‑only `:903‑908` (SIGNATAIRE & AUTORITE non filtrés) | `PATCH /sejours/:id/status` | **écriture** : changer le statut de tout séjour | R1 |
| **N5** `getDevisAValider` | `devis.service.ts:760` (aucun filtre, pas de `:id`) | `GET /devis/a-valider` | **liste GLOBALE** : tous devis EN_ATTENTE_VALIDATION, tous établissements | scoping R1/collègues |
| **N6** `getFacturesAcompte` | `devis.service.ts:837` (aucun filtre) | `GET /devis/factures-acompte` | **liste GLOBALE** : toutes factures acompte, tous établissements | scoping R1/collègues |

### Catégorie 2 — HEBERGEUR : ressource chargée par `:id` sans filtre centre

| Site | `fichier:ligne` réel | Endpoint | Statut |
|---|---|---|---|
| **A4** `demande.findOne` | `demande.service.ts:268` (`findUnique{where:{id}}`, `user` non transmis) ; ctrl `demande.controller.ts:44‑48` `@Roles(ORG,HEB,SIG)` | `GET /demandes/:id` | **[FAIT]** IDOR — enseignant (email) + devis concurrents. Règle : R3 (HEB) **et** R2 (SIG) **et** ORG=propriétaire |
| **N7** `getDemandeInfo` | `devis.service.ts:797` : `getCentreForUser` appelé `:798` mais **jamais utilisé** ; check seulement `if(!demande)` `:828` | `GET /devis/demande-info/:demandeId` `@Roles(HEBERGEUR)` | **[FAIT]** IDOR — « faux‑sécurisé » : résout le centre sans filtrer. Règle R3 |
| `getDevisById` | `devis.service.ts:232`, **check présent** `:267 if(devis.centreId!==centre.id)` | `GET /devis/:id/detail` | **[OK]** protégé (corrige une suspicion initiale) |
| `updateDevis` / `annulerDevis` | `devis.service.ts:274,281` check `centreId` | `PATCH /devis/:id`… | **[OK]** |

### Catégorie 3 — FACTURES : `:id` sans `user` (famille financière, IBAN/montants)

| Site | `fichier:ligne` | Endpoint | Statut |
|---|---|---|---|
| **N8** `getFacturesForDevis` | `facture.service.ts:740` ; ctrl `facture.controller.ts:84‑87` (`devisId` seul, pas de `user`) | `GET /factures/devis/:devisId` | **[FAIT au niveau controller]** aucun `user` transmis → ownership impossible. Lire factures (IBAN, montants) d'autrui |
| **N9** `validerAcompte` | ctrl `facture.controller.ts:114‑118` (`id` seul) ; svc `validerAcompte(id)` | `PATCH /factures/:id/valider-acompte` | **[FAIT au niveau controller]** **écriture** sur toute facture |
| **N10** `getChorusXml` | `facture.service.ts:897` ; ctrl `:122‑125` (`id` seul) | `GET /factures/:id/chorus-xml` | **[FAIT au niveau controller]** XML facture (IBAN) d'autrui |
| **N11** `downloadPdf` | ctrl `facture.controller.ts:128‑137` → `getFactureById(id)` puis `res.redirect(302, pdfUrl)` | `GET /factures/:id/pdf` | **[FAIT au niveau controller]** redirige vers PDF facture d'autrui (de toute façon `public_read`, cf. audit A0) |
| `ajouterVersement` / `supprimerVersement` | ctrl `:91‑112` passent `user.id`+`centreId` | `POST /factures/:id/versements`… | **INCERTAIN** — `user`/`centre` transmis ; **vérifier en passe B** que le service filtre bien |

> **INCERTAIN (Catégorie 3).** Je n'ai pas lu les corps de `getFacturesForDevis`/`validerAcompte`/
> `getChorusXml`. Le fait que le **controller** ne transmette aucun `user` rend tout filtrage
> impossible côté service — c'est suffisant pour qualifier l'IDOR au niveau routage. À confirmer
> ligne par ligne en passe B.

### Sites vérifiés SANS problème (anti‑faux‑positifs)
- `users.controller.ts:15‑29` (`getMe`, `updateProfil`) — basés sur `user.id` du JWT. **[OK]**
- `collaboration.service.ts:54` `isHebergeur` — filtré par `userId`. **[OK]**
- `devis.service.ts:232‑271` `getDevisById` — check `centreId`. **[OK]**

---

## 3. Callers de `verifyAccess` — blast radius

**FAIT.** `verifyAccess(sejourId, userId, role?)` est appelé par **~30 méthodes** de
`collaboration.service.ts` (lecture ET écriture). Modifier sa branche SIGNATAIRE (ligne 68) les
corrige toutes d'un coup — mais le moindre faux‑positif sur R1 casse 30 fonctions. Liste :

**Lectures :** `getSejourInfo:89`, `getMessages:120`, `getPlanning:167`, `getDocuments:204`,
`getDocumentsCentre:257`, `getParticipants:270`, `getBudgetData:304`, `getActivitesCatalogue:614`,
`getGroupes:668`, `getJournal:1072`, `getPlanningGenerationStatus:1060`.
**Écritures :** `createMessage:131`, `createPlanning:175`, `deletePlanning:193`,
`createDocument:215`, `addLigneCompl:376`, `deleteLigneCompl:383`, `addRecette:388`,
`deleteRecette:395`, `createGroupe:684`, `updateGroupe:696`, `deleteGroupe:712`,
`affecterEleve:719`, `retirerEleve:729`, `proposerGroupes:734`, `cloturerInscriptions:792`,
`genererPlanningIA:804`, `createJournalPost:1090`, `deleteJournalPost:1160`.
**Déjà forcés HEBERGEUR (non impactés par la branche SIGNATAIRE) :**
`notifierPlanningMisAJour:1136` et le bloc `:1186` passent `'HEBERGEUR'` en dur.

**INTERPRÉTATION.** Correction à **un seul point** (ligne 68) = excellent ratio. Pré‑requis :
`verifyAccess` doit pouvoir évaluer R1. Aujourd'hui il reçoit `userId`+`role` (pas l'email).
S1/S3 sont calculables depuis `userId` ; S2 exige l'email → le helper devra **résoudre l'email
en interne** (1 requête `user.findUnique`) pour **ne pas changer la signature** des 30 callers.

---

## 4. Helper(s) d'ownership proposé(s)

**Proposition : un module partagé** `backend/src/auth/ownership.helper.ts` (fonctions pures prenant
`prisma` en argument, comme `centres/centre.helper.ts` existant). Signatures :

```ts
// Renvoie true si le signataire (par userId) est lié au séjour selon R1 (S1∪S2∪S3).
// Résout l'email en interne (1 requête) pour couvrir S2 sans changer les signatures appelantes.
export async function isSignataireLinkedToSejour(
  prisma: PrismaService, signataireUserId: string, sejourId: string,
): Promise<boolean>;

// Variante "assert" : throw ForbiddenException si non lié. Pour les sites hors verifyAccess.
export async function assertSignataireCanAccessSejour(
  prisma: PrismaService, user: { id: string }, sejourId: string,
): Promise<void>;

// R2 := R1 sur demande.sejourId (charge demande.sejourId/enseignantId puis délègue).
export async function assertSignataireCanAccessDemande(
  prisma: PrismaService, user: { id: string }, demandeId: string,
): Promise<void>;

// R3 (H1∪H2∪H3) — réutilise getCentreForUser pour résoudre le centre actif.
export async function assertHebergeurCanAccessDemande(
  prisma: PrismaService, centre: { id: string }, demandeId: string,
): Promise<void>;
```

**Intégration par site :**
- **A1 `verifyAccess`** : remplacer `const isDirector = role === 'SIGNATAIRE'` par
  `const isDirector = role === 'SIGNATAIRE' && await isSignataireLinkedToSejour(this.prisma, userId, sejourId)`.
  Signature des 30 callers **inchangée**. Coût : +2‑3 requêtes pour les seuls SIGNATAIRE (S1 colègues,
  S2 invitation, S3 direct) — acceptable.
- **A2 `getSejourDetail(id)` → `getSejourDetail(id, user)`** : ajouter `@CurrentUser()` au controller
  (`sejour.controller.ts:102`) puis `await assertSignataireCanAccessSejour(...)`. **Seul appelant =
  le controller (vérifié)** → changement de signature sûr.
- **A3 `getDossierPedagogique`** : déjà `(id, user)` ; élargir le garde `:411` à
  `if (user.role===ORGANISATEUR && createurId!==user.id) throw; if (user.role===SIGNATAIRE) await assertSignataireCanAccessSejour(...)`.
- **A4 `demande.findOne(id)` → `findOne(id, user, centreId)`** : controller `demande.controller.ts:46`
  passe `@CurrentUser` + `@CentreId`. Brancher selon rôle : ORG=propriétaire, SIG=R2, HEB=R3.
  **Seul appelant = controller (vérifié).**
- **A5 `getComparatif` / N1 `getDevisForDemande`** : déjà `(…, user)` ; ajouter la branche
  `if (user.role==='SIGNATAIRE') await assertSignataireCanAccessDemande(...)`.
- **N2/N3 `updateStatut`/`signerDevis`** : ajouter, pour SIGNATAIRE, `assertSignataireCanAccessDemande(prisma, user, devis.demandeId)` (le devis est déjà chargé).
- **N4 `updateStatus` séjour** : ajouter branche SIGNATAIRE → `assertSignataireCanAccessSejour`. (Décider du sort d'`AUTORITE`, cf. §7.)
- **N5/N6 `getDevisAValider`/`getFacturesAcompte`** : passer `user` et filtrer `where` par
  `demande.enseignantId ∈ collègues(user)` (scoping R1). Changement de signature (1 caller chacun).
- **N7 `getDemandeInfo`** : `centre` déjà résolu `:798` — ajouter `await assertHebergeurCanAccessDemande(this.prisma, centre, demandeId)` (R3).
- **N8‑N11 factures** : passer `user.id`+`centreId` depuis le controller ; dans le service, charger
  `facture → devis → centreId` (HEB) ou `→ demande.sejour` (SIG via R1) et comparer. Changement de
  signature controller→service (1 caller chacun).

**Champs/relations à charger en plus :**
- `verifyAccess` charge déjà `sejour` ; le helper R1 fait ses propres requêtes (n'a pas besoin
  d'enrichir l'`include` existant). Pour **S3**, le helper lit `sejour.clientOrganisationId`
  (1 `findUnique` ciblé) — **INCERTAIN** : confirmer que le champ existe (`Sejour.clientOrganisationId`,
  utilisé en `:217`) → **FAIT, il existe** (`getAllSejoursSignataire` l'emploie).
- Aucune relation lourde ajoutée aux payloads de réponse (le helper fait des requêtes `select`
  minimalistes séparées).

---

## 5. Cascades & risques de SUR‑BLOCAGE (le plus important)

| Risque | Détail | Mitigation |
|---|---|---|
| **Hébergeur browse‑to‑quote (A4, N7)** | Limiter à H1∪H2 casse l'ouverture d'une demande **OUVERTE de zone** avant dépôt de devis. | R3 **doit** inclure H3 (statut OUVERTE + zone + non‑ignorée). Réutiliser `matchesDemandeZone`. |
| **Signataire multi‑établissements / invité tardif** | Un directeur invité par email (S2) mais pas encore « collègue » (Membership) doit voir le séjour. | R1 inclut S2 (email) — d'où la résolution d'email dans le helper. Ne pas réduire R1 à S1. |
| **Compte démo `demo-lmdj@liavo.fr`** | **NON VÉRIFIABLE DEPUIS LE CODE** : aucune occurrence de `demo`/`lmdj`/`liavo.fr` dans `backend/src` ni `prisma/seed.ts` (grep effectué, 0 résultat). Son rôle et ses séjours sont des **données** (DB/seed externe), pas du code. | **Question ouverte Q1.** Si ce compte est un SIGNATAIRE censé ouvrir des séjours de démonstration qui ne sont pas « les siens » au sens R1, le nouveau contrôle le bloquera. À mapper avant passe B. |
| **`AUTORITE` (legacy) sur N4** | `updateStatus` `@Roles(…,AUTORITE)` ; rôle marqué legacy dans CLAUDE.md. | **Question ouverte Q2** : retirer `AUTORITE` du `@Roles` ou lui définir une règle ? |
| **Blast radius verifyAccess (30 callers)** | Un faux‑négatif R1 casse messages/journal/budget/groupes en lecture **et** écriture pour de vrais directeurs. | Tester R1 isolément (table de vérité S1/S2/S3) avant de brancher `verifyAccess`. Conserver `role==='SIGNATAIRE' && <helper>` pour ne rien changer aux rôles HEBERGEUR/createur/accompagnateur. |
| **Changements de signature controller→service** | A2 (`getSejourDetail`), A4 (`findOne`), N5/N6, N8‑N11. | **Tous vérifiés single‑caller** (grep §inventaire) → pas d'autre appelant à casser. |
| **N3 `signerDevis` — write juridique** | Aujourd'hui tout SIGNATAIRE peut signer tout devis. Le contrôle est **prioritaire** (engage l'établissement). | R2 obligatoire ; sévérité haute. |

---

## 6. Recommandation `getComparatif` / `getDevisForDemande` — champ `iban`

**FAIT.** `getComparatif` expose `iban` (`demande.service.ts:303`) et `getDevisForDemande` aussi
(`devis.service.ts:423`), en plus de `siret`/`tvaIntracommunautaire`.

**Recommandation.** Un **comparatif de devis** (choix d'offre par l'organisateur/directeur) n'a pas
besoin de l'IBAN du centre — l'IBAN ne sert qu'au paiement, après sélection/facturation. Retirer
`iban` de ces deux `select` **en plus** du contrôle d'ownership : défense en profondeur (si un
nouvel IDOR réapparaît, l'IBAN ne fuite pas). `siret`/`tva` peuvent rester (utiles à
l'identification du prestataire). **INTERPRÉTATION** — à confirmer (Q3) : le front comparatif
affiche‑t‑il l'IBAN quelque part ? (à vérifier côté `frontend/` en passe B).

---

## 7. Questions ouvertes (décision de Théo avant passe B)

- **Q1 — Compte démo `demo-lmdj@liavo.fr`.** Quel rôle exact, et quels séjours doit‑il pouvoir
  ouvrir ? S'il est SIGNATAIRE et ouvre des séjours hors R1, il faut soit le rattacher à
  l'organisation de ces séjours (S1), soit prévoir une exception explicite. (Non vérifiable depuis
  le code.)
- **Q2 — Rôle `AUTORITE` (legacy).** Sur `updateStatus` (N4) et `GET /sejours` (`sejour.controller.ts:91`),
  faut‑il retirer `AUTORITE` du `@Roles` ou lui définir une règle d'ownership ?
- **Q3 — IBAN au comparatif.** Confirme‑t‑on le retrait de `iban` des payloads comparatif/getDevisForDemande
  (vérifier que le front ne l'affiche pas) ?
- **Q4 — Listes globales N5/N6.** `getDevisAValider`/`getFacturesAcompte` : scoping « collègues
  d'organisation » (S1) suffit‑il, ou un directeur doit‑il aussi voir les devis liés à ses
  invitations (S2) ? (impacte le `where`.)
- **Q5 — Périmètre passe B.** Traiter d'abord le **noyau données mineurs** (A1, A2, A3) puis la
  **famille commerciale/financière** (A4, A5, N1‑N11), ou tout en un lot ? Les écritures juridiques
  (N3 `signerDevis`, N2, N4, N9) méritent peut‑être un lot prioritaire dédié.
- **Q6 — Catégorie 3 factures.** Confirmer en lecture (passe B) que `ajouterVersement`/
  `supprimerVersement` filtrent réellement par centre (transmis mais corps non lu ici).

---

## 8. Synthèse — sites à corriger en passe B

**Noyau données mineurs (CRITIQUE) :** A1 (`verifyAccess`), A2 (`getSejourDetail`), A3 (`dossier-pedagogique`).
**Commercial/PII (HAUTE) :** A4 (`demande.findOne`), A5 (`getComparatif`), N1 (`getDevisForDemande`),
N7 (`getDemandeInfo`), N5/N6 (listes globales).
**Écritures (HAUTE, juridique/intégrité) :** N2 (`updateStatut`), N3 (`signerDevis`), N4 (`updateStatus`),
N9 (`validerAcompte`).
**Financier lecture (MOYENNE) :** N8 (`getFacturesForDevis`), N10 (`getChorusXml`), N11 (`downloadPdf`).

**Un seul nouveau module** (`auth/ownership.helper.ts`, 4 fonctions) couvre tous les sites.
Correction de `verifyAccess` en 1 ligne = 30 endpoints sécurisés. Aucune autre méthode service
impactée par les changements de signature (single‑caller confirmé).

**→ J'attends ta validation (et tes réponses Q1‑Q6) avant toute écriture de code en passe B.**
