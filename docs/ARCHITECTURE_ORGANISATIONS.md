# LIAVO — Architecture Organisations & Refactor Phase 1

> **Document de référence** pour le refactor structurel du modèle de données LIAVO.
> Rédigé le 29 avril 2026, après audit complet du code backend/frontend.
> Mis à jour le 29 avril 2026 (v3) : Phase 0 Scalingo, rôles français, TypeStructure élargi, widget+notification centres non inscrits.
> Mis à jour le 29 avril 2026 (v3.1) : Phase 0 Scalingo **TERMINÉE** — backend+BDD+frontend+stockage migrés en France.
> Statut : **VALIDÉ — prêt pour lancement sous-chantier 1 (schéma Prisma + rôles français + backfill)**.

---

## Table des matières

0. [Phase 0 — Migration Railway → Scalingo (souveraineté données France)](#0-phase-0--migration-railway--scalingo)
1. [Pourquoi ce refactor](#1-pourquoi-ce-refactor)
2. [Modèle de données cible](#2-modèle-de-données-cible)
3. [Mapping ancien → nouveau (incluant renommage des rôles)](#3-mapping-ancien--nouveau)
4. [Les sources d'Organisation et mécanismes de notification](#4-les-sources-dorganisation-et-mécanismes-de-notification)
5. [Le mécanisme de claim hébergeur (Kbis + validation manuelle)](#5-le-mécanisme-de-claim-hébergeur)
6. [Découpage en sous-chantiers](#6-découpage-en-sous-chantiers)
7. [Catalogue des risques cascade](#7-catalogue-des-risques-cascade)
8. [Checklist de validation pré-déploiement](#8-checklist-de-validation-pré-déploiement)
9. [Phase 2 (futur conditionnel)](#9-phase-2-futur-conditionnel)
10. [Roadmap consolidée](#10-roadmap-consolidée)
11. [Glossaire](#11-glossaire)

---

## 0. Phase 0 — Migration Railway → Scalingo

### 0.1 Pourquoi c'est urgent et non négociable

Railway (San Francisco, USA) est soumis au Cloud Act et au FISA 702. Même avec des données en région EU West, l'entité juridique américaine peut être contrainte de fournir les données au gouvernement US sans notification. Pour une plateforme qui gère des données d'élèves mineurs, des fiches sanitaires avec allergies et traitements médicaux, des autorisations parentales : c'est un bloqueur commercial face aux rectorats et aux réseaux comme LMDJ. C'est d'ailleurs la première objection reçue en démo.

### 0.2 Cible : Scalingo

Scalingo est un PaaS français (Strasbourg), certifié ISO 27001 et HDS (données de santé), datacenters à Paris, conforme RGPD. Même DX que Railway : push git → déploiement auto. PostgreSQL managé, sauvegardes automatiques, SSL auto, Review Apps.

Coût estimé : ~30-50€/mois (1 app Node.js + 1 PostgreSQL). Surcoût négligeable face à l'argument commercial "données hébergées en France, certifié ISO 27001".

### 0.3 Plan de migration

1. Créer un compte Scalingo + app staging + PostgreSQL managé
2. Adapter les variables d'environnement (DATABASE_URL, BREVO_API_KEY, R2 credentials — Cloudflare R2 reste acceptable : stockage fichier, pas de données personnelles, POPs en France)
3. `pg_dump` Railway → `pg_restore` Scalingo
4. Tester l'app en staging 48h minimum
5. Basculer le DNS liavo.fr → Scalingo
6. Éteindre Railway

**Estimé : 1-2 jours.**

**À faire AVANT le refactor Organisations** pour ne pas migrer deux fois. Les données seront en France dès le déploiement du nouveau modèle.

**Point à vérifier :** compatibilité Scalingo avec le SSR Next.js 15 (buildpacks Node.js). Alternative si problème : garder le frontend sur Vercel (pas de données personnelles côté frontend, rendu statique + SSR sans persistance) et ne migrer que le backend + BDD sur Scalingo.

### 0.4 Ce qui reste chez Cloudflare

- **R2 (stockage fichiers)** : reste chez Cloudflare. Les fichiers stockés (Kbis, documents séjour, photos journal) ne sont pas des données structurées personnelles. Cloudflare a des POPs en France et le stockage R2 peut être configuré en région EU. Acceptable pour le RGPD.
- **DNS** : liavo.fr reste chez OVH (registrar) avec Cloudflare comme CDN/proxy si nécessaire.

---

## 1. Pourquoi ce refactor

### 1.1 Le problème actuel

Aujourd'hui dans le code LIAVO :

- **La structure de rattachement est stockée à plat sur le User** : 6 champs `etablissementUai/Nom/Adresse/Ville/Email/Telephone`.
- **Le modèle `Client` (CRM hébergeur) duplique** sans pont vers User. Un même collège peut exister 3 fois.
- **L'identifiant national (SIREN) est absent** sur le User.
- **Le claim de centres pré-référencés ne fonctionne que pour APIDAE** avec matching email strict.
- **Pas de vraie validation de propriété** lors d'un claim.
- **Les rôles sont en anglais** (TEACHER, VENUE, DIRECTOR, RECTOR) et ne couvrent pas les cas d'usage colos/jeunesse.

### 1.2 Le coût de l'inaction

Si LMDJ déploie chez ses 100+ centres sans ce refactor : doublons massifs, Chorus Pro non scalable, cauchemar de support, CRM non interopérable, perte de crédibilité.

### 1.3 La cible

Modèle de données aligné sur Salesforce/HubSpot (Account ↔ Contact), la réalité légale française (SIREN), le pattern Workspace + Memberships (Slack, Notion), et le pattern Customer of Customer (Stripe Connect).

---

## 2. Modèle de données cible

### 2.1 Renommage des rôles utilisateur (full rename)

LIAVO est un outil français, développé par et pour le marché français. Les rôles sont renommés en français pour refléter la réalité des usages (scolaire + colos/jeunesse) :

| Ancien (anglais) | Nouveau (français) | Justification |
|---|---|---|
| `TEACHER` | `ORGANISATEUR` | Couvre enseignant, directeur ALSH, responsable asso, coordinateur périscolaire, élu municipal |
| `DIRECTOR` | `SIGNATAIRE` | Couvre directeur d'école, président asso, maire, DGS — la personne qui signe le dossier |
| `VENUE` | `HEBERGEUR` | Exploitant de centre d'hébergement |
| `RECTOR` | `AUTORITE` | Autorité administrative de tutelle : DSDEN (scolaire) ou SDJES (jeunesse/colos) |
| `RESEAU` | `RESEAU` | Inchangé — gestionnaire réseau (LMDJ, IDDJ) |
| `PARENT` | `PARENT` | Inchangé — parent/tuteur légal |
| `ADMIN` | `ADMIN` | Inchangé — administrateur LIAVO |

**Principe clé : le rôle détermine les permissions et le dashboard, pas les spécificités d'usage.** Un ORGANISATEUR voit le même dashboard qu'il soit enseignant ou directeur de centre de loisirs. Les spécificités (UAI pour le scolaire, déclaration TAM pour les colos) sont déterminées par le `typeStructure` de l'Organisation, pas par le rôle du User. Le branchement conditionnel se fait dans l'UI :

```
if (organisation.typeStructure in [COLLEGE_LYCEE, ECOLE_PRIMAIRE]) {
  // Flow scolaire : UAI, soumission directeur, soumission rectorat
} else {
  // Flow colo/jeunesse : signataire libre, déclaration TAM, pas de rectorat
}
```

### 2.2 TypeStructure élargi

L'enum couvre désormais toutes les natures juridiques/administratives, côté organisateur ET côté hébergeur. TypeStructure classifie la nature juridique de l'Organisation, pas son rôle sur LIAVO.

```prisma
enum TypeStructure {
  COLLEGE_LYCEE               // Établissement scolaire secondaire (a un UAI)
  ECOLE_PRIMAIRE              // Établissement scolaire primaire (a un UAI)
  MAIRIE                      // Commune (peut organiser ET exploiter)
  COLLECTIVITE_TERRITORIALE   // CC, conseil départemental, région
  ASSOCIATION                 // Loi 1901 (peut organiser ET exploiter)
  CENTRE_LOISIRS              // ALSH, centre aéré
  COMITE_ENTREPRISE           // CSE / comité d'entreprise
  ENTREPRISE                  // SAS, SARL, EURL, SCI, SA (principalement hébergeurs)
  MICRO_ENTREPRISE            // Auto-entrepreneur, EI (gîte indépendant)
  AUTRE                       // Fourre-tout
}
```

Exemples concrets : Sauvageon (SAS) → `ENTREPRISE`. Auberge de jeunesse FUAJ → `ASSOCIATION`. Gîte communal de Morillon → rattaché à Organisation `MAIRIE`. Une Mairie double-casquette (hébergeur + organisateur colos) → `MAIRIE`, avec 2 Users rattachés via Memberships distinctes (un ORGANISATEUR + un HEBERGEUR).

### 2.3 Schéma Prisma cible (Phase 1)

```prisma
// ============================================================
// ENUM : rôle utilisateur (renommé en français)
// ============================================================
enum Role {
  ORGANISATEUR    // Ex-TEACHER
  SIGNATAIRE      // Ex-DIRECTOR
  HEBERGEUR       // Ex-VENUE
  AUTORITE        // Ex-RECTOR
  RESEAU          // Inchangé
  PARENT          // Inchangé
  ADMIN           // Inchangé
}

// ============================================================
// ENUM : type de structure (élargi pour couvrir hébergeurs)
// ============================================================
enum TypeStructure {
  COLLEGE_LYCEE
  ECOLE_PRIMAIRE
  MAIRIE
  COLLECTIVITE_TERRITORIALE
  ASSOCIATION
  CENTRE_LOISIRS
  COMITE_ENTREPRISE
  ENTREPRISE
  MICRO_ENTREPRISE
  AUTRE
}

// ============================================================
// ENUM : source d'une Organisation
// ============================================================
enum SourceOrganisation {
  MANUAL
  APIDAE
  API_EDUCATION_NATIONALE
  API_SIRENE
  IMPORT_CSV
  IMPORT_API_EN
  RESEAU_IMPORT
}

// ============================================================
// ENUM : rôle d'un membre dans une Organisation
// ============================================================
enum RoleMembership {
  PROPRIETAIRE    // Premier à avoir créé/claim l'orga
  ADMINISTRATEUR  // Peut inviter d'autres membres, modifier les infos
  MEMBRE          // Membre standard
}

// ============================================================
// ENUM : statut de validation d'un claim
// ============================================================
enum ClaimStatut {
  NON_APPLICABLE
  EN_ATTENTE_DOCUMENT
  EN_ATTENTE_VALIDATION
  VALIDE
  REFUSE
}

// ============================================================
// ENUM : statut d'une relation commerciale
// ============================================================
enum StatutRelation {
  PROSPECT
  CONTACTE
  INTERESSE
  EN_NEGOCIATION
  CLIENT
  INACTIF
}

// ============================================================
// MODEL : Organisation (entité de premier ordre)
// ============================================================
model Organisation {
  id            String              @id @default(uuid()) @db.Uuid
  siren         String?             @unique @db.VarChar(9)
  siret         String?             @db.VarChar(14)
  rna           String?             @db.VarChar(10)
  uai           String?             @db.VarChar(20)
  nom           String              @db.VarChar(255)
  raisonSociale String?             @map("raison_sociale") @db.VarChar(255)
  adresse       String?             @db.VarChar(500)
  codePostal    String?             @map("code_postal") @db.VarChar(10)
  ville         String?             @db.VarChar(255)
  departement   String?             @db.VarChar(10)
  emailContact     String?  @map("email_contact") @db.VarChar(255)
  telephoneContact String?  @map("telephone_contact") @db.VarChar(20)
  siteWeb          String?  @map("site_web") @db.VarChar(500)
  typeStructure  TypeStructure?    @map("type_structure")
  academie       String?           @db.VarChar(100)
  source         SourceOrganisation @default(MANUAL)
  sourceId       String?            @map("source_id") @db.VarChar(100)
  createdAt      DateTime           @default(now()) @map("created_at")
  updatedAt      DateTime           @updatedAt @map("updated_at")

  memberships          Membership[]
  centresHebergement   CentreHebergement[]
  sejoursOrganises     Sejour[]                 @relation("SejourOrgaCreatrice")
  relationsCommerciales RelationCommerciale[]   @relation("OrganisationCliente")
  relationsHebergeur    RelationCommerciale[]   @relation("OrganisationHebergeur")
  invitationsRecues     InvitationCollaboration[]
  invitationsEnvoyees   InvitationCentreExterne[]
  demandesDevis         DemandeDevis[]

  @@index([siren])
  @@index([siret])
  @@index([uai])
  @@index([rna])
  @@index([nom])
  @@map("organisations")
}

// ============================================================
// MODEL : Membership (humain ↔ organisation)
// ============================================================
model Membership {
  id              String          @id @default(uuid()) @db.Uuid
  userId          String          @map("user_id") @db.Uuid
  organisationId  String          @map("organisation_id") @db.Uuid
  role            RoleMembership  @default(MEMBRE)
  isPrimary       Boolean         @default(false) @map("is_primary")
  claimStatut         ClaimStatut @default(NON_APPLICABLE) @map("claim_statut")
  claimDocumentUrl    String?     @map("claim_document_url") @db.VarChar(500)
  claimSiretExtrait   String?     @map("claim_siret_extrait") @db.VarChar(14)
  claimValidatedById  String?     @map("claim_validated_by_id") @db.Uuid
  claimValidatedAt    DateTime?   @map("claim_validated_at")
  claimRefuseRaison   String?     @map("claim_refuse_raison") @db.Text
  claimSubmittedAt    DateTime?   @map("claim_submitted_at")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  organisation    Organisation   @relation(fields: [organisationId], references: [id], onDelete: Cascade)
  validateur      User?          @relation("MembershipValidateur", fields: [claimValidatedById], references: [id])

  @@unique([userId, organisationId])
  @@index([userId])
  @@index([organisationId])
  @@index([claimStatut])
  @@map("memberships")
}

// ============================================================
// MODEL : RelationCommerciale (CRM — remplace Client)
// ============================================================
model RelationCommerciale {
  id                       String          @id @default(uuid()) @db.Uuid
  organisationHebergeurId  String          @map("organisation_hebergeur_id") @db.Uuid
  organisationClienteId    String          @map("organisation_cliente_id") @db.Uuid
  statut                   StatutRelation  @default(PROSPECT)
  notes                    String?         @db.Text
  source                   String          @default("MANUEL") @db.VarChar(20)
  createdAt                DateTime        @default(now()) @map("created_at")
  updatedAt                DateTime        @updatedAt @map("updated_at")

  organisationHebergeur Organisation @relation("OrganisationHebergeur", fields: [organisationHebergeurId], references: [id], onDelete: Cascade)
  organisationCliente   Organisation @relation("OrganisationCliente", fields: [organisationClienteId], references: [id], onDelete: Cascade)
  rappels               Rappel[]
  sejours               SejourRelation[]

  @@unique([organisationHebergeurId, organisationClienteId])
  @@index([organisationHebergeurId])
  @@index([organisationClienteId])
  @@map("relations_commerciales")
}

// ============================================================
// MODEL : SejourRelation (remplace SejourClient)
// ============================================================
model SejourRelation {
  id                    String   @id @default(uuid()) @db.Uuid
  relationId            String   @map("relation_id") @db.Uuid
  sejourId              String   @map("sejour_id") @db.Uuid
  createdAt             DateTime @default(now()) @map("created_at")

  relation              RelationCommerciale @relation(fields: [relationId], references: [id], onDelete: Cascade)
  sejour                Sejour              @relation(fields: [sejourId], references: [id], onDelete: Cascade)

  @@unique([relationId, sejourId])
  @@map("sejours_relations")
}

// ============================================================
// MODÈLES MODIFIÉS (champs migrés)
// ============================================================
// User : suppression des champs etablissement* (sous-chantier 8)
// CentreHebergement : ajout organisationId (FK nullable)
// InvitationCollaboration : ajout organisationCibleId (FK nullable)
// DemandeDevis : ajout organisationCreatriceId (FK nullable)
// Sejour : ajout organisationCreatriceId (FK nullable)
```

### 2.4 Diagramme relationnel

```
                        ┌──────────────────┐
                        │      User        │
                        │ - role (français) │
                        └────────┬─────────┘
                                 │ 1..N
                        ┌────────▼─────────┐
                        │   Membership     │
                        │ - roleMembership │
                        │ - isPrimary      │
                        │ - claimStatut    │
                        └────────┬─────────┘
                                 │ N..1
                        ┌────────▼─────────┐
                        │   Organisation   │
                        │ - siren (unique) │
                        │ - typeStructure  │
                        │ - source         │
                        └────────┬─────────┘
                                 │
                ┌────────────────┼────────────────────┐
                │                │                    │
        ┌───────▼────────┐ ┌─────▼──────────┐ ┌──────▼──────────┐
        │ CentreHéberge- │ │ Sejour         │ │ RelationCom-    │
        │ ment           │ │ (orgaCréatrice)│ │ merciale (CRM)  │
        └────────────────┘ └────────────────┘ └─────────────────┘
```

### 2.5 Concept "Membership primary"

Un User peut appartenir à plusieurs Organisations. `Membership.isPrimary` désigne l'Organisation "active". Helper centralisé `getOrganisationPrincipale(userId)`. Phase 2 : switcher UI type Slack.

### 2.6 TypeStructure vs Role — principe de séparation

- **Role** (sur User) → détermine les permissions et le dashboard visible (ORGANISATEUR, HEBERGEUR, SIGNATAIRE, etc.)
- **TypeStructure** (sur Organisation) → classifie la nature juridique/administrative, détermine les branchements UX conditionnels (UAI vs libre, rectorat vs TAM, directeur vs signataire libre)
- **Modèle économique** → déterminé par la présence de CentreHebergement + planAbonnement, pas par TypeStructure ni Role. Seul l'hébergeur paie.

Exemple concret Mairie de Morillon double-casquette :
- Organisation : `TypeStructure=MAIRIE`, SIREN unique
- Sophie (directrice ALSH, organise des colos) → User `role=ORGANISATEUR`, Membership vers cette Organisation
- Marc (responsable gîte municipal, accueille des groupes) → User `role=HEBERGEUR`, Membership vers cette même Organisation
- Dashboard de Sophie : flow organisateur avec branchement "non-scolaire" (pas d'UAI, signataire libre)
- Dashboard de Marc : flow hébergeur avec devis, planning, CRM. Marc paie l'abonnement LIAVO.

---

## 3. Mapping ancien → nouveau

### 3.1 Renommage des rôles (migration SQL)

```sql
-- Renommage de l'enum Role (dans la migration Prisma)
ALTER TYPE "Role" RENAME VALUE 'TEACHER' TO 'ORGANISATEUR';
ALTER TYPE "Role" RENAME VALUE 'DIRECTOR' TO 'SIGNATAIRE';
ALTER TYPE "Role" RENAME VALUE 'VENUE' TO 'HEBERGEUR';
ALTER TYPE "Role" RENAME VALUE 'RECTOR' TO 'AUTORITE';
-- RESEAU, PARENT, ADMIN restent inchangés
```

**Impact sur le code backend (grep exhaustif requis) :**
- `auth.service.ts` : registerTeacher → registerOrganisateur, registerDirector → registerSignataire, registerVenue → registerHebergeur
- Tous les `if (role === 'TEACHER')` → `if (role === 'ORGANISATEUR')`
- Tous les `if (role === 'VENUE')` → `if (role === 'HEBERGEUR')`
- Tous les `if (role === 'DIRECTOR')` → `if (role === 'SIGNATAIRE')`
- Tous les `if (role === 'RECTOR')` → `if (role === 'AUTORITE')`
- Guards NestJS (`@Roles('VENUE')` → `@Roles('HEBERGEUR')`)
- DTOs (RegisterTeacherDto → RegisterOrganisateurDto, etc.)

**Impact sur le code frontend :**
- Toutes les conditions de rendu conditionnel (`role === 'TEACHER'`, etc.)
- Routes frontend `/register/teacher` → `/register/organisateur` (avec redirect 301 depuis l'ancienne URL)
- Routes dashboard `/dashboard/teacher` → `/dashboard/organisateur` (idem redirects)
- Libellés UI déjà en français (juste les valeurs enum qui changent)

**Impact sur la BDD :**
- Toutes les lignes de la table `utilisateurs` sont automatiquement migrées par le `ALTER TYPE RENAME VALUE`
- Aucun backfill nécessaire pour les rôles (c'est un renommage in-place)

### 3.2 Renommage RoleMembership

Les rôles de Membership sont aussi en français : OWNER→PROPRIETAIRE, ADMIN→ADMINISTRATEUR, MEMBER→MEMBRE.

### 3.3 Champs du User → Organisation

| Champ User actuel | Devient | Migration |
|---|---|---|
| `etablissementUai` | `Organisation.uai` | Backfill par User |
| `etablissementNom` | `Organisation.nom` | Backfill par User |
| `etablissementAdresse` | `Organisation.adresse` | Backfill par User |
| `etablissementVille` | `Organisation.ville` | Backfill par User |
| `etablissementEmail` | `Organisation.emailContact` | Backfill par User |
| `etablissementTelephone` | `Organisation.telephoneContact` | Backfill par User |
| `typeStructure` | `Organisation.typeStructure` | Backfill (+ ajout ENTREPRISE/MICRO_ENTREPRISE pour les valeurs existantes d'hébergeurs) |
| `reseauNom`, `reseauNomComplet` | Inchangé sur User | Pas de migration |
| `emailRectorat` | Inchangé sur User | Pas de migration |

### 3.4 Modèle Client → RelationCommerciale + Organisation

Même logique que précédemment : déduplication par UAI, création Organisation + RelationCommerciale.

### 3.5 InvitationCollaboration, Sejour, DemandeDevis

Inchangé par rapport aux versions précédentes du doc.

---

## 4. Les sources d'Organisation et mécanismes de notification

### 4.1 Source MANUAL — Inscription standard

Membership avec `role=PROPRIETAIRE`, `claimStatut=NON_APPLICABLE`, `isPrimary=true`. Aucun Kbis.

### 4.2 Source API_SIRENE — Autocomplete

Membership avec `role=PROPRIETAIRE`, `claimStatut=NON_APPLICABLE`. Pas de Kbis. Pré-remplissage automatique SIREN.

### 4.3 Source APIDAE — Import réseau

Centres orphelins rattachés à une Organisation orpheline. Claim HEBERGEUR avec Kbis si revendication.

### 4.4 Source API_EDUCATION_NATIONALE — Catalogue EN + notification

Quand un organisateur cherche un centre via `searchPublic()` et sélectionne un résultat API EN non inscrit sur LIAVO :

- Création à la volée de l'Organisation (source=API_EDUCATION_NATIONALE) + CentreHebergement orphelin
- Si User HEBERGEUR clique "C'est mon centre" → flux de claim avec Kbis
- Si User ORGANISATEUR se rattache à son école → pas de Kbis

**Double mécanisme de notification des centres non inscrits :**

**Mécanisme 1 — Widget signalement d'intérêt (existant, via InvitationCentreExterne)**
L'organisateur voit un widget "Ce centre n'est pas encore inscrit sur LIAVO — Signalez votre intérêt — le réseau le contactera". L'organisateur clique → création d'un enregistrement `InvitationCentreExterne` → email envoyé à l'hébergeur (si email connu) ou au réseau (LMDJ/IDDJ) pour relance manuelle. Contexte riche : l'email contient les infos du séjour envisagé + lien vers la page de claim.

**Mécanisme 2 — Notification automatique APIDAE (Phase A.3 de la roadmap)**
Quand une demande de séjour est créée et matche la zone géographique d'un centre APIDAE orphelin → email automatique fire-and-forget. Rate limit 7j via `dernierEmailDemandeAt`. Email plus générique ("Une demande dans votre zone — créez votre compte").

Les deux mécanismes coexistent et ne sont pas redondants :
- Widget = intention explicite d'un organisateur identifié → email prioritaire et personnalisé
- Notification auto = couverture exhaustive → email générique et rate-limité

### 4.5 Source IMPORT_CSV / IMPORT_API_EN — CRM hébergeur

Pas de Kbis. Données CRM uniquement.

---

## 5. Le mécanisme de claim hébergeur

### 5.1 Règle métier — quand demander un Kbis ?

**UNIQUEMENT** quand TOUTES ces conditions sont réunies :
1. Le User a le rôle **HEBERGEUR**
2. Il revendique une Organisation **existante en base**
3. Cette Organisation a au moins un **CentreHebergement rattaché**
4. Cette Organisation n'a aucune Membership avec **claimStatut=VALIDE**

Sinon → `claimStatut=NON_APPLICABLE`, pas de Kbis.

| Scénario | Rôle | Kbis ? |
|---|---|---|
| Organisateur Sophie tape "Collège Victor Hugo" (API EN) | ORGANISATEUR | **Non** |
| Organisateur Pierre se rattache à Collège Victor Hugo (déjà existant) | ORGANISATEUR | **Non** |
| Organisateur Mairie d'Annecy tape SIREN | ORGANISATEUR | **Non** |
| Hébergeur Sauvageon revendique centre APIDAE orphelin | HEBERGEUR | **Oui** |
| Hébergeur crée son centre manuellement (pas pré-référencé) | HEBERGEUR | **Non** |
| Demande de séjour sans compte (Flux 3) | ORGANISATEUR | **Non** |
| 2e hébergeur revendique même centre orphelin | HEBERGEUR | **Refus (déjà revendiqué)** |

### 5.2 Flow complet du claim

Identique à la version précédente : Découverte → Identification → Pré-remplissage SIREN → Upload Kbis → Notification admin → Validation manuelle Théo → Activation.

### 5.3 Page admin de validation

`/dashboard/admin/claims` (rôle ADMIN). Liste Memberships EN_ATTENTE_VALIDATION. Comparatif SIREN côte à côte. Boutons Valider/Refuser.

### 5.4 Sécurité du claim

Bucket R2 privé, signed URL TTL 15min, PDF uniquement max 10MB. User HEBERGEUR en attente → lecture seule (pas de devis, pas de modification profil).

### 5.5 Note juridique

Kbis = données personnelles dirigeant. Mention CGU, conservation 12 mois, stockage chiffré R2, pas de partage tiers. À valider avec juriste avant déploiement LMDJ.

---

## 6. Découpage en sous-chantiers

### Vue d'ensemble

| # | Sous-chantier | Durée | Dépendances |
|---|---|---|---|
| **0** | **Migration Railway → Scalingo** | **1-2 j** | **Aucune (faire en premier)** |
| 1 | Schéma Prisma + renommage rôles + migration backfill | 2 j | 0 |
| 1bis | Source Organisation unifiée + helper findOrCreate | 0.5 j | 1 |
| 2 | Endpoint backend autocomplete SIREN | 1 j | 1 |
| 3 | Composant frontend `<StructureSearch>` | 1.5 j | 2 |
| 4 | Refactor backend services (etablissement* → orga, rôles français) | 3-4 j | 1, 1bis |
| 4bis | Refactor claim hébergeur + Kbis + validation manuelle | 1.5 j | 1bis, 4 |
| 5 | Refactor frontend dashboards + routes françaises | 2 j | 4 |
| 5bis | Page publique de claim hébergeur | 1 j | 4bis, 3 |
| 6 | Page publique demande de séjour sans compte | 1.5 j | 3, 4 |
| 7 | Widget signalement intérêt + notification auto centres | 0.5 j | 4, 5bis |
| 8 | Suppression champs legacy User | 0.5 j | Tous |

**Total : 15.5-17.5 jours** (incluant Phase 0 Scalingo + renommage rôles + widget notification).

### Sous-chantier 0 — Migration Scalingo (1-2 j)

Cf. section 0.

### Sous-chantier 1 — Schéma Prisma + renommage rôles + migration backfill (2 j)

**Livrables :**
- `backend/prisma/schema.prisma` avec Organisation, Membership, RelationCommerciale, SejourRelation
- Enums en français : Role (ORGANISATEUR, SIGNATAIRE, HEBERGEUR, AUTORITE, etc.), RoleMembership (PROPRIETAIRE, ADMINISTRATEUR, MEMBRE), TypeStructure (élargi), SourceOrganisation, ClaimStatut, StatutRelation
- Migration SQL :
  - `ALTER TYPE "Role" RENAME VALUE` pour les 4 rôles renommés
  - `ALTER TYPE "TypeStructure" ADD VALUE` pour COLLECTIVITE_TERRITORIALE, ENTREPRISE, MICRO_ENTREPRISE
  - Création tables organisations, memberships, relations_commerciales, sejours_relations
  - Backfill idempotent (Users → Organisations + Memberships, Clients → Organisations + RelationCommerciale, CentreHebergement → organisationId)
- Scripts de validation post-migration

**Bugs cascade :** Risques #1, #2, #3, #4, **#23 (renommage rôles)**.

### Sous-chantier 1bis — Source Organisation unifiée (0.5 j)

Helper `findOrCreateOrganisation()`. Mise à jour searchPublic() et syncApidaeReseau().

### Sous-chantier 2 — Endpoint autocomplete SIREN (1 j)

OrganisationService + OrganisationController. Route publique `GET /api/organisations/search`. Cache 5min, rate limit 10req/min.

### Sous-chantier 3 — Composant `<StructureSearch>` (1.5 j)

Composant React réutilisable. Debounce 300ms, dropdown, navigation clavier, fallback saisie libre.

### Sous-chantier 4 — Refactor backend services (3-4 j)

7 fichiers backend + renommage complet des références aux rôles anglais. **Grep exhaustif `TEACHER|VENUE|DIRECTOR|RECTOR` dans tout le backend** pour s'assurer que rien n'est oublié.

Helpers :
```typescript
// getOrganisationPrincipale(userId) — centralise l'accès à l'orga primary
// shouldRequireKbis(userRole, organisationId) — règle métier claim
//   retourne true uniquement si role === Role.HEBERGEUR
//   ET orga existante avec CentreHebergement ET pas de claim VALIDE
```

### Sous-chantier 4bis — Claim hébergeur + Kbis + validation manuelle (1.5 j)

Backend : endpoints claim, upload-kbis, admin/valider. Frontend : page admin claims, composant KbisUpload, bandeau attente.

### Sous-chantier 5 — Refactor frontend + routes françaises (2 j)

- `/register/teacher` → `/register/organisateur` (+ redirect 301)
- `/register/director` → `/register/signataire` (+ redirect 301)
- `/register/venue` → `/register/hebergeur` (+ redirect 301)
- `/dashboard/teacher` → `/dashboard/organisateur` (+ redirect 301)
- `/dashboard/venue` → `/dashboard/hebergeur` (+ redirect 301)
- Intégration `<StructureSearch>` dans tous les formulaires d'inscription
- Adaptation dashboards pour Organisation primary

### Sous-chantier 5bis — Page publique claim hébergeur (1 j)

Route `/centre/[id]/claim`. CTA "C'est mon centre". SIREN + Kbis.

### Sous-chantier 6 — Page publique demande sans compte (1.5 j)

Route `/demande/[centreId]`. Création transactionnelle User + Organisation + Sejour + DemandeDevis. Rôle `ORGANISATEUR`, `claimStatut=NON_APPLICABLE`.

### Sous-chantier 7 — Widget signalement + notification auto (0.5 j)

- Adapter le widget existant (`InvitationCentreExterne`) pour le catalogue public
- Coder la notification automatique fire-and-forget dans `demande.service.ts.create()`
- Rate limit 7j via `dernierEmailDemandeAt` sur CentreHebergement
- Lien vers `/centre/[id]/claim` dans les deux emails

### Sous-chantier 8 — Suppression champs legacy User (0.5 j)

Migration SQL irréversible. **1 semaine minimum après stabilité prod.**

---

## 7. Catalogue des risques cascade

### Migration & schéma (#1-#4)

Identiques à la version précédente : UAI manquant, doublons UAI, migration Scalingo (remplace Railway), SIREN unique vs NULL.

**Note #3 mise à jour :** la migration se fera sur **Scalingo** (pas Railway). Le test en local avec dump prod est toujours obligatoire.

### Endpoint API (#5-#6)

Identiques : endpoint public rate-limité, API gouv timeout.

### Composant UI (#7-#8)

Identiques : UX confuse, encodage caractères.

### Refactor backend (#9-#14)

Identiques : includes profonds, Membership primary, Chorus Pro, email rectorat, filtrage UAI, auto-rattachement CRM.

### Frontend (#15-#16)

Identiques : cache localStorage, types TypeScript.

### Page publique (#17-#18)

Identiques : email existant, vérification email.

### Migration finale (#19)

Identique : irréversibilité.

### Claim hébergeur (#20bis-#22bis)

Identiques : Kbis falsifié, volume claims, demande erronée non-HEBERGEUR.

### Renommage rôles (#23 — NOUVEAU)

**#23 — Régression silencieuse sur les guards/conditions de rôle**
- Le renommage TEACHER→ORGANISATEUR, VENUE→HEBERGEUR, etc. touche potentiellement des dizaines d'endroits dans le code (guards NestJS, conditions frontend, emails, templates).
- Si un seul `if (role === 'TEACHER')` est oublié, un organisateur pourrait se voir refuser l'accès à son dashboard.
- **Mitigation** :
  - Grep exhaustif `TEACHER|VENUE|DIRECTOR|RECTOR` (case-sensitive + case-insensitive) dans tout le repo **avant** et **après** le renommage
  - `npm run build` côté backend ET frontend après chaque modification
  - Test manuel obligatoire de login avec chaque rôle dans la checklist section 8
  - Redirects 301 sur les anciennes routes `/register/teacher`, `/dashboard/teacher`, etc.

### Scalingo (#24 — NOUVEAU)

**#24 — Incompatibilité Next.js SSR avec Scalingo**
- Scalingo utilise des buildpacks Heroku-like. Le SSR Next.js 15 nécessite un serveur Node.js persistant, pas du serverless.
- **Mitigation** : tester en staging avant migration DNS. Si SSR ne fonctionne pas → garder frontend sur Vercel (pas de données personnelles) et ne migrer que backend + BDD. Documenter la décision.

---

## 8. Checklist de validation pré-déploiement

### Tests fonctionnels critiques

- [ ] **Migration Scalingo** : app démarre, BDD accessible, emails Brevo fonctionnels
- [ ] Login avec rôle ORGANISATEUR (ex-TEACHER) → dashboard organisateur s'affiche
- [ ] Login avec rôle HEBERGEUR (ex-VENUE) → dashboard hébergeur s'affiche
- [ ] Login avec rôle SIGNATAIRE (ex-DIRECTOR) → flow signature fonctionne
- [ ] Login avec rôle ADMIN → dashboard admin s'affiche + page claims accessible
- [ ] Login avec rôle RESEAU → dashboard réseau s'affiche
- [ ] Inscription organisateur nouveau (avec UAI) → **PAS de Kbis**
- [ ] Inscription organisateur nouveau (structure libre, sans UAI) → **PAS de Kbis**
- [ ] Inscription organisateur colo (mairie, asso) → **PAS de Kbis**
- [ ] Inscription signataire nouveau → **PAS de Kbis**
- [ ] Inscription hébergeur via création manuelle → **PAS de Kbis**
- [ ] Inscription hébergeur via claim centre APIDAE orphelin → **Kbis demandé**
- [ ] Validation admin claim + refus admin claim
- [ ] Redirection `/register/teacher` → `/register/organisateur` (301)
- [ ] Redirection `/dashboard/teacher` → `/dashboard/organisateur` (301)
- [ ] Redirection `/register/venue` → `/register/hebergeur` (301)
- [ ] Création séjour → organisation primary trouvée
- [ ] Soumission au rectorat → email envoyé avec bonnes infos
- [ ] Création devis → Organisation cliente remontée
- [ ] Sélection devis → RelationCommerciale créée
- [ ] Chorus Pro XML scolaire (UAI → schemeID="0009") et non-scolaire (SIRET → schemeID="0002")
- [ ] Widget "Signalez votre intérêt" sur centre non inscrit
- [ ] Notification auto centre APIDAE non inscrit (rate limit 7j)
- [ ] Demande sans compte (Flux 3)
- [ ] Comptes existants (Sauvageon, démo LMDJ, démo IDDJ) fonctionnels

### Vérifications BDD

```sql
-- Aucun User sans Membership
SELECT COUNT(*) FROM utilisateurs WHERE id NOT IN (SELECT user_id FROM memberships);
-- → 0

-- Chaque User a exactement 1 Membership primary
SELECT COUNT(*) FROM utilisateurs WHERE (
  SELECT COUNT(*) FROM memberships WHERE user_id = utilisateurs.id AND is_primary = true
) != 1;
-- → 0

-- Pas de doublon SIREN
SELECT siren, COUNT(*) FROM organisations WHERE siren IS NOT NULL GROUP BY siren HAVING COUNT(*) > 1;
-- → vide

-- Aucun ORGANISATEUR/SIGNATAIRE avec claim actif
SELECT COUNT(*) FROM memberships m
JOIN utilisateurs u ON u.id = m.user_id
WHERE u.role IN ('ORGANISATEUR', 'SIGNATAIRE') AND m.claim_statut != 'NON_APPLICABLE';
-- → 0

-- Plus aucun ancien rôle anglais
SELECT DISTINCT role FROM utilisateurs WHERE role IN ('TEACHER', 'DIRECTOR', 'VENUE', 'RECTOR');
-- → vide

-- Organisations par source
SELECT source, COUNT(*) FROM organisations GROUP BY source;
```

### Tests de régression et performance

- [ ] Flux complet scolaire bout-en-bout
- [ ] Flux APIDAE (centre orphelin reste orphelin si non claimé)
- [ ] PDF planning, emails parents, dashboard réseau, export CSV CRM
- [ ] Temps de chargement dashboard hébergeur : max +200ms vs avant

---

## 9. Phase 2 (futur conditionnel)

Identique à la version précédente : multi-établissement, SSO APIDAE, Espace Ressources LMDJ, OCR Kbis automatique, switcher multi-orga.

---

## 10. Roadmap consolidée

(Tiré et fusionné de `ROADMAP_COMPLETE.md` et `ROADMAP_POST_DEMO.md` — ces deux fichiers deviennent obsolètes.)

### Phase A — Quick wins post-refactor (Mai-Juin 2026)

- A.1 Cohérence colos — repris dans le refactor (sous-chantiers 4, 5, 7)
- A.2 Landing page screenshots produit — 4h, après refactor
- A.3 Notification centres APIDAE non inscrits — repris dans sous-chantier 7
- A.4 Intégration APIDAE LMDJ — 15 min, dès credentials reçus

### Phase B — Features haute valeur (Juillet-Août 2026)

- B.1 Pop-up aide IA contextuelle — 3-5 jours
- B.2 Planning IA génération auto — 2-3 jours
- B.3 Menu IA auto-généré — 3-5 jours
- B.4 Appel d'offres transport — 2-3 semaines

### Phase C — Marché colo (Septembre-Décembre 2026)

- C.1 Flow validation colo (déclaration TAM) — 1 semaine
- C.2 Gestion animateurs BAFA/BAFD — 1 semaine
- C.3 Inscription directe familles — 2-3 semaines
- C.4 Moyens de paiement colo — 1 semaine (déclaratif) / 3-4 semaines (Stripe)

### Phase D — Extensions (2027)

- D.1 Blog parent/prof/élève — 2-3 semaines
- D.2 Gestion RH hébergeur — 3-4 semaines
- D.3 Marketplace activités — 4-6 semaines
- D.4 Intégration paiement Stripe Connect — 3-4 semaines
- D.5 PWA mobile — 4-6 semaines

### Phase E — Dette technique

- E.1 DashboardShell unifié — 4-6 jours
- E.2 JWT httpOnly cookie — 1-2 jours
- E.3 Chorus Pro production (AIFE, PISTE) — variable
- E.4 RC Pro + Cyber insurance — ~500-700€/an

### Phase F — Financement

1. Initiative Faucigny Mont-Blanc (immédiat)
2. Start-up & Go Emergence (en cours)
3. Réseau Entreprendre Haute-Savoie (6 mois)
4. BPI (12-18 mois)

### Récapitulatif effort

| Phase | Effort | Période |
|---|---|---|
| **Phase 0 + Refactor Organisations** | **15.5-17.5 jours** | **Mai 2026** |
| Phase A | 1 semaine | Mai-Juin 2026 |
| Phase B | 4-6 semaines | Juillet-Août 2026 |
| Phase C | 6-8 semaines | Sept-Déc 2026 |
| Phase 2 (conditionnel) | 1-3 semaines | Post-LMDJ |
| Phase D | 15-20 semaines | 2027 |
| Phase E | 2-3 semaines | Continu |

---

## 11. Glossaire

- **Organisation** : entité légale identifiée par SIREN. Cœur du nouveau modèle.
- **Membership** : relation humain ↔ organisation (PROPRIETAIRE/ADMINISTRATEUR/MEMBRE).
- **isPrimary** : flag Membership désignant l'Organisation active du User.
- **RelationCommerciale** : remplace Client. Lien hébergeur ↔ cliente.
- **SejourRelation** : remplace SejourClient.
- **Claim** : revendication par un User HEBERGEUR d'une Organisation orpheline avec CentreHebergement. Nécessite Kbis + validation admin. Jamais pour ORGANISATEUR/SIGNATAIRE.
- **ClaimStatut** : NON_APPLICABLE, EN_ATTENTE_DOCUMENT, EN_ATTENTE_VALIDATION, VALIDE, REFUSE.
- **TypeStructure** : classification juridique/administrative (pas contrôle d'accès).
- **Role** (français) : ORGANISATEUR, SIGNATAIRE, HEBERGEUR, AUTORITE, RESEAU, PARENT, ADMIN.
- **Organisation orpheline** : sans Membership rattachée (ex : centre APIDAE importé en bulk).
- **shouldRequireKbis()** : helper centralisé, 4 conditions cumulatives.
- **getOrganisationPrincipale()** : helper centralisé pour l'orga primary.
- **Scalingo** : PaaS français souverain remplaçant Railway. Datacenter Paris, ISO 27001, HDS.

---

## Validation

Ce document est validé par Théo le 29 avril 2026.

Ordre d'exécution :
1. **Phase 0 : Migration Scalingo** (1-2 jours)
2. **Sous-chantier 1 : Schéma Prisma + rôles français + backfill** (2 jours)
3. **Sous-chantiers 1bis → 8** (séquentiels, validation Claude après chaque)

Stratégie de déploiement : accumulation locale → push unique Scalingo en fin de chantier.

---

*Document à maintenir à jour. Toute déviation documentée ici avec date et raison.*
