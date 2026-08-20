# Chantier « Propriété client » — Plan d'exécution CC (racine complète)

> **Statut** : plan de travail. Rien codé, rien poussé. À valider étape par étape par Théo.
> **Rédigé à partir du code réel** (census MCP session 19/08/2026). Les ancrages marqués ✅ VÉRIFIÉ sont lus sur le code ; ceux marqués 🔍 À CENSER sont délégués à la Phase 1 CC de l'étape (jamais affirmés ici).
> **Objectif** : source unique de l'identité client (racine 1) + payeur/SIRET à la facture (racine 2). Prendre le problème à la racine, chirurgical, fix à la source, pas de patch, pas de dette inutile.

---

## 0. Décisions verrouillées (Théo, 19/08)

| # | Décision | Conséquence |
|---|---|---|
| D1 | **Payeur à la facture** (B-ii), SIRET **conditionnel** : requis pour payeur pro/public, jamais pour famille/particulier | La facture porte le payeur ; le séjour porte l'établissement |
| D2 | **Réutiliser les colonnes `destinataire*`** du `Devis` pour le payeur du devis principal | Zéro nouvelle colonne, on lève le garde `isComplementaire` |
| D3 | **Chaîne `clientOrganisation` seule** pour l'identité (pas d'entité `Organisation` ni `clientOrganisationId`) | Étape 1 capture une chaîne ; pas de dédoublonnage serveur |
| D4 | **Migration prod avec garde-fous** (pas de staging), rehearsal sur env local prod-like | Le seul risque est un backfill SQL de données ; procédure §7 |

**Fait structurant** : **aucune migration de schéma Prisma sur tout le chantier.** Tous les champs existent déjà. Donc **aucun `prisma migrate dev/deploy`** n'est produit. Le squash de migrations / staging n'est plus un prérequis. Le seul acte sur la prod est un script SQL de backfill (§7).

---

## 1. La carte du code (ce que lit quoi, aujourd'hui) — ✅ VÉRIFIÉ

Trois mondes coexistent :

- **DIRECT** — hébergeur crée via planning → `POST /sejours/direct` → `SejourService.createDirect`. Champs client stockés **sur le séjour** (`clientNom/Prenom/Email/Telephone/Organisation/Adresse/CodePostal/Ville`).
- **COLLAB-hybride** — séjour DIRECT + `InvitationCollaborationService.accepter()` sur un séjour existant : le devis conserve `sejourDirectId` ET reçoit `demandeId`. Forme canonique NDL.
- **COLLAB-pur** — `creerDepuisCatalogue` (devis avec `demandeId` seul, aucun champ client sur le séjour) ou `accepter()` branche DRAFT.

Chaîne de lecture actuelle, par document :

| Document | Fichier | DIRECT / hybride | COLLAB-pur |
|---|---|---|---|
| **Devis PDF** | `TabDevisFacturation.tsx` (mapping `pdfPropsDirect` / `pdfProps`) | `etablissementNom: sejour?.clientOrganisation` ✅ | `createur?.memberships?.[0]?.organisation.nom` ❌ |
| **Convention** | `devis.service.ts` (assemblage `genererConvention`) | `if (devis.sejourDirect)` → `sd.clientOrganisation \|\| sd.clientNom` ✅ | branche `else` → `getOrganisationPrincipale(createur)` ❌ |
| **Facture destinataire** | `facture.service.ts` (`construireDestinataire`) | branche « Devis direct » → `sejour?.clientOrganisation ?? nomClient`, **`destinataireSiret: null` en dur** | branche `demandeId` → `getOrganisationPrincipale(createur)`, `orga?.siret` |

**Isolation prouvée** : `construireDestinataire` n'est appelé **que** par l'émission de facture (`emettreAcompte/Solde/Total`). Le devis PDF (front) et la convention (`devis.service`, module distinct de `facture.service`) lisent les champs séjour / membership en direct, **jamais** `construireDestinataire`. → **Brancher un payeur au niveau facture ne fuit ni dans le devis ni dans la convention.** C'est le fondement de la racine 2 (§ Étape 5).

**Invariant dur du chantier** (déduit du code) :
> **Projeter les champs séjour AVANT de basculer la lecture des documents, basculer la lecture AVANT d'ouvrir l'édition.**
> Sinon : basculer la lecture avant projection = tous les dossiers collab existants affichent du vide.

---

## 2. Règles d'or (s'appliquent à CHAQUE étape)

