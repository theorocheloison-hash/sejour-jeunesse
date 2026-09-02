# Chantier Étape 4 — Propriété client hébergeur (identité + contact)

> **Statut** : doc de cadrage rédigé par Claude le 24/08/2026, à relire/valider par Théo AVANT tout prompt CC.
> **Extension du plan** `docs/CHANTIER_PROPRIETE_CLIENT_PLAN_CC.md` (décisions D1-D4 verrouillées, respectées ici). Répond à la question laissée ouverte au §10 : « Étape 4 : édition DIRECT-only ou collab aussi ? » → **collab aussi, override hébergeur**.
> **Zéro migration Prisma** sur tout le chantier (tous les champs existent : `sejour.clientNom/Prenom/Email/Telephone/Organisation/Adresse/CodePostal/Ville`).
> Tout ce qui est marqué ✅ est lu sur le code réel (session 24/08). Rien n'est supposé.

---

## 0. Décisions actées (Théo, 24/08)

| # | Décision | Justification |
|---|---|---|
| E1 | **Périmètre = identité + contact (email/tél), UN seul chantier** | 90% des cas : l'hébergeur crée le client et invite l'organisateur. Nogent le prouve (`client_email` séjour = login du compte créé par l'invitation). |
| E2 | **Sémantique = override hébergeur niveau séjour** : `sejour.client*` fait foi s'il est posé | Le compte enseignant = login + canal de notif applicative SEULEMENT. ✅ Vérifié : le compte n'est une source vivante pour RIEN (voir §1). |
| E3 | **Règle nom officiel vs nom commun** : nom OFFICIEL quand l'org a été validée via recherche SIREN ou Éducation nationale ; sinon nom COMMUN tapé par l'organisateur ou l'hébergeur | Encodée dans la provenance (`organisations.source` : API_SIRENE / API_EDUCATION_NATIONALE vs MANUAL). Conséquence : les 2 dossiers DIVERGENT (Ste-Marie `11ca2ea1`, Bruyères `c2edf74f`) gardent leur nom officiel — rien à renommer ; au Lot 2 leurs écrans passent commun→officiel (changement **voulu**). |
| E4 | **Découpage 3 lots, séquencé** : Lot 1 canonique → Lot 2 bascule des lecteurs → Lot 3 ouverture édition. **INVARIANT : jamais Lot 3 avant Lot 2** | Ouvrir l'édition avant la bascule = Anne édite et les écrans/documents divergent (bug NDL rejoué). Même invariant que le plan §1. |
| E5 | **Route morte profil organisateur = backlog SÉPARÉ** (hors chantier) | Voir §8. |

---

## 1. Sémantique figée — et pourquoi elle est sûre (✅ vérifié sur code)

**Résolution du client d'un séjour (identité + contact), dans cet ordre :**
1. `sejour.client*` (posé par l'hébergeur ou par la projection Étape 2) — **fait foi**.
2. Fallback COLLAB legacy : org principale du créateur (`memberships[0].organisation`) pour le nom/adresse ; compte enseignant (`prenom/nom/email/telephone`) pour le contact.
3. `enseignant.email` garde UN rôle propre, jamais résolu : **canal de notification applicative** (c'est le login, là où l'organisateur clique).

**Pourquoi l'override est sans risque (vérifications 24/08) :**
- ✅ Page profil organisateur (`frontend/app/dashboard/organisateur/profil/page.tsx`) : prénom/nom/email/tél en **lecture seule** (`<p>`). Seuls éditables : établissement (bouton cassé, cf. §8) et mot de passe.
- ✅ Backend `users.controller.ts` : SEULES routes = `GET /users/me` + `PATCH /users/mon-profil` (**SIGNATAIRE only**, limité à `emailRectorat`). Aucune route n'écrit `email`/`telephone` d'un User.
- ✅ `PATCH /users/mon-etablissement` (appelé par la page profil) **n'existe pas au backend** → l'organisateur ne peut pas non plus repointer son org. La source OLD ne bouge que par flux d'inscription/admin/SQL.
- → **Il n'existe aucune valeur « plus fraîche » côté compte que l'override pourrait écraser.** Le compte est figé à l'inscription (souvent saisi par l'hébergeur dans l'invitation).

---

## 2. Architecture du canonique — ✅ TRANCHÉ 24/08 : OPTION A (util frontend + selects additifs)

Objectif commun aux 2 options : **une seule fonction de résolution**, plus jamais 11 variantes inline. Les documents backend (convention/facture) **ne changent pas** : ils lisent déjà `sejour.client*` (Étape 3 livrée) avec des fallbacks épinglés par tests (`resoudreEtablissement` 7 cas, `construireDestinataire` 2 cas COLLAB) — on ne les touche pas.

**Option A — util frontend partagé (RECO Claude).** Un fichier `frontend/src/lib/client-etablissement.ts` exportant `resolveClientEtablissement(sejour, enseignantOuCreateur)` → `{ nom, adresse, codePostal, ville, contactNom, contactEmail, contactTelephone, source: 'SEJOUR'|'MEMBERSHIP'|'COMPTE'|null }`. Les 11 lecteurs l'appellent. Côté backend : ajouts **additifs** de `clientOrganisation/Adresse/CodePostal/Ville/Email/Telephone/Nom/Prenom` dans les `select` des payloads qui ne les exposent pas encore.
- ✅ Chirurgical : les selects sont additifs (aucun risque de régression), un seul fichier neuf, testable en pur.
- ✅ Les 11 lecteurs sont TOUS frontend — la résolution vit là où sont les consommateurs.
- ❌ La logique de résolution existe 2 fois dans le repo (front pour les écrans, back pour les documents) — assumé : les deux ont des fallbacks différents ET testés, l'harmonisation silencieuse est précisément ce que les tests de `resoudreEtablissement` interdisent.

**Option B — champ calculé backend.** Chaque endpoint (devis, collab, budget, signataire, demandes) calcule et expose `clientEtablissement` résolu.
- ✅ Une seule résolution dans tout le système, le front devient bête.
- ❌ Invasif : NestJS renvoie les objets Prisma bruts, il faudrait mapper la réponse de CHAQUE endpoint (~8 endpoints à remodeler) — surface de régression bien plus grande pour le même résultat visible.
- ❌ Duplique quand même la logique vis-à-vis des résolveurs documents (qu'on ne peut pas fusionner sans casser les tests qui épinglent leurs fallbacks distincts).

**Reco : Option A.** Le « canonique » est la fonction, pas l'endroit où elle tourne. A donne la même garantie anti-divergence (interdit de lire `memberships` inline dans un composant — convention de revue) pour un dixième du risque.

---

## 3. Lot 1 — Le canonique (livrable seul, zéro changement visible)

**Contenu (si Option A) :**
1. `frontend/src/lib/client-etablissement.ts` : fonction pure + types. Résolution §1. Tests unitaires (mêmes cas que `resoudreEtablissement` + cas contact).
2. Backend : audit des payloads (liste §4) → ajouts ADDITIFS des champs `client*` manquants dans les `select` de `sejour`/`demande.sejour`/`sejourDirect`. Aucun retrait, aucun include resserré.
3. Rien d'autre. Aucun lecteur basculé (c'est le Lot 2). Déploiement invisible — modèle Étape 2 (projection).

**Gates** : tsc 0 / build / tests verts, commits backend et frontend séparés, diff relu par Claude sur fichiers réels, CC ne pousse pas.

---

## 4. Lot 2 — Bascule des 11 lecteurs OLD (le gros du travail = l'audit des payloads)

Liste exhaustive (source : `docs/audits/INDEX_CHAMPS_2026-08-21.md` §F, recoupée) :

| # | Fichier:ligne | Lecture OLD actuelle | Payload à auditer |
|---|---|---|---|
| 1 | `TabBudget.tsx:97-98` | `createur.memberships[0].organisation` | endpoint budget (`getBudgetData`) |
| 2 | `TabBudget.tsx:117` | idem | idem |
| 3 | `DevisCard.tsx:73-78` `resolveEtablissement` | ⚠️ OLD **PRIORITAIRE** : `memberships ?? enseignant ?? sejourDirect?.clientOrganisation` — inverser en `sejour.client* d'abord`, en PRÉSERVANT le fallback DIRECT | `getMesDevis` / `getDevisForSejour` (✅ incluent déjà `memberships take 1` sous enseignant/créateur + `clientOrganisation` sous `sejourDirect` — mais PAS sous `demande.sejour` : à vérifier/ajouter) |
| 4 | `DevisCard.tsx:117-118` `buildPdfProps` | `ens?.memberships[0].organisation.nom` → le PDF devis COLLAB porte l'identité OLD | idem |
| 5 | `organisateur/demandes/page.tsx:103-104` | memberships | endpoint demandes organisateur |
| 6 | `organisateur/sejours/[id]/offres/page.tsx:85-86` | memberships | `getDevisForDemande` |
| 7 | `signataire/page.tsx:147-148,189-190` | memberships | endpoints signataire |
| 8 | `hebergeur/devis/nouveau/page.tsx:301-305` | memberships | `getDemandeInfo` |
| 9 | `hebergeur/devis/[id]/modifier/page.tsx:208-212` | memberships | `getDevisById` |
| 10 | `PreparationTamPDF.tsx:58` | memberships | payload TAM |
| 11 | `ProjetPedagogiquePDF.tsx:181-183` | memberships | payload projet pédago |

Déjà basculés NEW (ne pas retoucher) : `facture.service.ts:283`, `devis/signer/[token]/page.tsx:192-199`, convention (`resoudreEtablissement`).

**⚠️ Changements VISIBLES attendus au déploiement du Lot 2 — voulus, à prévenir à Anne :**
- 2 dossiers (Ste-Marie, Bruyères) : nom commun → nom officiel SIRENE (règle E3).
- 5 dossiers Lot-B (0 membership) : écrans internes vides → remplis.
- = **7 dossiers changent d'affichage.** C'est le but, pas une régression. Liste = recette.

**Ne PAS faire au Lot 2** : retirer les `include memberships` des payloads (nettoyage ultérieur, une fois les 11 basculés et recettés — retirer en même temps = impossible de distinguer une régression de bascule d'une régression d'include).

---

## 4bis. Résultats census Phase 1 (24/08) — PÉRIMÈTRE FINAL (décisions Théo 24/08)

Source : `docs/audits/CENSUS_ETAPE4_LOT1_2026-08-24.md`, contre-vérifié par Claude sur code réel (getComparatif, findOpen, sejour.service includes, + lectures intégrales devis.service de session).

- **Liste close réelle = 11 + 6 lecteurs (E-a…E-f)**. DÉCISION : E-a/E-b (recherche `hebergeur/devis/page.tsx:101,104`), E-e (`TabProjetPedagogique.tsx:88-90`), E-f (`invitation-direction/[token]/page.tsx:76,93-94`) **INTÉGRÉS au Lot 2** → **15 lecteurs basculés**.
- **E-c/E-d (`hebergeur/demandes` via `findOpen`) EXCLUS** — justification : une demande OUVERTE n'a pas d'hébergeur-propriétaire (l'identité = org de l'enseignant, l'OLD y est CORRECT, pas legacy) ; `findOpen` masque le contact par plan (Découverte → email/tél null) et des champs `client*` ajoutés passeraient à travers ce masquage (fuite RGPD). **INTERDICTION permanente, tous lots : `findOpen` ne reçoit AUCUN champ `client*`.**
- **3 lecteurs déjà SOMBRES** (#6 offres via getComparatif, #7-PDF signataire via getDevisAValider, #9 modifier via getDevisById : payload sans le champ lu → vide aujourd'hui, vérifié). Leur bascule = **vide→rempli sur TOUS les dossiers COLLAB** de ces surfaces — amélioration voulue, recette élargie (§7).
- **Backend Lot 1 : 10 endpoints à compléter** (les 9 du census 4a + `getFacturesAcompte`, ajout Claude sur constat first-hand : son `demande.sejour` = {id,titre,dates,createur{prenom,nom}}, zéro client*) ; **3 prêts** via include racine (`getAllSejoursSignataire`, `getSejourDetail`, `getDossierPedagogique` — types seuls) ; #7 signataire = 2 endpoints (écran prêt / PDF à compléter).
- **Types** : aucun `client*` déclaré dans aucune interface frontend ; type `Devis` (`devis.ts`) = levier n°1 (8 lecteurs). ⚠️ `SejourDirecteur.createur` typé sans `memberships` alors que lu à `signataire/page.tsx:189-190` (cast à sécuriser à l'extension).

---

## 5. Lot 3 — Ouverture de l'édition hébergeur en COLLAB

1. **Frontend `SejourHeader.tsx`** : ✅ vérifié — le bloc client est gardé `isDirect`, et `clientOrganisation` n'est éditable NULLE PART (aucun mode). Lever la garde + ajouter le champ établissement (+ adresse/CP/ville/email/tél déjà dans le formulaire DIRECT).
2. **Backend `updateInfosSejour`** : ✅ vérifié — le DTO n'accepte PAS `clientOrganisation` (accepte clientNom/Prenom/Email/Telephone/Adresse/CodePostal/Ville + titre/dates/effectif). L'ajouter au DTO + au service.
3. **Propagation CRM** : ✅ déjà câblée — la synchro Client de `updateInfosSejour` recalcule `nom = clientOrganisation || nomParticulier`. Rien à coder, à recetter.
4. **Effet de bord connu** : `updateInfosSejour` envoie un email « infos mises à jour » à l'enseignant listant titre/dates — une édition purement client n'y figure pas (backlog déjà noté 19/08, non bloquant).

**Recette Lot 3 (cas réels)** :
- Cas Nogent : « le devis doit être au nom du Collège XXX, pas de la mairie » → Anne le fait seule, ça se répercute devis/facture/budget/dashboards/PDF.
- Cas NDL `861f22d0` : Anne avait voulu modifier le client (comportement bloqué constaté) → débloqué.
- Besoin d'origine d'Anne : corriger email/tél de contact d'un séjour confirmé → autonome.

---

## 6. Pièges & invariants (à recopier dans chaque prompt CC)

1. **Include Prisma resserrable = tests verts / prod cassée** (dette connue 21/08 (2)) : les tests figent la logique de choix, PAS le chargement des champs. Tout ajout de select est ADDITIF ; tout resserrement interdit. Rehearsal local avant déploiement des lots 2 et 3.
2. **`DevisCard.resolveEtablissement`** : inverser la priorité SANS perdre le fallback DIRECT (`sejourDirect?.clientOrganisation` doit rester atteignable).
3. **Tests `resoudreEtablissement` (7 cas)** : fallbacks DISTINCTS DIRECT 3-niveaux / COLLAB 2-niveaux épinglés — ne pas harmoniser, ne pas toucher.
4. **Branche hybride `accepter()` = HORS périmètre** (dette signature A/B/C, ROADMAP 19/08 (3)/(4) + 24/08 (2)). On ne touche pas ce fichier dans ce chantier.
5. **F1 effectif = HORS périmètre** (chantier séparé, décision Solution A à rechallenger).
6. **Aucune migration Prisma.** `prisma/migrations` inchangé sur tout le chantier (contrôle en recette).
7. Règles d'or du plan §2 : 2 phases CC, prompts back/front séparés, gates, diff relu par Claude sur fichiers réels, CC ne pousse jamais, jamais d'amend.

---

## 7. Recette globale

- [ ] Lot 1 déployé : AUCUN changement visible (spot-check 3 dossiers COLLAB + 2 DIRECT).
- [ ] Lot 2 : les 7 dossiers attendus changent (2 graphies + 5 remplis), AUCUN autre dossier ne bouge, PDF devis COLLAB porte `sejour.clientOrganisation`.
- [ ] Lot 2 : surfaces sombres #6 (offres), #7-PDF (signataire), #9 (modifier) passent de VIDE à REMPLI sur tous les dossiers COLLAB (attendu, pas une régression) ; E-a/E-b : la recherche matche désormais `sejour.clientOrganisation`.
- [ ] `findOpen` : contrôle négatif — AUCUN champ `client*` dans sa réponse, masquage contact par plan intact.
- [ ] Lot 3 : scénarios §5 ; email/tél/établissement édités par l'hébergeur visibles partout ; CRM Client suit ; documents backend (convention/facture) inchangés dans leur logique.
- [ ] `tsc --noEmit` 0 / build / tests verts à chaque commit ; `prisma/migrations` inchangé.

---

## 8. Hors périmètre — backlogs consignés

- **Route morte profil organisateur** (découverte 24/08, backlog SÉPARÉ — décision Théo) : `PATCH /users/mon-etablissement` appelé par le front n'existe pas au backend (404 sur « Sauvegarder ») ; DTO orphelin `backend/src/users/dto/update-etablissement.dto.ts` ; `getProfile` renvoie `organisation:{...}` alors que le front attend des champs plats `etablissement*` → affichage établissement mort. À trancher plus tard : réparer (recréer la route) ou supprimer la section établissement du profil (cohérent avec E2 : le compte n'est pas propriétaire de l'identité).
- **E-c/E-d `hebergeur/demandes` (findOpen)** : exclusion VOLONTAIRE de la bascule (décision Théo 24/08, cf. §4bis) — lecture memberships conservée, aucun champ client* ajouté au payload, à réévaluer seulement si la sémantique des demandes ouvertes change.
- **Dette signature collab** (options A/B/C non tranchées) — même branche `accepter()`, chantier distinct.
- **F1 dualité effectif** ; **#3 émetteur facture** ; nettoyage des `include memberships` post-Lot 2.

---

## 9. Décisions finales

1. ✅ **Option A validée** (Théo, 24/08) : util frontend `resolveClientEtablissement()` + ajouts additifs dans les selects backend.
2. ✅ **Doc validé dans son ensemble** (Théo, 24/08). Prochaine étape : prompt CC Lot 1, Phase 1 census lecture seule.
