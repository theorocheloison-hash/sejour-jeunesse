# LIAVO — État session dev
> Dernière mise à jour : 21/05/2026 — Session flux direction (signature + facturation)

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

### StatutDevis
EN_ATTENTE | EN_ATTENTE_VALIDATION | SELECTIONNE | SIGNE_DIRECTION | NON_RETENU | FACTURE_ACOMPTE | FACTURE_SOLDE

### StatutDevisLibre (string)
BROUILLON | ENVOYE | ACCEPTE | REFUSE | PAYE

### StatutSejour
DRAFT | SUBMITTED | APPROVED | REJECTED | CONVENTION | SOUMIS_RECTORAT | SIGNE_DIRECTION | DECLARE_TAM

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
Modèle Prisma `InvitationDirecteur` reste inchangé (nom de table OK, c'est la BDD pas l'UI).

### Architecture signature — 3 chemins, même résultat
1. **Upload scan** : organisateur imprime → fait signer → scanne → uploade via `POST /devis/:id/upload-signature`
2. **Signature par lien** : signataire reçoit email → page publique `/invitation-direction/[token]` → voit PDF inline → signe en 1 clic
3. **Dashboard signataire** : signataire a un compte → `/dashboard/signataire` → signe depuis SejourCard
Les 3 aboutissent à : devis `SIGNE_DIRECTION`, séjour `SIGNE_DIRECTION`, email hébergeur.

### Facturation post-signature
- Signature NON BLOQUANTE pour facturer (option A retenue). L'hébergeur peut facturer dès SELECTIONNE.
- `facturerAcompte()` envoie email auto à organisateur + signataire (si invitation existe).
- C'est l'HÉBERGEUR qui valide la réception du paiement (pas le signataire).
- Le signataire n'a pas besoin de compte pour recevoir la facture → email automatique.

### Schema InvitationDirecteur — pas de relation Prisma `devis`
`devisId String?` sans `@relation` → `findByToken()` doit faire une requête Prisma séparée pour charger le devis.

### User frontend (AuthContext)
`user.firstName`, `user.lastName`, `user.role`, `user.organisation?.id`, `user.organisation?.nom`, `user.organisation?.uai`

---

## DÉBRIEF CLIENT — François Croquette / Collège Lucien Herr Altkirch (19/05/2026)

### Contexte démo
Onboarding en direct. Hébergeur : Le Chalet Le Sauvageon (Morillon, 74).
3 séjours créés hiver 2026-2027. Flux invitation → création compte → espace collaboratif présenté en live.

### Ce qui a fonctionné ✅
- Flux invitation et création de compte : sans accroc
- Espace collaboratif : pertinent, il commence à organiser ses séjours dessus
- Séjour 1 et Séjour 2 acceptés et visibles dans son dashboard ✅

### Blocage — Mon Bureau Numérique (MBN)
Communications parents EN doivent passer par MBN. LIAVO ne peut pas envoyer directement.
Voie alternative : enseignant copie le lien LIAVO dans MBN.
Action : contacter cellule juridique rectorat. François voit avec sa gestionnaire.

### Feedback — Granularité droits accompagnateurs par onglet
François veut choisir quel(s) onglet(s) sont visibles par chaque accompagnateur.
Spéc : `ongletVisibles: string[]` sur `accompagnateurs_missions`. Rétrocompatible (vide = tout visible).

---

## ARCHITECTURE CRM — DETTE

### Fix à implémenter
Dans `invitation-collaboration.service.ts` méthode `accepter()` :
1. Chercher client par `client.email === invitation.emailEnseignant` ou UAI
2. Si trouvé : créer `SejourClient` + mettre à jour `client.organisationId`

### Backfill existants
Script SQL : UPDATE clients SET organisation_id = (SELECT o.id FROM organisations o
JOIN memberships m ON m.organisation_id = o.id JOIN utilisateurs u ON u.id = m.user_id
WHERE u.email = clients.email LIMIT 1) WHERE organisation_id IS NULL

---

## MODULES LIVRÉS EN PROD

### DevisLibre (13/05/2026) ✅
### Invitation Collaboration — devis pré-rempli (14/05/2026) ✅
### CRM Activité (14/05/2026) ✅
### Brochure hébergeur (18/05/2026) ✅
### Notifications espace collaboratif (18/05/2026) ✅
### Accompagnateurs avec accès collaboratif (18/05/2026) ✅
### Logo cliquable + Sidebar hébergeur universelle (18/05/2026) ✅
### Notifications manuelles devis + planning (19/05/2026) ✅
### Modification infos séjour par hébergeur (19/05/2026) ✅
### Devis — améliorations nombreEleves (19/05/2026) ✅
### Audit qualité codebase (20/05/2026) ✅
### Flux direction — backend (21/05/2026) ✅ — commit 28c372a