1. **2 phases par étape** : Phase 1 = census MCP lecture-seule + STOP. Phase 2 = écriture, seulement après validation explicite de Théo (« ok »).
2. **Backend et frontend = prompts séparés.**
3. **Fix à la source, jamais de patch.** Si un comportement est faux, on corrige la fonction qui le produit, pas l'appelant.
4. **Code mort → supprimé.** Chaque étape liste les candidats. On ne laisse pas de dette « au cas où » sans justification explicite écrite.
5. **Gates à chaque commit** : `tsc --noEmit` = 0 erreur, `build` OK, suites de tests vertes. Aucun commit sur gate rouge.
6. **Diff relu par Claude sur les fichiers réels** (MCP), jamais sur un récap CC, avant que Théo pousse. **CC ne pousse jamais.**
7. **Commits atomiques**, un par sous-changement cohérent. Jamais `git amend` (toujours un nouveau commit).
8. **Après toute session CC interrompue** : `git status` + `git log` avant toute action.

**Ordre de bataille recommandé sur la semaine :**
`Étape 1 (saisie)` → `Étape 2 (projection) + backfill SQL` → `Étape 3 (bascule lecture)` → `Étape 4 (édition)` → `Étape 5 (payeur facture)`.
- **2 et 3 déploient ENSEMBLE** (couplage dur : bascule sans projection = vide).
- **Étape 5 est indépendante** (parallélisable, peut passer en premier si tu veux un quick win conformité sur Choucas).

---

## ÉTAPE 1 — Saisie de l'établissement à la création DIRECT

**Objectif** : capturer `sejour.clientOrganisation` (chaîne) de façon fiable, y compris pour les écoles publiques que SIRENE ne remonte pas. Une fois la chaîne posée, tous les documents DIRECT l'affichent (déjà branchés, §1).

**Cause racine** : dans `CreateSejourModal.tsx`, mode Professionnel, le nom d'établissement ne peut venir que d'un clic sur un résultat de recherche **SIRENE-seule** (`/organisations/search`). Pas de saisie manuelle, et SIRENE ne connaît pas les écoles publiques → nom perdu.

**Fix à la source** : (a) remplacer la recherche bespoke SIRENE-seule par le composant `OrganisationSearch` (ÉN + SIRENE, déjà en prod ailleurs) ; (b) rendre le champ « nom d'établissement » **toujours éditable** (la recherche ne fait que le pré-remplir).

### Fichiers
- `frontend/src/components/_shared/CreateSejourModal.tsx` (ou `frontend/app/dashboard/_shared/CreateSejourModal.tsx`) 🔍 À CENSER (chemin + code exact)
- `frontend/src/components/OrganisationSearch.tsx` ✅ existe, expose `onSelect(OrganisationResult)` 🔍 forme exacte de `OrganisationResult` à re-confirmer
- `frontend/src/lib/etablissements.ts` (mappers ÉN/SIRENE) ✅ vivant
- `backend/src/sejours/dto/create-sejour-direct.dto.ts` 🔍 champs acceptés (`clientOrganisation` présent ?)
- `SejourService.createDirect` ✅ VÉRIFIÉ : écrit déjà `clientOrganisation: dto.clientOrganisation ?? null`

### PROMPT CC — ÉTAPE 1, PHASE 1 (census lecture-seule)

```
CONTEXTE : chantier "propriété client". On veut fiabiliser la capture du nom
d'établissement à la création d'un séjour DIRECT (mode Professionnel), pour les
écoles que SIRENE ne remonte pas. Décision : capturer une CHAÎNE clientOrganisation
(pas d'entité). On veut remplacer la recherche SIRENE-seule par le composant
OrganisationSearch (ÉN+SIRENE) + champ nom toujours éditable.

Vérifie tout sur le CODE RÉEL, ne te contente pas des constats de ce doc.

PHASE 1 — LECTURE SEULE. Ne modifie AUCUN fichier. Lis et rapporte :

1. CreateSejourModal (trouve son chemin exact) :
   - la fonction de recherche actuelle (fireStructSearch ou équivalent) : quel endpoint
     appelle-t-elle ? quelle forme de résultat ? quel handler à la sélection (selectStruct) ?
   - quels champs sont posés dans l'état selectedOrg et lesquels sont ENVOYÉS dans le
     payload de POST /sejours/direct (clientOrganisation ? clientOrganisationId ? adresse ?)
   - le mode Particulier vs Professionnel : où est la bascule, quel champ nom existe déjà
   - le type TypeScript du résultat de recherche bespoke (StructResult ?) : est-il utilisé
     AILLEURS que dans cette modale ?
2. OrganisationSearch.tsx : signature de onSelect, forme exacte de OrganisationResult
   (nom, siret, uai, adresse, codePostal, ville, email, telephone, typeClient ?).
3. La lib qui appelle POST /sejours/direct (createSejourDirect) : signature, champs.
4. create-sejour-direct.dto.ts : liste des champs, lesquels sont optionnels.
5. Recherche : l'endpoint /organisations/search (SIRENE-seule) est-il utilisé
   par d'AUTRES écrans que CreateSejourModal ? (grep côté front)

STOP. Rends un rapport clair. N'écris pas de code. N'exécute pas la Phase 2.
```

