# LIAVO — État session dev
> Dernière mise à jour : 01/06/2026 — TAM Phase 1 + qualifications encadrants

## COMMITS NON POUSSÉS
- **63f48e6** : refactor(statut): suppression APPROVED et REJECTED
- (+ le commit docs de nettoyage StatutSejour, une fois créé)

> Note : les commits de la session précédente (jusqu'à `cda574d` inclus) sont **déjà poussés** sur origin/main.

## PROCHAINS CHANTIERS (ordre)
1. Push commits de la session — Théo valide et pousse
2. DECLARE_TAM backend implémentation (~2h)
3. SC9 badges devis cohérents (~0.5j)
4. HORS_SCOLAIRE dans formulaire demande publique (~0.5j)
5. Invitations parents 2 tuteurs (~1j)
6. DevisLibre DROP tables + retirer model Prisma (~0.5j)

## RÉFÉRENCE SQL — NOMS DE TABLES POSTGRESQL
> Lire cette section en premier avant toute requête SQL sur Scalingo.

| Modèle Prisma             | Table PostgreSQL réelle         |
|---------------------------|---------------------------------|
| User                      | utilisateurs                    |
| Organisation              | organisations                   |
| Membership                | memberships                     |
| CentreHebergement         | centres_hebergement             |
| InvitationHebergement     | invitations_hebergement         |
| ProduitCatalogue          | produits_catalogue              |
| Disponibilite             | disponibilites                  |
| Document                  | documents                       |
| Devis                     | devis                           |
| LigneDevis                | lignes_devis                    |
| DemandeDevis              | demandes_devis                  |
| Sejour                    | sejours                         |
| Message                   | messages                        |
| PlanningActivite          | planning_activites              |
| GroupeSejour              | groupes_sejour                  |
| EleveGroupe               | eleves_groupes                  |
| DocumentSejour            | documents_sejour                |
| AutorisationParentale     | autorisations_parentales        |
| AccompagnateurMission     | accompagnateurs_missions        |
| Client                    | clients                         |
| ContactClient             | contacts_clients                |
| Rappel                    | rappels                         |
| SejourClient              | sejours_clients                 |
| LigneBudgetComplementaire | lignes_budget_complementaires   |
| RecetteBudget             | recettes_budget                 |
| DevisLibre                | devis_libres                    |
| LigneDevisLibre           | lignes_devis_libre              |
| VersementDevisLibre       | versements_devis_libre          |
| ActiviteClient            | activites_client                |
| InvitationCollaboration   | invitations_collaboration       |
| RelationCommerciale       | relations_commerciales          |
| SejourRelation            | sejours_relations               |
| InvitationDirecteur       | invitations_directeur           |
| SejourVisiteHebergeur     | sejour_visites_hebergeur        |

### StatutDevis
EN_ATTENTE | EN_ATTENTE_VALIDATION | SELECTIONNE | SIGNE_DIRECTION | NON_RETENU | FACTURE_ACOMPTE | FACTURE_SOLDE

### StatutDevisLibre (string)
BROUILLON | ENVOYE | ACCEPTE | REFUSE | PAYE

### StatutSejour
DRAFT | OPTION | SUBMITTED | CONVENTION | SOUMIS_RECTORAT | SIGNE_DIRECTION | DECLARE_TAM
(APPROVED/REJECTED supprimés le 01/06/2026 — reliques rôle AUTORITE)

### TypeActivite
APPEL | EMAIL | VISITE | DEVIS | SIGNATURE | VERSEMENT | NOTE | BROCHURE

---

## RÈGLE ABSOLUE — PROCESS CC
**Prompts longs : découper en parties numérotées.**
**git add/commit/push passent par CC. PowerShell uniquement pour les requêtes SQL Scalingo.**
**Lire les fichiers source avant toute proposition. Ne jamais écrire de prompt sans avoir lu.**

---

## STACK TECHNIQUE

| Composant | Technologie | URL |
|---|---|---|
| Frontend | Next.js 15 / React 19 / TypeScript / Tailwind 4 | liavo.fr (Scalingo Paris) |
| Backend | NestJS 11 / Prisma / PostgreSQL 17 | api.liavo.fr (Scalingo Paris) |
| Stockage | OVH Object Storage Gravelines | s3.gra.io.cloud.ovh.net |
| Emails | Brevo | contact@liavo.fr (fromName configurable) |

**Repo :** theorocheloison-hash/sejour-jeunesse
**Local :** C:\Users\Roche-Loison\Desktop\sejour-jeunesse (copie UNIQUE)
**Scalingo CLI :** C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe
**Railway + Cloudflare R2 : RÉSILIÉS**

---

## COMPTES DE RÉFÉRENCE

| Email | Rôle | MDP |
|---|---|---|
| contact@liavo.fr | ADMIN | Admin2026! |
| resa@lesauvageon.com | HEBERGEUR (Sauvageon) | Test1234! |
| demo-lmdj@liavo.fr | RESEAU (LMDJ) | LMDJ2026! |

Centre Sauvageon ID : 3a710674-d580-4ffd-9d9a-f739bae82154
INTERDIT : contact@chalet-sauvageon.fr = INEXISTANT

---

## CHANTIER CONFORMITÉ FACTURATION — Lot 1 ✅ TERMINÉ 30/05/2026

> Entité **Facture immuable** (snapshot figé à l'émission). Le Devis ne mute plus (statut/typeDocument inchangés, reste modifiable). Briques Lot 0 (compteur séquentiel, `emetteurId`) réutilisées.

### Modèle de données (migration DDL `20260530140000_lot1_facture`)
- **`Facture`** (table `factures`) : snapshot émetteur + destinataire + montants figés, `typeFacture ('ACOMPTE'|'SOLDE')`, `montantFacture`, `montantVerseTotal`, `acompteVerse`, `dateVersement`, `factureAcompteId` (self-relation), `@@unique([emetteurId, numero])`, index `[devisId]`/`[sejourId]`.
- **`LigneFacture`** (table `lignes_facture`) : lignes figées, FK `factureId` ON DELETE CASCADE.
- **`VersementPaiement.factureId`** (FK nullable) : nouveaux versements rattachés à la Facture. `montantVerseTotal` toujours resynchronisé sur le Devis (somme de tous les versements) car le front le lit.
- **`Devis.factures[]`** relation.

### Backend — module `facture/` (scission depuis `devis`)
- `SequenceService` extrait dans `sequence/` (`generer(emetteurId, typeDoc)` atomique, retry P2002), partagé Devis + Facture.
- `FactureService` : `emettreAcompte` (unifié collab + direct), `emettreFactureSolde` (total révisé − acompte déjà facturé, refusé si acompte non validé), `ajouterVersement`/`supprimerVersement` (par factureId), `validerAcompte`, `getChorusXml` (lit Facture), `getFacturesForDevis`.
- Routes `FactureController` : `POST /factures/acompte|solde`, `POST /factures/:id/versements`, `PATCH /factures/:id/versements/:vid/supprimer`, `PATCH /factures/:id/valider-acompte`, `GET /factures/:id/chorus-xml`, `GET /factures/devis/:devisId`.
- `DevisService` nettoyé (1859 → 1448 lignes) : SUPPRIMÉS `facturerAcompte/facturerSolde/validerAcompte/ajouterVersement/supprimerVersement/getChorusXml/escapeXml/genererNumero`. `getMesDevis`/`getDevisById` incluent `factures` ; `getFacturesAcompte` lit la table Facture ; `updateDevis` déverrouillé (SIGNE_DIRECTION + devis directs, `demandeId` nullable-safe). Anciennes routes `PATCH /devis/:id/facturer-*` supprimées (pas d'alias).
- Statuts `FACTURE_ACOMPTE/SOLDE` gardés dans l'enum (deprecated) mais **jamais mutés**.

### Frontend — bascule sur les factures liées
- `lib/devis.ts` : types `Facture`/`LigneFacture`, helpers `getFactureAcompte/getFactureSolde/etatFacturation`, `emettreFactureAcompte/Solde`, `getFacturesForDevis`, `ajouterVersement/supprimerVersement` (signature factureId), `validerAcompte`/`getChorusXml` → `/factures/:id/...`.
- `planning-statut.ts` (B1) + `deriveClientStatus` (CRM) dérivent l'état depuis `factures[].typeFacture` (repli legacy `typeDocument`).
- `TabDevisFacturation.tsx` : pipeline lit `devis.factures[]` (sinon `getFacturesForDevis`), machine à états `etatFacturation`, versements ciblés par factureId, `montantAttendu = facture.montantFacture`, rechargement après chaque action.
- `hebergeur/devis/page.tsx` : badges / boutons acompte-solde-Chorus / modale « Suivi paiement » migrés sur Facture (state `{ facture }`).
- `signataire/page.tsx` : factures typées `Facture` (devis imbriqué), validation acompte + Chorus Pro par factureId.

### Vérifs
- Grep `facturerAcompte|facturerSolde|getVersements|/devis/.../versements` dans `frontend` = **0**.
- Builds : backend `npm run build` **0 erreur**, frontend `tsc --noEmit` **0 erreur**.

### À savoir / reste à faire
- `getFacturesAcompte` (signataire) ne renvoie que `acompteVerse: false` → la section « Acomptes validés » du dashboard signataire reste vide (comportement backend Lot 1).
- **Lots 2-4** restants : PDF mentions légales (PDF/A-3), avoirs, Factur-X CII + dépôt Chorus Pro via PISTE.

---

## CHANTIER CONFORMITÉ FACTURATION — Lot 0 ✅ TERMINÉ 30/05/2026

> Cadrage complet (décisions D1-D3, calendrier légal, lots 1-4, bugs actifs) dans LIAVO_STATUS.md.
> Quick-fix à la source, briques réutilisées par l'entité Facture (Lot 1). On reste sur le modèle Devis actuel.

### Décisions actées Lot 0 (implémentées — ne pas re-débattre)
- **Émetteur légal** résolu à la facturation : `emetteurId = centre.organisationId ?? centre.id`.
- **Table `SequenceNumero`** : `emetteurId (Uuid)`, `annee (Int)`, `typeDoc ('DEVIS'|'FACTURE')`,
  `dernierNumero (Int @default 0)`, `@@unique([emetteurId, annee, typeDoc])`.
- **Une seule séquence FACTURE** par émetteur/année (acompte ET solde → `typeDoc=FACTURE`, numérotation continue) ;
  séquence DEVIS séparée. Formats `DEV-/FA-/FS-{annee}-{NNNN}` (padStart 4).
- **`Devis.emetteurId`** stocké à la facturation + index unique partiel `[emetteurId, numeroFacture] WHERE numero_facture IS NOT NULL`.
- **`Devis.montantSolde (Float?)`** ajouté ; `facturerSolde` écrit `montantSolde` et **ne corrompt plus `montantAcompte`** (= acompte réel).
- **Numéros non overridables** : `dto.numeroDevis ??` retiré, plus aucun `id.substring` pour un numéro.

### Implémentation (commits `feat(facturation): Lot 0` + doc)
- `genererNumero(emetteurId, typeDoc)` : upsert atomique en `$transaction` + retry P2002 ; `generateNumeroDevis` (COUNT) supprimée.
- `facturerAcompte`/`facturerSolde`/`create`/`createDirectDevis` migrés vers le compteur ; `emetteurId` stocké.
- `getNextNumeroDevis` = aperçu **lecture seule** (ne consomme pas le compteur ; le numéro réel est attribué à la création, peut différer si concurrence).
- Lecteurs `montantAcompte` corrigés selon `typeDocument` (FACTURE_SOLDE → `montantSolde`, sinon `montantAcompte`) :
  `getChorusXml` (PayableAmount), `ajouter/supprimerVersement`, types + mappers PDF frontend (`DevisPDF` attendait déjà `montantSolde`).
  Dashboard global (`centre.service.ts`) & select `sejour.service.ts` = safe (acompte lu uniquement sur devis pré-facturation).
- Migration `20260530120000_lot0_facturation` = **DDL seul** (pas de `prisma migrate dev` ; Scalingo applique via `migrate deploy`).
- **Backfill : non nécessaire** — diagnostic prod 30/05 = 0 FACTURE_SOLDE (1 FACTURE_ACOMPTE), zéro montantAcompte corrompu.
- **Builds** : backend `npm run build` 0 erreur, frontend `tsc --noEmit` 0 erreur.

### À savoir / reste à faire
- DTO `create-devis.dto.ts` garde `numeroDevis` mais il est **ignoré** côté serveur (retrait = 400 tant que le front l'envoie).
- `DevisLibre` quasi-mort (aucun controller/service ; lu seul par 1 KPI legacy dans `centre.service.ts`) — non touché.
- **Lots 1-4** restants : entité `Facture` immuable, PDF mentions légales, avoirs, Factur-X CII/PDF-A3 + dépôt Chorus Pro via PISTE.

---

## CHANTIER GLOBAL — Refonte page séjour + facturation + planning couleurs — ✅ TERMINÉ 29/05/2026

**Doc de référence** : `docs/ARCHITECTURE_UX_SEJOUR_FINAL.md` (validé 28/05/2026)

### Sous-chantiers — Tous livrés

| # | Sous-chantier | Statut | Commit |
|---|---|---|---|
| 1 | Fix @Roles supprimerVersement + Google Calendar centre.nom dynamique | ✅ | Session 28/05 |
| 2 | Migration notesInternes + sejourId Rappel/ActiviteClient + fix brochure | ✅ | Session 28/05 |
| 3 | Extraction TabDevisFacturation.tsx (476 lignes extraites) | ✅ | c57195e |
| 4 | Pipeline facturation UI (versements, acompte, solde) | ✅ | 13d1e7f |
| 5 | TabNotes.tsx (notes internes + activités + rappels par séjour) + 5 endpoints backend | ✅ | Session 29/05 |
| 6 | SejourHeader.tsx (header extrait + Planifier visite Google Calendar) | ✅ | Session 29/05 |
| 7 | Planning couleurs par statut (5 couleurs + hachures + légende) | ✅ | Session 29/05 |
| 8 | Pipeline CRM dérivé (kanban 6 colonnes auto + fix devis DIRECT manquants) | ✅ | Session 29/05 |
| 9 | Séjours liés CRM enrichis (titre/dates/badge + boutons création) | ✅ | Session 29/05 |
| 10 | Page liste séjours /dashboard/hebergeur/sejours + sidebar + badge non-lu | ✅ | Session 29/05 |

### Impact technique net

**Fichiers créés :**
- `frontend/app/dashboard/sejour/[id]/_components/TabDevisFacturation.tsx` (~817 lignes)
- `frontend/app/dashboard/sejour/[id]/_components/TabNotes.tsx`
- `frontend/app/dashboard/sejour/[id]/_components/SejourHeader.tsx`
- `frontend/app/dashboard/hebergeur/sejours/page.tsx` (nouvelle page)
- `frontend/src/lib/planning-statut.ts` (lib partagée couleurs planning)

**Fichiers modifiés (principaux) :**
- `frontend/app/dashboard/sejour/[id]/page.tsx` : ~5000 → ~3200 lignes (3 composants extraits)
- `frontend/app/dashboard/hebergeur/planning/page.tsx` : palette 8→5 couleurs, import lib partagée
- `frontend/app/dashboard/hebergeur/clients/page.tsx` : pipeline CRM dérivé, séjours liés enrichis
- `frontend/src/lib/clients.ts` : deriveClientStatus(), STATUT_DERIVE_LABELS, rattacherSejour()
- `frontend/src/lib/collaboration.ts` : SejourCollabInfo.notesInternes, SejourPlanning.devisDirect/demandes, 5 API helpers notes/activités/rappels
- `frontend/app/dashboard/hebergeur/_components/HebergeurSidebar.tsx` : item Séjours + badge déplacé
- `backend/src/collaboration/collaboration.service.ts` : 5 endpoints notes/activités/rappels + getMesSejoursPlanning enrichi + resolveClientIdForSejour
- `backend/src/collaboration/collaboration.controller.ts` : 5 routes HEBERGEUR-only
- `backend/src/clients/clients.service.ts` : getMesClients enrichi (détails séjour + tous statuts devis + devis DIRECT)

**Backend — Nouveaux endpoints (sous-chantier #5) :**
- `PATCH /collaboration/sejour/:id/notes-internes`
- `GET /collaboration/sejour/:id/activites`
- `POST /collaboration/sejour/:id/activites`
- `GET /collaboration/sejour/:id/rappels`
- `POST /collaboration/sejour/:id/rappels`

**Backend — Endpoints modifiés :**
- `GET /collaboration/mes-sejours-planning` : inclut devisDirect[0].statut + demandes[0].devis[0].statut
- `GET /clients` (getMesClients) : inclut détails séjour via query séparée, tous statuts devis, devis DIRECT via sejourDirectId

**Aucune migration base additionnelle** post sous-chantier #2.

### Décisions clés prises pendant l'exécution

| Sujet | Décision |
|---|---|
| Extraction page.tsx | Option A (pure JSX extraction) pour TabDevisFacturation — states devis-only internalisés, budgetData passé en props |
| Modale invitation direction | Internalisée dans TabDevisFacturation (states exclusifs au devis collab) |
| DevisPDFInline | Déplacé dans TabDevisFacturation |
| SejourClient sans relation Prisma | Query séparée pour enrichir avec détails séjour (pas de migration) |
| Devis DIRECT manquants dans CRM | Fix critique : 2ème query Prisma via sejourDirectId en parallèle de la query COLLAB |
| Kanban CRM "En cours" | 6 colonnes (pas 5) — "En cours" ajouté pour les séjours OPTION sans devis |
| Lien "Fiche CRM" dans header séjour | Reporté au #9 (SejourCollabInfo n'expose pas clientId) |
| Contrat PDF dans header séjour | Reporté (contratUrl sur le devis, pas accessible depuis le header après extraction) |
| PLANNING_COULEURS duplication | Extrait dans lib partagée planning-statut.ts au #10 |
| retourHref hébergeur | Changé de /planning vers /sejours |

### Bugs corrigés en cascade

- `supprimerVersement` @Roles : ajout HEBERGEUR (#1)
- Google Calendar "Sauvageon" hardcodé → centre.nom dynamique (#1)
- Brochure centre.nom hardcodée → dynamique (#2)
- Planning palette 8 couleurs instable → 5 statuts fixes (#7)
- getMesClients : devis DIRECT totalement absents → ajout query sejourDirectId (#8)
- getMesClients : devis filtrés SELECTIONNE/SIGNE_DIRECTION seulement → tous statuts pertinents (#8)
- Section "Séjours liés" CRM : UUID tronqué → titre + dates + badge (#9)
- Badge non-lu sur Planning (destination inutile) → déplacé sur Séjours (page dédiée) (#10)

### À tester en prod (compte Sauvageon)

1. Page `/dashboard/hebergeur/sejours` : liste séjours, filtres, badges non-lus
2. Clic sur un séjour → page séjour avec header extrait, onglets
3. Onglet Devis & Facturation : pipeline facturation (boutons acompte/solde, versements)
4. Onglet Notes & suivi : textarea auto-save, timeline activités, rappels
5. Planning : couleurs par statut (Option orange hachures, Confirmé bleu, etc.)
6. CRM : kanban auto-dérivé (Prospect → En cours → Devis envoyé → Confirmé → Acompte versé → Soldé)
7. CRM fiche client : séjours liés avec titre/dates/badge, boutons [+ Nouveau séjour/événement]
8. CRM → clic séjour lié → page séjour (lien croisé)
9. Sidebar : item "Séjours" avec badge non-lu, Planning sans badge

---

## CHANTIER COHÉRENCE PLANNING — ✅ TERMINÉ 29/05/2026 — en test prod

**Objectif** : couleur planning = devis le plus AVANCÉ (pas le plus récent) ; palette
partagée mono-centre + global.

**Décisions** : D1 = option A stricte (le flux "demandes en attente sur le mono" est
reporté — cf. note PRIORITÉ #1). D2 = palette 5+1 (Option/Confirmé/Acompte/Soldé/
Indispo + Demande-en-attente séparé). D3 = aucune couleur dédiée rectorat/TAM (statuts
organisateur) → tombent en Confirmé bleu.

**Fichiers** :
- planning-statut.ts : RANG_FACTURATION + statutDevisLePlusAvance() + derivePlanningStatut
  réécrit (collecte tous les statuts devis, prend le plus avancé) + COULEUR_DEMANDE_ATTENTE
  exporté SÉPARÉMENT de PLANNING_COULEURS (sinon fuite dans la légende mono).
- collaboration.service.ts (getMesSejoursPlanning) : tous les devis (retrait take:1) +
  filtre where centreId in centreIds sur les devis de demandes.
- centre.service.ts (getDashboardGlobal) : sejoursPlanning enrichi de devisDirect +
  demandes.devis (filtrés centre).
- global/page.tsx : palette partagée + légende 5 états, STATUT_CONFIRME supprimé.

**Consommateurs derivePlanningStatut** (tous via endpoints enrichis, vérifiés) :
planning/page.tsx, sejours/page.tsx (liste + filtre statut), global/page.tsx.

**À tester prod (Sauvageon)** : smoke-test chemin argent option→devis→acompte→solde ;
vérifier couleurs sur les 3 surfaces + cohérence avec le kanban CRM en parallèle.

**À garder en tête** : la granularité acompte (vert) / soldé (gris) sur le global
8 semaines est ajustable (vit dans PLANNING_COULEURS) — à valider à l'œil sur données
multi-centre réelles, ramener à Option/Confirmé/Demande-attente si trop chargé.

---

## FLUX DIRECTION — LIVRÉ PARTIELLEMENT (21/05/2026)

### Backend livré ✅ — commit 28c372a
- Migration `20260521_flux_direction_signature` : 5 colonnes ajoutées (4 sur invitations_directeur, 1 sur devis)
- `POST /invitations-directeur` (ORGANISATEUR) — crée invitation + envoie email avec 2 CTA
- `POST /invitations-directeur/:token/signer-sans-compte` (PUBLIC) — signature sans compte, anti-double, hash SHA256, notif hébergeur
- `POST /devis/:id/upload-signature` (ORGANISATEUR) — upload scan PDF signé, passe SIGNE_DIRECTION
- `facturerAcompte()` enrichi : email auto à organisateur + signataire (via InvitationDirecteur.emailDirecteur)
- `validerAcompte` : @Roles élargi à SIGNATAIRE + HEBERGEUR (c'est l'hébergeur qui valide réception paiement)
- Schema Prisma synchronisé : `signatureDocumentUrl` sur Devis, `nomSignataire/fonctionSignataire/signeAt/signatureIp` sur InvitationDirecteur

### Frontend EN COURS ❌
- Page publique `/invitation-direction/[token]` — à créer (PDF inline + formulaire signature + lien register)
- Bouton "Envoyer à la direction" dans onglet Devis `sejour/[id]/page.tsx` — à ajouter
- Bouton "Joindre document signé" (upload scan) — à ajouter
- Badge signature direction dans onglet Devis — à ajouter
- `findByToken()` à enrichir pour retourner données complètes du devis (lignes, montants, centre, organisateur) pour le PDF inline

### Terminologie UI
JAMAIS "directeur" dans l'interface. Utiliser "direction" (neutre) ou "signataire".

### Architecture signature — 3 chemins, même résultat
1. **Upload scan** : organisateur imprime → fait signer → scanne → uploade via `POST /devis/:id/upload-signature`
2. **Signature par lien** : signataire reçoit email → page publique `/invitation-direction/[token]` → voit PDF inline → signe en 1 clic
3. **Dashboard signataire** : signataire a un compte → `/dashboard/signataire` → signe depuis SejourCard

### Facturation post-signature
- Signature NON BLOQUANTE pour facturer (option A retenue).
- C'est l'HÉBERGEUR qui valide la réception du paiement.

---

## PROSPECTS / CONTACTS ACTIFS

### Yves Massard — 3 centres (Les Gets + Bellevaux)
- **Source** : LinkedIn inbound (message 27/05/2026)
- **Centres** : 3 centres de vacances aux Gets et à Bellevaux (Pôle Montagne, SIREN 440246106)
- **Statut** : RDV téléphonique à caler semaine du 02/06/2026
- **Enjeu** : premier prospect multi-centre

### Quentin Dervaux — UFCV, 120 lits, tout compris
- **Source** : LinkedIn inbound (message 27/05/2026)
- **Organisation** : UFCV — association nationale, centres partout en France
- **Statut** : visio à caler après le 15/06/2026 (avec sa coordinatrice)
- **Enjeu** : pied dans le réseau UFCV national

---

## SÉJOURS EN COURS

### Christophe Migevant — Lycée Julien Witmer Charolles
- Séjour : `440e9fd1-2a85-40fb-acd0-ffbaea35d46c`
- Devis : `ecf4635b-cdb3-47ec-8afb-4c171967b59a` — DEV-2026-003 — SELECTIONNE

### Jessy Renaudet — Collège de Loué
- Séjour ski hiver 2027, invitation envoyée

### François Croquette — Collège Lucien Herr Altkirch
- 3 séjours hiver 2026-2027, Séjour 1 et 2 acceptés ✅

---

## ROADMAP — PRIORITÉS

### Court terme — PRIORITÉ HAUTE
- [ ] **Planning hébergeur — options/devis en attente** : PRIORITÉ #1 pour démo Yves Massard

  > NOTE (chantier cohérence planning 29/05) : le flux "demandes/devis en attente"
  > existe DÉJÀ sur le dashboard GLOBAL multi-centre (planning.options, rendu hachures
  > ambre "Demande en attente"). Il N'existe PAS sur le planning MONO-centre
  > (getMesSejoursPlanning ne renvoie que les séjours OPTION/CONVENTION/SIGNE_DIRECTION,
  > pas les demandes ouvertes). La PRIORITÉ #1 "options/devis en attente sur le planning
  > hébergeur" = porter ce flux sur le mono-centre. Implique : enrichir
  > getMesSejoursPlanning (ou un endpoint dédié) pour retourner les demandes OUVERTES
  > sans devis du centre, + ajouter une 2e couche de blocs provisoires dans
  > planning/page.tsx. Chantier séparé, non inclus dans la cohérence couleur.
  > État partagé "DEMANDE_ATTENTE" déjà défini dans planning-statut.ts → réutilisable.

- [ ] **Import Excel participants**
- [ ] **Widget embeddable "Demander un devis"**
- [ ] **Invitations parents** → 2 parents/tuteurs par enfant
- [ ] **Opportunités CRM / liste d'attente**
- [ ] **Email prospection personnalisable depuis le CRM**

### Scalabilité
- [ ] **Onboarding multi-centre complet** — page /centres/nouveau + claim + validation admin
- [ ] **Facturation multi-centre** — pricing par centre à définir
- [ ] **Accès multi-utilisateurs hébergeur** (V2 — post multi-centre)

### Intégrations
- [ ] **APIDAE LMDJ** : attente credentials Anaïtis Mangeon
- [ ] **Chorus Pro** : vérifier si getChorusXml() est stub ou fonctionnel

### Conformité facturation (chantier dédié)
- [x] Lot 0 ✅ — Compteur séquentiel atomique + fix montantAcompte (30/05/2026)
- [x] Lot 1 ✅ — Entité Facture immuable + scission module facture/ (30/05/2026)
- [x] Lot 2 ✅ — Génération PDF côté serveur (NestJS/react-pdf) + stockage OVH + URL permanente Facture.pdfUrl (31/05/2026)
  - FacturePDF.tsx backend, generateFacturePdf(), mapFactureToPdfProps()
  - fire-and-forget non bloquant, route GET /factures/:id/pdf + POST /factures/:id/regenerer-pdf
  - Validé en prod : FA-2026-0001 généré et accessible sur OVH
  - Point ouvert : SIRET Sauvageon = 9 chiffres (SIREN) → vérifier champ siret centre en prod
- [x] Lot 3 ✅ — Annulation par avoir (01/06/2026)
- [x] Lot 4A ✅ — Factur-X EN 16931 (01/06/2026)
- [ ] Lot 4B — Chorus Pro PISTE (habilitation AIFE requise)

### Signataire / Membership
- [x] SC4ter ✅ TERMINÉ 01/06/2026 — getAllSejoursSignataire() via Membership (organisationId transmis dans InvitationDirecteur, creer() + envoyerADirection())
- [ ] InvitationCollaboration.organisationCibleId (reste de SC4ter)

### HORS_SCOLAIRE / TAM
- [x] TAM Phase 1 ✅ TERMINÉ 01/06/2026 — champ qualification encadrant + PDF de préparation TAM (bouton conditionnel HORS_SCOLAIRE)
- [ ] TAM Phase 2 (suspendu, validation commerciale) — convention DJEPVA + intégration automatique (6-12 mois, conditionné au volume hébergeurs)

### Dette technique
- [ ] DevisLibre : DROP tables (devis_libres, lignes_devis_libre, versements_devis_libre) + retirer model Prisma — migration données faite le 28/05, tables vides en prod, code ne les utilise plus. DDL + schema à nettoyer (~0.5j, risque nul)
- [ ] JWT_SECRET=dev-secret-2024 en production → changer (**SOLDÉ 29/05/2026**)
- [ ] Refactoring DevisBuilder (3 fichiers dupliqués)
- [ ] Labels universels scolaire/colos (cohérence UX)
- [ ] Flux direction frontend (page publique + boutons dans TabDevisFacturation)
- [ ] Contrat PDF accessible depuis SejourHeader (quand clientId CRM disponible)
- [ ] Lien "Fiche CRM" dans SejourHeader (quand SejourCollabInfo expose clientId)

---

## LEÇONS RETENUES

- DTOs NestJS : décorateurs class-validator OBLIGATOIRES si whitelist:true global
- Routes NestJS : statiques AVANT paramétriques
- Prompts CC longs : découper en parties numérotées
- StorageService.upload(file, folder) — génère le nom de fichier automatiquement
- Floating point : toujours round2() avant affichage/PDF montants
- Email fromName : 4e arg optionnel sur sendGenericNotification()
- str_replace non fiable Windows → utiliser write_file
- EmailModule @Global() → injectable partout sans import dans le module consommateur
- Prisma Json? → utiliser ?? undefined (pas ?? null)
- useSearchParams Next.js → nécessite Suspense boundary
- fire-and-forget : try/catch non-bloquant, jamais dans le chemin critique
- brochureUrl : colonne sur CentreHebergement, pas var env
- PowerShell : && non supporté → deux commandes séparées
- layout.tsx hébergeur : guard /login + sidebar ici, pas dans chaque page
- useHebergeurCounts : hook partagé pour sidebar — ne retourne que counts + centre
- Constructeur de devis : DUPLIQUÉ 3x — refactoring DevisBuilder à faire
- Variable locale qui shadowe un state React = bug silencieux
- InvitationDirecteur : pas de @relation Prisma sur devisId → requête séparée obligatoire
- Flux direction : signature non bloquante (option A), 3 chemins vers SIGNE_DIRECTION
- Page publique signature : utiliser fetch() pas axios (pas de JWT)
- Terminologie UI : "direction" jamais "directeur" — sauf modèle Prisma interne
- nombreEleves : sejour.placesTotales = source de vérité unique
- select Prisma User : motDePasse UNIQUEMENT dans login/reinitialiserMotDePasse
- Saisie devis : toujours TTC en entrée, HT calculé
- Tables PostgreSQL : TOUJOURS snake_case. Vérifier avec la table de correspondance.
- Ne JAMAIS supprimer du code sans vérifier couverture fonctionnelle
- Badge sidebar sans destination = UX cassée
- Couleurs planning : convention PMS = couleur par statut, pas par identité séjour
- Pipeline CRM généraliste inadapté → statut dérivé du devis
- SejourClient n'a pas de relation Prisma `sejour` → query séparée pour enrichir
- Devis DIRECT passent par sejourDirectId, pas par demande.sejourId → query COLLAB seule = données manquantes. Fix : OR [demande.sejourId, sejourDirectId] dans getActivitesCatalogue + genererPlanningIA
- MethodePaiement enum : valeurs en MAJUSCULES (CARTE/VIREMENT/CHEQUE/ESPECES/CHEQUES_VACANCES) — le changement de casse nécessite rename/recreate en PostgreSQL (pas d'ALTER TYPE ADD VALUE dans une transaction)
- PDF facture snapshot immuable → versements absents à l'émission, visibles après régénération (POST /factures/:id/regenerer-pdf)
- Route NestJS en doublon apparent : vérifier l'emplacement dans le controller avant d'ajouter
- Extraction ciblée > refactoring big bang sur un fichier 5000 lignes sans tests
- States exclusifs à un composant extrait → internaliser, pas passer en props
- budgetData partagé entre onglets → passer en props, pas re-fetcher
- Debounce textarea : clearTimeout dans cleanup useEffect + au démontage
- deriveClientStatus : mémoïser 1x par client pour éviter N×M recalculs dans le kanban
- Avoir = typeFacture 'AVOIR' sur entité Facture (VarChar, pas d'ALTER TYPE enum)
- montantFacture négatif sur l'avoir (−dto.montant) ; acompteNet = acompte + avoir.montantFacture dans emettreFactureSolde
- Relation 1-1 auto-référencée Prisma : @unique obligatoire côté FK + UNIQUE INDEX partiel en base (WHERE NOT NULL)
- PDF avoir : emetteurIban: null (pas de coordonnées bancaires sur un avoir)
- Lignes avoir pré-remplies depuis FA (quantites/totaux négatifs) ; frontend valide sum(lignes) ≈ montant ±0.02 €
- getChorusXml() : guard typeFacture AVOIR → ForbiddenException + TODO Lot 4 (code UBL 381, pas 380/386)
- annulerDevis() : route POST /devis/:id/annuler HEBERGEUR uniquement — ne pas ouvrir PATCH /:id/statut à HEBERGEUR (logique collab incompatible)
- pdf-lib embedding Factur-X : useObjectStreams:false obligatoire (AF/Filespec inspectables par validateurs)
- catalog.lookup(key, PDFDict) lève si absent → utiliser lookupMaybe
- CII D22B : InvoiceReferencedDocument (avoir) va dans ApplicableHeaderTradeSettlement, pas ExchangedDocument
- Adresse CII structurée : sérialiser "adresse||CP||ville" dans emetteurAdresse (snapshot Facture) ; parseAdresse() split || ; formatAdressePdf() pour le PDF
- TypeCode CII : 380 = solde, 386 = acompte, 381 = avoir (≠ UBL : 380/386/381 identiques mais syntaxe différente)
- Validation Factur-X : invoiceverify.eu fonctionne (GDPR-compliant, drag & drop, ZUGFeRD v2 EN16931)
- Limites PDF/A-3b non bloquantes pour usage réel : ICC sRGB OutputIntent absent + Helvetica non embarquée → veraPDF partiel, Mustang/Chorus Pro non impactés
- getAllSejoursSignataire() : deux sources (Membership collegues + InvitationDirecteur par email) — les deux doivent être alimentées pour que la vue signataire soit complète
- InvitationDirecteur.organisationId : résoudre depuis Membership.isPrimary du créateur séjour (COLLAB) ou clientOrganisationId du séjourDirect (DIRECT)
- registerSignataire() crée le Membership automatiquement si organisationId fourni dans le DTO — ne pas modifier
- getDossierPedagogique() : pas de select restrictif sur le séjour principal → les champs ACM (ageMin/Max, moinsde6ans, typeAccueilACM, projetEducatif) arrivent via { ...sejour } sans changement backend
- TAM : pas d'API publique → PDF de préparation Phase 1, convention DJEPVA Phase 2. Les deux phases sont documentées en roadmap.
- PDF conditionnel HORS_SCOLAIRE : utiliser d.typeContexte (state dossier) pas sejour?.typeContexte (variable non exposée dans page.tsx séjour)
- Supprimer une valeur d'enum PostgreSQL : impossible via DROP VALUE → rename enum → create nouveau → migrate colonne (avec DROP/SET DEFAULT si colonne a @default) → drop ancien. Toujours vérifier les lignes existantes en base avant (SELECT statut, COUNT(*) GROUP BY statut).
- OPTION manquait dans le type StatutSejour frontend (incohérence pré-existante). Toujours vérifier la cohérence front/back sur les enums lors d'un nettoyage.