---

## SÉJOURS EN COURS

### Christophe Migevant — Lycée Julien Witmer Charolles
- Séjour : `440e9fd1-2a85-40fb-acd0-ffbaea35d46c`
- Devis : `ecf4635b-cdb3-47ec-8afb-4c171967b59a` — DEV-2026-003 — SELECTIONNE
- Email : Christophe.Migevant@ac-dijon.fr

### Jessy Renaudet — Collège de Loué
- Séjour ski hiver 2027, invitation envoyée à renaudet.jessy@sfr.fr

### François Croquette — Collège Lucien Herr Altkirch
- Email : francois.croquette@orange.fr
- 3 séjours hiver 2026-2027, Séjour 1 et 2 acceptés ✅

---

## ROADMAP — PRIORITÉS

### LIVRÉ SESSION 21/05/2026 ✅
- [x] **Flux direction — backend** (commit 28c372a)
- [x] **Flux direction — frontend** (commit 6b0ed53) — page publique + bouton envoi + upload scan + badge
- [x] **Droits accompagnateurs** (commit ba3a5fe) — set fixe : planning/participants/groupes/journal
- [x] **Planning hébergeur amélioré** (commit 0be730c)

### LIVRÉ SESSION 26/05/2026 ✅
- [x] **Formulaire invitation universalisé** — labels neutres + StructureSearch SIRENE (remplace API EN)

### CRITIQUE — en cours
- [ ] **Liaison Client ↔ User à l'acceptation invitation** (spéc dans section CRM)