### Cascades anticipées / pièges
- **Swap `OrganisationSearch`** : `onSelect` renvoie un `OrganisationResult` plus riche que le résultat bespoke → le handler `selectStruct` doit être réécrit pour mapper les nouveaux champs (dont `email`/`telephone` de l'ÉN, qui peuvent **pré-remplir** contact — bénéfice, mais à câbler explicitement).
- **Le champ nom doit rester éditable après sélection** : une sélection pré-remplit, une frappe écrase. Pas de champ en lecture seule qui piège l'utilisateur.
- **Particulier vs Professionnel** : la saisie manuelle du nom d'établissement ne concerne que le **Professionnel**. Ne pas casser le mode Particulier (événements Sauvageon = famille, pas d'org).
- **CRM aval** : `linkSejourToClient` (✅ VÉRIFIÉ) crée le `Client` CRM avec `nom: clientOrganisation || clientNom`. Capturer l'org améliore donc aussi le nom du client CRM — effet de bord **positif**, à vérifier qu'il ne crée pas de doublon CRM sur les séjours déjà liés.

### PROMPT CC — ÉTAPE 1, PHASE 2 (écriture, APRÈS validation)

```
PHASE 2 — ÉCRITURE. Uniquement après validation explicite du rapport de Phase 1.

Objectif : dans CreateSejourModal (mode Professionnel), remplacer la recherche
SIRENE-seule par OrganisationSearch (ÉN+SIRENE), et rendre le champ "nom
d'établissement" toujours éditable (la recherche pré-remplit, la frappe écrase).
Le payload POST /sejours/direct doit envoyer clientOrganisation (chaîne) +
clientAdresse/CodePostal/Ville si disponibles. NE PAS envoyer clientOrganisationId
(décision : chaîne seule). Pré-remplir clientEmail/clientTelephone depuis le
résultat ÉN si présents ET si les champs contact sont vides.

Contraintes :
- Mode Particulier inchangé.
- Fix à la source : réécrire selectStruct proprement, ne pas empiler un second champ.
- CODE MORT : si le remplacement rend la recherche bespoke (fireStructSearch, type
  StructResult, appel /organisations/search) inutilisée DANS cette modale ET nulle part
  ailleurs (confirmé en Phase 1), SUPPRIME-la. Si /organisations/search est utilisé
  ailleurs, ne touche pas à l'endpoint, seulement au code local mort.
- Gates : tsc --noEmit = 0, build OK, tests verts. Commits atomiques.
- Ne pousse pas.

STOP après implémentation. Liste les fichiers touchés et le code supprimé.
```

### Code mort à traiter
- Recherche bespoke SIRENE-seule locale à la modale (`fireStructSearch`, `StructResult`, handler `selectStruct` version SIRENE) → **supprimer si non réutilisée** (confirmé Phase 1). Endpoint `/organisations/search` : **ne pas toucher** sans preuve qu'il n'est utilisé nulle part.

### Gates
`tsc` 0, build, tests. Recette manuelle : créer un séjour DIRECT pour une école publique inconnue de SIRENE → le nom saisi doit apparaître sur le devis PDF.

---

## ÉTAPE 2 — Projection de l'identité sur les séjours COLLAB

**Objectif** : les chemins COLLAB-pur (`creerDepuisCatalogue`, `accepter()` branche DRAFT) ne posent **aucun** champ client sur le séjour. Les faire **projeter** l'organisation de l'enseignant (`getOrganisationPrincipale`) dans les champs séjour, en tampon one-shot à la création/rattachement. + backfill des dossiers existants (§7).

**Cause racine** : identité éclatée entre membership (COLLAB) et champs séjour (DIRECT). La projection unifie **la source d'écriture**.

### Fichiers ✅ VÉRIFIÉ (déjà lus)
- `SejourService.creerDepuisCatalogue` — ne pose aucun champ client. **Point de projection #1.**
- `InvitationCollaborationService.accepter()` :
  - branche **séjour DIRECT existant** → produit la forme **hybride** (devis garde `sejourDirectId`) → lit déjà les champs séjour → **PAS de projection nécessaire** (le séjour DIRECT a déjà, ou aura via étape 1, son `clientOrganisation`).
  - branche **DRAFT** (crée un séjour COLLAB-pur) → **Point de projection #2.**
- `getOrganisationPrincipale` ✅ retourne l'`Organisation` complète (nom, adresse, codePostal, ville, uai…).

### Pièges / cascade
- **NDL n'est pas un bug de projection mais de donnée manquante** : si l'enseignant n'a **aucun** membership primary (cas Jocelyne), `getOrganisationPrincipale` renvoie `null` → la projection laisse les champs à `null`. La projection **ne peut pas inventer** une org absente. → Deux effets : (a) la projection doit gérer `null` proprement (fallback nom enseignant, pas de crash) ; (b) le backfill (§7) doit **distinguer** les dossiers avec org (projetables) des dossiers sans membership (à corriger d'abord comme NDL : créer le membership).
- **Projection = tampon one-shot, pas un fil vivant** : on copie à la création/rattachement, on ne resynchronise pas ensuite (cohérent avec la règle « org↔centre = design, pas bug »).
- **Ne PAS projeter dans la branche hybride** de `accepter()` (elle lit déjà le séjour) — sinon double source.

### PROMPT CC — ÉTAPE 2, PHASE 1 (census)

```
CONTEXTE : chantier "propriété client", étape projection. On veut que les séjours
COLLAB-pur portent l'identité de l'établissement dans LEURS PROPRES champs
(clientOrganisation, clientAdresse, clientCodePostal, clientVille), copiée depuis
l'organisation principale de l'enseignant à la création/rattachement.

Vérifie tout sur le CODE RÉEL, ne te contente pas des constats de ce doc.

PHASE 1 — LECTURE SEULE. Ne modifie rien. Rapporte :

1. SejourService.creerDepuisCatalogue : confirme qu'aucun champ client* n'est posé.
   Quels champs du séjour sont écrits ? La transaction $transaction englobe quoi ?
2. InvitationCollaborationService.accepter() :
   - branche "séjour DIRECT existant" : confirme que le devis garde sejourDirectId
     (forme hybride) et NE crée PAS de séjour neuf.
   - branche "DRAFT" : confirme qu'elle crée un séjour COLLAB-pur sans champs client*.
3. getOrganisationPrincipale : confirme le type de retour (Organisation complète) et
   les champs disponibles (nom, adresse, codePostal, ville, uai).
4. Le modèle Sejour dans schema.prisma : liste EXACTE des colonnes client*
   (clientNom, clientPrenom, clientEmail, clientTelephone, clientOrganisation,
   clientOrganisationId, clientAdresse, clientCodePostal, clientVille) et leur
   nullability. Confirme qu'AUCUNE colonne nouvelle n'est nécessaire. Note aussi le
   nom réel de la table (mapping @@map) et la casse des colonnes, pour le backfill SQL.
5. Combien de séjours en base ont modeGestion=COLLABORATIF avec clientOrganisation
   NULL ? (requête de comptage read-only, pas de modif) — pour dimensionner le backfill.

STOP. Rapport clair. N'exécute pas la Phase 2.
```

### PROMPT CC — ÉTAPE 2, PHASE 2 (écriture)

```
PHASE 2 — ÉCRITURE. Après validation.

Dans creerDepuisCatalogue ET dans accepter() branche DRAFT (PAS la branche hybride) :
après création du séjour, résoudre org = getOrganisationPrincipale(enseignantId) et,
SI org non-null, écrire sur le séjour clientOrganisation=org.nom,
clientAdresse=org.adresse, clientCodePostal=org.codePostal, clientVille=org.ville.
Si org est null : ne rien projeter (laisser null), ne pas crasher.

Contraintes :
- Écriture DANS la même transaction que la création du séjour (pas de fenêtre
  d'incohérence). Réutiliser le tx existant.
- Aucune nouvelle colonne (confirmé Phase 1). Aucun prisma migrate.
- Ne touche PAS la branche hybride de accepter() (elle lit déjà le séjour).
- Fix à la source. Gates : tsc 0, build, tests. Commits atomiques. Ne pousse pas.

STOP. Fichiers touchés + confirmation qu'aucune migration n'est générée.
```

### Code mort
Aucun attendu. `getOrganisationPrincipale` reste utilisé ailleurs (rectorat, directeur) → **conserver**.

---

## ÉTAPE 3 — Bascule de la lecture COLLAB vers les champs séjour