### Features devis
- [ ] **Refactoring DevisBuilder** (3 fichiers dupliqués — faire AVANT drag&drop)
- [ ] **Drag & drop lignes** (dnd-kit installé)
- [ ] **Titres de section**
- [ ] **Auto-signature organisateur** (cas colo où l'organisateur est aussi signataire)

### Court terme
- [ ] **Invitations parents** → 2 parents/tuteurs par enfant
- [ ] **Bouton "Nouveau séjour pour client existant"** depuis fiche CRM

### Scalabilité
- [ ] **Freemium hébergeur** + Stripe + Trial
- [ ] **SC7 notifications APIDAE** (suspendu)

### Intégrations
- [ ] **APIDAE LMDJ** : attente credentials Anaïtis Mangeon
- [ ] **Chorus Pro** : vérifier si getChorusXml() est stub ou fonctionnel

### V2 — Service PDF centralisé backend
- [ ] **Génération PDF côté Node** (pdfkit ou @react-pdf/renderer)
- [ ] Couvre : devis, factures acompte/solde, budget, projet pédagogique
- [ ] Use case principal : PJ email Brevo (facture→signataire/organisateur, devis signé→hébergeur)
- [ ] Permettrait export PDF côté API sans frontend
- [ ] Prérequis : refactoring DevisBuilder (extraire data structures en lib partagée)
- [ ] Estimation : 3-5j — ne pas coder avant volume suffisant de séjours

### Cohérence universelle scolaire / colos / hors-scolaire
> ⚠️ CHANTIER UX GLOBAL — Théo doit valider la logique avant chaque implémentation.
> Pattern de référence : EtapeInfos.tsx (prop estHorsScolaireUser) + appel-offres/page.tsx (sélecteur type structure étape 1).
> Objectif : toute la plateforme doit fonctionner aussi bien pour un collège, une colo asso, un CSE, ou un enseignant du supérieur.

**Livrés :**
- [x] Formulaire invitation hébergeur : labels universels + StructureSearch SIRENE (26/05/2026)
- [x] Appel d'offres / contact direct : sélecteur type structure + labels adaptatifs (existant)

**À faire — Frontend (labels / UX) — VALIDATION THÉO REQUISE :**
- [ ] **Emails backend invitation** : "Nombre d'élèves estimé" → "Nombre de participants" / "L'enseignant que vous avez invité" → "L'organisateur" — revoir le wording de TOUS les templates emails invitation-collaboration.service.ts
- [ ] **Email notification hébergeur acceptation** : mêmes corrections
- [ ] **URL /inviter-enseignant** → décider si on renomme en /inviter-organisateur (= nouvelle route, redirects, liens CRM) ou si on garde l'URL actuelle
- [ ] **Formulaire inscription organisateur** (register/organisateur/page.tsx) : ajouter type ENSEIGNEMENT_SUPERIEUR dans TypeStructure ? Ou suffisant avec "Autre" + StructureSearch ?
- [ ] **Page /rejoindre/[token]** : vérifier que les labels sont neutres quand l'invitation vient d'une structure non-scolaire
- [ ] **Espace collaboratif sejour/[id]** : label "Nombre d'élèves" dans les infos séjour → "Nombre de participants" conditionnel
- [ ] **Devis PDF** : vérifier que le nom de structure apparaît bien (pas un champ vide quand pas d'UAI)

**À faire — Backend (naming interne) — DETTE, PAS PRIORITAIRE :**
- [ ] Renommer champs Prisma : emailEnseignant → emailOrganisateur, nbElevesEstime → nbParticipantsEstime (migration + DTO + tous les endpoints) — **à faire seulement lors d'un chantier dédié, pas en parallèle d'autre chose**

**À faire — Cohérence colos spécifique (avant visio LMDJ) :**
- [ ] Suppression rectorat frontend + PDF dossier déclaration
- [ ] Audit libellés scolaires → génériques dans toute la nav et les dashboards

**Décisions à prendre par Théo :**
1. Est-ce qu'on ajoute un sélecteur type de structure dans le formulaire d'invitation hébergeur (comme appel d'offres étape 1) ? Si oui, on peut adapter les labels dynamiquement. Si non, labels neutres universels = solution actuelle.
2. Est-ce que ENSEIGNEMENT_SUPERIEUR doit être un type de structure à part entière dans le schema Prisma, ou "Autre" suffit ?
3. Pour les colos ACM : est-ce que l'hébergeur doit pouvoir renseigner tranche d'âge / type ACM dans l'invitation, ou c'est l'organisateur qui complète à l'inscription ?

### À investiguer — non technique
- [ ] **MBN / rectorat** : contacter cellule juridique
- [ ] **Gestionnaire François** : attendre retour validation inscriptions parents

### Dette technique secondaire
- [ ] DashboardShell organisateur/signataire
- [ ] Migration selects Prisma etablissement* → Organisation
- [ ] tokenAcces journal public : ajouter expiration ou nonce (risque fuite lien)
- [ ] APIDAE_IDDJ_API_KEY ?? '' : throw au démarrage si vide (admin.service.ts)
- [ ] OG tag "649 centres référencés" à supprimer (Option A validée, pas appliquée)
- [ ] JWT_SECRET=dev-secret-2024 en production → changer avant déploiement majeur

---

## LEÇONS RETENUES

- DTOs NestJS : décorateurs class-validator OBLIGATOIRES si whitelist:true global
- Routes NestJS : statiques AVANT paramétriques
- Prompts CC longs : découper en parties numérotées
- StorageService.upload(file, folder) — génère le nom de fichier automatiquement
- DevisLibre.statut : String → BROUILLON/ENVOYE/ACCEPTE/REFUSE/PAYE
- Floating point : toujours round2() avant affichage/PDF montants
- Email fromName : 4e arg optionnel sur sendGenericNotification()
- str_replace non fiable Windows → utiliser write_file
- Railway/Cloudflare R2 : RÉSILIÉS
- EmailModule @Global() → injectable partout sans import dans le module consommateur
- Prisma Json? → utiliser ?? undefined (pas ?? null)
- useSearchParams Next.js → nécessite Suspense boundary
- fire-and-forget : try/catch non-bloquant, jamais dans le chemin critique
- brochureUrl : colonne sur CentreHebergement, pas var env
- PowerShell : && non supporté → deux commandes séparées
- accompagnateurTokenPending : liaison automatique à verifyEmail (Option C)
- layout.tsx hébergeur : guard /login + sidebar ici, pas dans chaque page
- useHebergeurCounts : hook partagé pour sidebar — ne retourne que counts + centre, pas les listes complètes
- Constructeur de devis : DUPLIQUÉ 3x — refactoring DevisBuilder à faire
- Variable locale qui shadowe un state React = bug silencieux difficile à détecter
- Client.organisationId existe mais jamais rempli automatiquement — dette CRM
- Invitation acceptée ne relie pas le User au Client CRM existant — à corriger
- InvitationDirecteur : pas de @relation Prisma sur devisId → requête séparée obligatoire dans findByToken()
- Flux direction : signature non bloquante (option A), 3 chemins vers SIGNE_DIRECTION
- Facturation : hébergeur valide réception paiement (pas signataire), email auto à organisateur+signataire
- Page publique signature : utiliser fetch() pas axios (pas de JWT)
- Terminologie UI : "direction" jamais "directeur" — sauf modèle Prisma interne
- nombreEleves : sejour.placesTotales = source de vérité unique, synchronisé par updateDevis
- Audit qualité : toujours tracer la chaîne complète données→base→API→frontend avant de patcher
- select Prisma User : motDePasse UNIQUEMENT dans login/reinitialiserMotDePasse — jamais dans les retours client
- Catch silencieux sur mutations : toujours setErreur + rechargement données pour resynchroniser l'UI
- buildAuthResponse : ne jamais passer User complet — utiliser un type structurel minimal
- BREVO_SENDER_EMAIL=contact@liavo.fr ✅ FRONTEND_URL=https://liavo.fr ✅ (vérifiés 20/05/2026)