**Objectif** : les 3 documents lisent les champs séjour aussi en COLLAB (plus de `getOrganisationPrincipale`/membership pour l'identité destinataire). **Déploie avec l'étape 2 + backfill** (couplage dur).

**Cause racine** : lectures divergentes selon le monde. On unifie **la source de lecture** = champs séjour, partout.

### Points de bascule ✅ VÉRIFIÉ (structure) / 🔍 lignes exactes à censer
1. **Convention** — `devis.service.ts`, assemblage `genererConvention`, branche `else` (COLLAB) qui lit `getOrganisationPrincipale`. 🔍 code exact à lire en Phase 1.
2. **Facture** — `facture.service.ts`, `construireDestinataire`, branche `if (devis.demandeId && devis.demande)` qui lit `getOrganisationPrincipale(createurId)`. ✅ VÉRIFIÉ.
3. **Devis PDF** — `TabDevisFacturation.tsx`, mapping COLLAB `pdfProps` : `etablissementNom: createur?.memberships?.[0]?.organisation.nom`. ✅ VÉRIFIÉ.

### Pièges / cascade
- **Préserver la forme hybride NDL** : un devis avec `sejourDirectId` (hybride) doit continuer à lire le séjour. La bascule ne concerne QUE les devis COLLAB-pur (`demandeId` sans `sejourDirectId`). Le point 2 (`construireDestinataire`) traite déjà la branche complémentaire et la branche direct AVANT la branche `demandeId` — l'ordre des branches doit rester correct.
- **Attention à la source de la donnée après bascule** : le point 3 (devis PDF) reçoit `createur.memberships[0].organisation` via l'objet `budgetData.sejour.createur`. Après bascule il doit lire `sejour.clientOrganisation` / `sejour.clientAdresse` — **vérifier que ces champs sont bien exposés dans le payload `SejourCollabInfo`** (sinon il faut les inclure côté backend dans la réponse qui alimente le front). 🔍 à censer.
- **Régression silencieuse possible** : si le backfill (§7) n'a pas tourné AVANT la bascule, les dossiers collab affichent du vide. → **Ne jamais merger l'étape 3 sans que le backfill soit passé en prod.** Ordre de déploiement §8.

### PROMPT CC — ÉTAPE 3, PHASE 1 (census)

```
CONTEXTE : chantier "propriété client", bascule de lecture. Les documents doivent
lire l'identité de l'établissement depuis les champs séjour (clientOrganisation,
clientAdresse, clientCodePostal, clientVille) AUSSI en mode collaboratif, au lieu de
getOrganisationPrincipale / membership. La forme hybride (devis avec sejourDirectId)
doit rester inchangée (elle lit déjà le séjour).

Vérifie tout sur le CODE RÉEL, ne te contente pas des constats de ce doc.

PHASE 1 — LECTURE SEULE. Rapporte :

1. devis.service.ts, génération de convention (genererConvention et le builder
   convention-scolaire) : montre la branche qui distingue DIRECT (devis.sejourDirect)
   de COLLAB (else). Que lit exactement la branche else aujourd'hui ? Quels champs
   destinataire alimente-t-elle dans les props du PDF ?
2. facture.service.ts, construireDestinataire : confirme l'ordre des branches
   (complémentaire → demandeId → direct) et ce que lit la branche demandeId.
3. TabDevisFacturation.tsx, mapping COLLAB (pdfProps, bloc !isDirect) : confirme
   etablissementNom/adresseDestinataire = createur.memberships[0].organisation.*.
4. Le payload qui alimente le front collab (SejourCollabInfo / la route qui charge
   le séjour côté hébergeur) : expose-t-il DÉJÀ sejour.clientOrganisation /
   clientAdresse / clientCodePostal / clientVille ? Si non, où les ajouter ?
5. Y a-t-il d'autres lecteurs de getOrganisationPrincipale pour l'identité DESTINATAIRE
   (hors rectorat/directeur, qui sont légitimes) ? (grep)

STOP. Rapport clair, en distinguant ce qui lit membership vs séjour. N'exécute pas la Phase 2.
```

### PROMPT CC — ÉTAPE 3, PHASE 2 (écriture — backend puis frontend, commits séparés)

```
PHASE 2 — ÉCRITURE. Après validation ET après confirmation que le backfill prod
est prévu/fait (l'étape 3 ne doit pas partir seule).

Backend (commit 1) :
- convention (devis.service) branche else COLLAB : lire sejour.clientOrganisation /
  clientAdresse / clientCodePostal / clientVille au lieu de getOrganisationPrincipale.
  Fallback nom enseignant si clientOrganisation null.
- construireDestinataire branche demandeId : idem — destinataireNom =
  sejour.clientOrganisation ?? nom enseignant ; adresse depuis champs séjour.
  (Le SIRET destinataire de cette branche est traité à l'étape 5, ne pas y toucher ici.)
- Si le payload collab n'expose pas les champs séjour (Phase 1 #4), les inclure.
- NE PAS modifier la lecture des devis hybrides (sejourDirectId présent).

Frontend (commit 2) :
- TabDevisFacturation mapping COLLAB : etablissementNom/adresseDestinataire depuis
  sejour.clientOrganisation / clientAdresse-CodePostal-Ville au lieu de
  createur.memberships[0].organisation.

Contraintes : fix à la source, pas de patch conditionnel. Gates tsc 0 / build / tests.
Commits atomiques (backend, puis frontend). Ne pousse pas.

STOP. Diff résumé + confirmation que la forme hybride est intacte.
```

### Code mort
Après bascule, vérifier si des `include: { memberships }` deviennent inutiles dans les requêtes qui alimentaient uniquement l'identité destinataire. **Supprimer les include devenus morts** (allège les requêtes) — mais seulement après avoir confirmé qu'aucun autre champ de l'objet ne les utilise. 🔍 à vérifier au diff.

---

## ÉTAPE 4 — Ouvrir l'édition de l'établissement

**Objectif** : pouvoir corriger `clientOrganisation` (et adresse) après création, côté hébergeur, sur la page séjour.

**Cause racine** : `updateInfosSejour` gère nom/adresse client mais **pas** l'organisation → l'établissement n'est éditable nulle part après création. `SejourHeader` gate l'édition sur `isDirect`.

### Fichiers 🔍 À CENSER (non lus — ne rien affirmer)
- `frontend/app/dashboard/sejour/[id]/_components/SejourHeader.tsx` — gating `isDirect`, formulaire d'édition client.
- `backend` `updateInfosSejour` (route + service) — champs actuellement modifiables.

### PROMPT CC — ÉTAPE 4, PHASE 1 (census)

```
CONTEXTE : chantier "propriété client", édition. On veut rendre clientOrganisation
éditable après création, côté hébergeur, sur la page séjour.

Vérifie tout sur le CODE RÉEL.

PHASE 1 — LECTURE SEULE. Rapporte :
1. SejourHeader.tsx : où est l'édition des infos client (bouton crayon), quels champs
   sont éditables aujourd'hui (clientNom/Prenom/Email/Telephone/Adresse ?), et
   clientOrganisation en fait-il partie ? La condition isDirect gate-t-elle l'édition ?
   Faut-il l'ouvrir aussi aux séjours collab (après bascule étape 3) ou DIRECT seul ?
2. Backend updateInfosSejour (trouve route + service) : quels champs le DTO accepte,
   quels champs sont écrits, quelles gardes de propriété (centre owner).
3. clientOrganisation est-il déjà dans le DTO/service mais juste pas exposé côté UI,
   ou totalement absent des deux côtés ?

STOP. Rapport clair. N'exécute pas la Phase 2.
```

### Pièges / cascade
- Décider si l'édition s'ouvre aussi aux séjours **collab** (cohérent après étape 3, puisqu'ils lisent désormais les champs séjour) ou reste **DIRECT-only** dans un premier temps. À trancher avec Théo au vu du rapport Phase 1.
- Garde de propriété : l'édition doit rester bornée au centre propriétaire (ne pas régresser la sécurité).

### PROMPT CC — ÉTAPE 4, PHASE 2 (écriture)

```
PHASE 2 — ÉCRITURE. Après validation + décision "DIRECT-only ou collab aussi".

- Backend updateInfosSejour : étendre le DTO et l'écriture à clientOrganisation
  (+ clientAdresse/CodePostal/Ville si pas déjà couverts). Conserver la garde de
  propriété existante.
- Frontend SejourHeader : ajouter le champ "établissement" dans le formulaire
  d'édition client, avec (optionnel) OrganisationSearch pour pré-remplir.

Fix à la source. Gates tsc 0 / build / tests. Commits atomiques. Ne pousse pas.
STOP.
```

### Code mort
Aucun attendu.

---

## ÉTAPE 5 — Payeur à la facture (racine 2) — indépendante

**Objectif** : la facture principale peut être adressée à un **payeur** distinct de l'établissement (mairie, OGEC, asso), avec son SIRET, requis pour Chorus Pro / e-invoicing. Famille → aucun payeur renseigné → comportement actuel (destinataire = client séjour, SIRET null).

**Cause racine** : `construireDestinataire` bride les champs `destinataire*` du devis à `isComplementaire`, et force `destinataireSiret: null` sur la branche direct. On lève le garde (D2).

### Fichiers ✅ VÉRIFIÉ / 🔍
- `facture.service.ts` `construireDestinataire` ✅ : branche 1 = `if (devis.isComplementaire && devis.destinataireNom)`. Colonnes `devis.destinataire{Nom,Adresse,CodePostal,Ville,Siret,Email}` existent et sont lues.
- `TabDevisFacturation.tsx` : la modale complémentaire (`handleSelectCompOrg`, `OrganisationSearch`) est le pattern à réutiliser pour la section payeur du devis principal. ✅
- Formulaire devis principal : `frontend/app/dashboard/hebergeur/devis/nouveau` et `/[id]/modifier` 🔍 À CENSER.
- `create-devis` / `update-devis` DTO backend 🔍 acceptent-ils déjà `destinataire*` pour un devis principal ?

### Le fix, précisément
1. **Backend** — `construireDestinataire` : lever la condition `isComplementaire`. Nouvelle logique : **si `devis.destinataireNom` est renseigné → l'utiliser comme destinataire** (nom + adresse + `destinataireSiret` + email), quel que soit `isComplementaire`. Sinon → logique actuelle (direct → séjour ; demandeId → séjour après étape 3). Cela remplace du même coup le `destinataireSiret: null` en dur de la branche direct **quand un payeur est renseigné**.
2. **Frontend** — formulaire devis principal (nouveau/modifier) : ajouter une section **« Payeur (facturation) — optionnel »** avec `OrganisationSearch` (mairie/OGEC/asso) qui remplit `destinataireNom/Adresse/CodePostal/Ville/Siret/Email`. Laisser vide = pas de payeur distinct.

### Pièges / cascade
- **Ne pas casser les devis complémentaires** : ils ont toujours `destinataireNom` renseigné → la nouvelle condition `if (devis.destinataireNom)` les couvre à l'identique. Vérifier qu'aucune logique aval ne dépend de `isComplementaire` pour distinguer (ex. `sejourId` de retour, notifications).
- **Isolation confirmée** (§1) : le payeur alimente `construireDestinataire` (facture) uniquement. Le devis PDF et la convention continuent d'afficher l'établissement. **C'est le comportement voulu** (le devis engage l'établissement ; la facture va au payeur). Le confirmer explicitement à la recette.
- **Chorus Pro / Factur-X** : `getChorusXml` et `embedFacturX` lisent le snapshot Facture (`facture.destinataireSiret`). Une fois le payeur renseigné, le SIRET remonte automatiquement dans le XML CII. Vérifier qu'aucune validation aval ne rejette un `destinataireSiret` désormais non-null (c'était l'objectif). 🔍 vérifier au diff.
- **Devis déjà signé, payeur ajouté après** : le payeur peut être saisi jusqu'à l'émission (le devis reste modifiable tant que non facturé — déjà le cas via "Modifier le devis"). L'émission fige le snapshot. Cohérent.

### PROMPT CC — ÉTAPE 5, PHASE 1 (census)

```
CONTEXTE : chantier "propriété client", payeur à la facture. On veut qu'un devis
principal puisse porter un payeur distinct (destinataireNom/Adresse/CodePostal/Ville/
Siret/Email, colonnes DÉJÀ existantes, aujourd'hui réservées aux devis complémentaires),
et que la facture l'utilise comme destinataire. Famille = pas de payeur, comportement
actuel conservé.

Vérifie tout sur le CODE RÉEL.

PHASE 1 — LECTURE SEULE. Rapporte :
1. facture.service.ts construireDestinataire : la condition exacte de la branche
   complémentaire (isComplementaire && destinataireNom) et tout ce qui, en aval,
   dépend de isComplementaire (sejourId retourné, notifications, logs).
2. Le formulaire devis principal (dashboard/hebergeur/devis/nouveau et /[id]/modifier) :
   structure, comment il construit le payload create/update devis, où insérer une
   section "Payeur (facturation)" optionnelle. Réutilise-t-il déjà OrganisationSearch ?
3. Les DTO create-devis / update-devis : acceptent-ils destinataireNom/Adresse/
   CodePostal/Ville/Siret/Email pour un devis principal, ou seulement pour le
   complémentaire ? Le service devis les écrit-il pour un devis principal ?
4. getChorusXml et embedFacturX : confirment-ils lire facture.destinataireSiret depuis
   le snapshot ? Une validation rejette-t-elle un SIRET présent (l'inverse du bug) ?

STOP. Rapport clair. N'exécute pas la Phase 2.
```

### PROMPT CC — ÉTAPE 5, PHASE 2 (écriture — backend puis frontend)

```
PHASE 2 — ÉCRITURE. Après validation.

Backend (commit 1) — construireDestinataire :
- Remplacer la condition de la branche 1 : si devis.destinataireNom est renseigné,
  retourner le payeur (destinataireNom/Adresse (sérialisée)/Siret/Email) — SANS
  exiger isComplementaire. Conserver le sejourId de retour cohérent (sejourDirectId
  ?? demande.sejour.id selon le cas) pour que le log CRM reste correct.
- Vérifier que les branches suivantes (direct / demandeId) restent le fallback quand
  destinataireNom est vide.
- create-devis / update-devis DTO + service : autoriser l'écriture de destinataire*
  sur un devis principal (si Phase 1 montre qu'ils sont bridés au complémentaire).

Frontend (commit 2) — formulaire devis principal :
- Ajouter une section "Payeur (facturation) — optionnel" avec OrganisationSearch
  (réutiliser le pattern handleSelectCompOrg) remplissant destinataireNom/Adresse/
  CodePostal/Ville/Siret/Email. Vide = pas de payeur distinct.

Contraintes : ne pas casser les devis complémentaires (destinataireNom toujours
présent chez eux). Fix à la source. Gates tsc 0 / build / tests. Commits atomiques.
Ne pousse pas.

STOP. Diff + confirmation : devis PDF et convention affichent toujours l'établissement,
seule la facture bascule vers le payeur quand renseigné.
```

### Code mort
Aucun attendu (on étend l'usage de colonnes existantes).

---

## 7. Backfill SQL prod (rattaché à l'étape 2, garde-fous D4)

**Cible** : séjours COLLAB-pur existants (`modeGestion=COLLABORATIF`, `clientOrganisation IS NULL`) dont l'enseignant a une org principale → projeter cette org dans les champs séjour. Distinguer ceux **sans** membership (à traiter comme NDL : créer le membership d'abord, sinon rien à projeter).

**Procédure (jamais d'UPDATE sans SELECT préalable) :**

1. **Rehearsal local d'abord** : dump prod → restore sur l'env local prod-like → jouer le script → vérifier les documents (devis/convention/facture) sur 2-3 dossiers → seulement ensuite prod.
2. **SELECT de cadrage** (identifier les dossiers, compter, repérer les sans-org) — noms de tables/colonnes à confirmer en Phase 1 étape 2 (mapping Prisma) :
```sql
SELECT s.id, s.titre, s."clientOrganisation", s."createurId",
       o.id AS org_id, o.nom AS org_nom
FROM "Sejour" s
LEFT JOIN "Membership" m ON m."userId" = s."createurId" AND m."isPrimary" = true
LEFT JOIN "Organisation" o ON o.id = m."organisationId"
WHERE s."modeGestion" = 'COLLABORATIF'
  AND s."clientOrganisation" IS NULL
  AND s."deletedAt" IS NULL;
```
   - Lignes avec `org_id` non-null → projetables.
   - Lignes avec `org_id` null → **pas de membership** : à traiter d'abord (créer org+membership comme NDL), sinon exclues.
3. **UPDATE transactionnel, idempotent** (garde `WHERE clientOrganisation IS NULL`) :
```sql
BEGIN;
UPDATE "Sejour" s
SET "clientOrganisation" = o.nom,
    "clientAdresse"     = COALESCE(s."clientAdresse", o.adresse),
    "clientCodePostal"  = COALESCE(s."clientCodePostal", o."codePostal"),
    "clientVille"       = COALESCE(s."clientVille", o.ville)
FROM "Membership" m
JOIN "Organisation" o ON o.id = m."organisationId"
WHERE m."userId" = s."createurId"
  AND m."isPrimary" = true
  AND s."modeGestion" = 'COLLABORATIF'
  AND s."clientOrganisation" IS NULL
  AND s."deletedAt" IS NULL;
-- VÉRIFIER le nombre de lignes touchées vs le SELECT de cadrage
COMMIT;   -- ou ROLLBACK si l'écart est suspect
```
4. **Ordre impératif** : ce backfill passe **avant** le merge de l'étape 3 (bascule lecture). Sinon dossiers vides.

**Garde-fous récap** : rehearsal local, SELECT avant UPDATE, `BEGIN/COMMIT` avec vérification du compte de lignes, `WHERE ... IS NULL` idempotent, `COALESCE` pour ne pas écraser une donnée déjà saisie, `deletedAt IS NULL`. Noms de tables/colonnes confirmés en Phase 1 étape 2 avant toute exécution.

---

## 8. Ordre de déploiement

1. **Étape 1** (saisie) — autonome, déployable seule. Débloque les nouvelles créations DIRECT.
2. **Étape 2** (projection) — déployée, puis **backfill SQL** (§7) exécuté sur prod.
3. **Étape 3** (bascule lecture) — **seulement après** que le backfill est confirmé passé. 2+3+backfill forment un lot logique.
4. **Étape 4** (édition) — après 3.
5. **Étape 5** (payeur facture) — indépendante, insérable où tu veux (y compris en tête si tu veux la conformité Choucas d'abord).

À chaque déploiement : `git status`/`git log` avant, gates verts, diff relu par Claude sur fichiers réels, Théo pousse, preuve de déploiement avant de continuer.

---

## 9. Checklist de validation finale (recette)

- [ ] Séjour DIRECT, école publique inconnue SIRENE : nom saisi → visible sur devis PDF, convention, facture.
- [ ] Séjour COLLAB neuf (via catalogue) : org enseignant projetée → visible sur les 3 documents.
- [ ] Dossier NDL/hybride : inchangé, lit toujours le séjour, non régressé.
- [ ] Dossier COLLAB existant (post-backfill) : identité correcte sur les 3 documents.
- [ ] Édition de l'établissement depuis la page séjour : persiste et se reflète sur les documents.
- [ ] Facture avec payeur mairie renseigné : facture au nom + SIRET mairie ; **devis et convention** toujours au nom de l'école.
- [ ] Facture famille (pas de payeur) : comportement actuel, pas de SIRET, pas de régression.
- [ ] Devis complémentaire : inchangé.
- [ ] Chorus XML / Factur-X : `destinataireSiret` présent quand payeur renseigné.
- [ ] `tsc --noEmit` = 0, build OK, tests verts sur tout le chantier.
- [ ] Aucune migration Prisma générée (confirmer `prisma/migrations` inchangé).

---

## 10. Points restant à trancher avec Théo (au fil des Phase 1)

- **Étape 3** : les champs séjour sont-ils déjà exposés dans le payload collab, ou faut-il les ajouter ? (impacte l'ampleur du commit backend)
- **Étape 4** : édition DIRECT-only ou collab aussi ?
- **Étape 5** : les DTO devis acceptent-ils déjà `destinataire*` pour un principal, ou faut-il les ouvrir ?
- **Backfill §7** : noms de tables/colonnes réels (mapping Prisma) + traitement des dossiers sans membership.

Ces points sont volontairement laissés ouverts : ils dépendent de lectures que la Phase 1 de chaque étape confirmera sur le code réel, plutôt que d'être supposés ici.
