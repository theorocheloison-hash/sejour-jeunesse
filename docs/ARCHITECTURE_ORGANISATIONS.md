# LIAVO — Architecture Organisations & Refactor Phase 1

> **Document de référence** pour le refactor structurel du modèle de données LIAVO.
> Rédigé le 29 avril 2026, après audit complet du code backend/frontend.
> Mis à jour le 29 avril 2026 (v3) : Phase 0 Scalingo, rôles français, TypeStructure élargi, widget+notification centres non inscrits.
> Mis à jour le 29 avril 2026 (v3.1) : Phase 0 Scalingo **TERMINÉE** — backend+BDD+frontend+stockage migrés en France.
> Mis à jour le 03 mai 2026 (v3.2) : Lacunes identifiées par audit — SC4ter (flow signataire), typeContexte séjour, modèles legacy InvitationDirecteur/InvitationCollaboration, Rappel/ContactClient orphelins, visibilité signataire, statut DECLARE_TAM.
> Mis à jour le 04 mai 2026 (v3.3) : SC8 terminé — suppression colonnes etablissement* sur User. Positionnement validé : LIAVO = plateforme développée par les hébergeurs, pour les hébergeurs.
> Mis à jour le 04 mai 2026 (v3.4) : SC8 déployé en prod (commit+push, migration SQL appliquée, JWT_SECRET changé). SC9 documenté — refactor StatutDevis pour correspondance BDD/réalité cycle de vie.
> Mis à jour le 04 mai 2026 (v3.6) : Audit complet des 5 routes d’entrée hébergeur. 3 bugs identifiés sur registerHebergeur(), matching APIDAE, et searchPublic(). À corriger avant SC5bis.
> Mis à jour le 04 mai 2026 (v3.7) : SC5bis corrections A+B+C + Route 6 invitation admin livrés et déployés. Migration 20260504_sc5bis_invitation_hebergement_enrichi en prod. tsc EXIT=0. SC5bis frontend (page claim + /register/hebergeur bifurcation) reste à faire.
> Mis à jour le 04 mai 2026 (v3.8) : SC5bis frontend livré — checkInvitation() réécrit (3 cas typés), RegisterCentreDto optionnalisé, register() prenom/nom corrigé, /register/hebergeur bifurcation CAS1/2/3, page admin invitations créée.
> Mis à jour le 04 mai 2026 (v3.9) : Audit bugs latents — 6 bugs corrigés + 5 URLs obsolètes bonus. Routes /register/venue, /dashboard/venue, /dashboard/rector éradiquées du codebase. Guard soumettreAuRectorat() corrigé. Filtre géographique notifications ajouté. 0 occurrence résiduelle.
> Statut : **SC1→SC5bis ✅ complet. Bugs latents ✅ corrigés. SC5bis page /centre/[id]/claim reste à faire. SC9 après. SC7 suspendu.**

---

## Table des matières

0. [Phase 0 — Migration Railway → Scalingo (souveraineté données France)](#0-phase-0--migration-railway--scalingo)
1. [Pourquoi ce refactor](#1-pourquoi-ce-refactor)
2. [Modèle de données cible](#2-modèle-de-données-cible)
   - 2.6 Appartenance du séjour — décision architecturale
   - 2.7 typeContexte sur Sejour — branchement conditionnel scolaire / hors-scolaire
3. [Mapping ancien → nouveau (incluant renommage des rôles)](#3-mapping-ancien--nouveau)
   - 3.6 Modèles legacy à migrer : InvitationDirecteur, InvitationCollaboration
   - 3.7 Modèles CRM legacy à migrer : Rappel, ContactClient
4. [Les sources d'Organisation et mécanismes de notification](#4-les-sources-dorganisation-et-mécanismes-de-notification)
5. [Le mécanisme de claim hébergeur (Kbis + validation manuelle)](#5-le-mécanisme-de-claim-hébergeur)
5bis. [Le flow invitation signataire post-refactor (SC4ter)](#5bis-le-flow-invitation-signataire-post-refactor)
5ter. [Refactor StatutDevis — correspondance BDD/cycle de vie réel (SC9)](#5ter-refactor-statutdevis--sc9)
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

- **Role** (sur l'utilisateur) → détermine les permissions et le dashboard visible (ORGANISATEUR, HEBERGEUR, SIGNATAIRE, etc.)
- **TypeStructure** (sur Organisation) → classifie la nature juridique/administrative, détermine les branchements UX conditionnels (UAI vs libre, rectorat vs TAM, directeur vs signataire libre)
- **Modèle économique** → déterminé par la présence de CentreHebergement + planAbonnement, pas par TypeStructure ni Role. Seul l'hébergeur paie.

Exemple concret Mairie de Morillon double-casquette :
- Organisation : `TypeStructure=MAIRIE`, SIREN unique
- Sophie (directrice ALSH, organise des colos) → utilisateur `role=ORGANISATEUR`, Membership vers cette Organisation
- Marc (responsable gîte municipal, accueille des groupes) → utilisateur `role=HEBERGEUR`, Membership vers cette même Organisation
- Dashboard de Sophie : flow organisateur avec branchement "non-scolaire" (pas d'UAI, signataire libre)
- Dashboard de Marc : flow hébergeur avec devis, planning, CRM. Marc paie l'abonnement LIAVO.

### 2.7 Appartenance du séjour — décision architecturale

**Décision validée le 03/05/2026 :** un séjour appartient à son créateur (l'utilisateur, FK `createurId → utilisateurs`), pas à l'Organisation.

Conséquences :
- Deux enseignants du même collège ne partagent **pas** automatiquement leurs séjours via le Membership. Chaque séjour est souverain de son créateur.
- La FK `Sejour.createurId → User` reste inchangée. Pas de migration vers `organisationId` sur `Sejour`.
- L'organisation de l'organisateur est accessible en passant par `getOrganisationPrincipale(createurId)` quand nécessaire (ex : Chorus Pro, CRM hébergeur).
- La collaboration multi-utilisateurs sur un même séjour (phase 2, switcher multi-orga) n'est pas dans le périmètre Phase 1.

### 2.8 typeContexte sur Sejour — branchement conditionnel scolaire / hors-scolaire

**Problème :** pour brancher les flows conditionnels (rectorat vs TAM, directeur d'école vs signataire libre, UAI obligatoire vs SIRET), il faut connaître le contexte du séjour au moment de sa création. Déduire ce contexte depuis `Organisation.typeStructure` de l'organisateur est fragile : une Mairie peut organiser des colos ET des séjours scolaires.

**Décision :** ajouter un champ `typeContexte` sur `Sejour`.

```prisma
enum TypeContexteSejour {
  SCOLAIRE       // Flow : UAI obligatoire, invitation signataire (directeur d'école), soumission DSDEN
  HORS_SCOLAIRE  // Flow : signataire libre (maire, président asso, DGS), déclaration TAM, pas de rectorat
}

model Sejour {
  // ... champs existants ...
  typeContexte TypeContexteSejour @default(SCOLAIRE) @map("type_contexte")
}
```

Règles de branchement :
- Si `typeContexte=SCOLAIRE` → afficher UAI, inviter signataire "directeur d'école", bouton "Soumettre au rectorat", statut `SOUMIS_RECTORAT`
- Si `typeContexte=HORS_SCOLAIRE` → masquer UAI, inviter signataire "responsable légal", bouton "Télécharger le dossier de déclaration", statut `DECLARE_TAM`

Valeur par défaut `SCOLAIRE` pour compatibilité ascendante avec les séjours existants.

**Migration SQL :**
```sql
ALTER TYPE IF EXISTS "TypeContexteSejour" ADD VALUE IF NOT EXISTS 'SCOLAIRE';
ALTER TYPE IF EXISTS "TypeContexteSejour" ADD VALUE IF NOT EXISTS 'HORS_SCOLAIRE';
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS type_contexte TEXT NOT NULL DEFAULT 'SCOLAIRE';
```

**Impact StatutSejour :** ajouter `DECLARE_TAM` à l'enum existant pour les séjours hors-scolaire.
```sql
ALTER TYPE "StatutSejour" ADD VALUE IF NOT EXISTS 'DECLARE_TAM';
```

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

### 3.6 Modèles legacy à migrer : InvitationDirecteur et InvitationCollaboration

Ces deux modèles stockent des champs établissement à plat (`etablissementUai`, `etablissementNom`, etc.) — vestige du modèle pré-refactor. Ils doivent être mis à jour pour porter des références vers `Organisation`.

**`InvitationDirecteur` (organisateur → signataire) — modifications requises :**

```prisma
model InvitationDirecteur {
  // champs existants conservés pour compatibilité...
  organisationId    String?   @map("organisation_id") @db.Uuid   // NOUVEAU — orga de l'organisateur
  typeContexte      String?   @map("type_contexte") @db.VarChar(20) // NOUVEAU — 'SCOLAIRE' | 'HORS_SCOLAIRE'

  organisation      Organisation? @relation(fields: [organisationId], references: [id], onDelete: SetNull)
}
```

- `organisationId` : FK nullable vers l'Organisation de l'organisateur émetteur. Quand renseignée, `registerSignataire` crée automatiquement un Membership vers cette Organisation sans demander de saisie.
- `typeContexte` : propagé depuis le séjour, détermine le flow d'inscription présenté au signataire (recherche UAI scolaire vs StructureSearch libre).
- Les champs `etablissementUai` et `etablissementNom` sont conservés pendant la période de transition (SC8), utilisés en fallback si `organisationId` est null (invitations créées avant le refactor).

**`InvitationCollaboration` (hébergeur → organisateur) — modifications requises :**

```prisma
model InvitationCollaboration {
  // champs existants conservés...
  organisationCibleId String?  @map("organisation_cible_id") @db.Uuid  // NOUVEAU

  organisationCible   Organisation? @relation(fields: [organisationCibleId], references: [id], onDelete: SetNull)
}
```

- `organisationCibleId` : FK nullable vers l'Organisation pré-remplie par l'hébergeur. Quand renseignée, `registerOrganisateur` crée automatiquement un Membership sans re-saisie.
- Les champs `etablissementUai/Nom/Adresse/Ville` sont conservés en fallback jusqu'au SC8.

**Règle générale pour les deux modèles :** si `organisationId` / `organisationCibleId` est non null à l'inscription → Membership automatique créé, formulaire pré-rempli en lecture seule. Si null (invitation legacy) → comportement actuel conservé.

### 3.7 Modèles CRM legacy à migrer : Rappel et ContactClient

Aujourd'hui `Rappel` et `ContactClient` sont rattachés à `Client` (ancien CRM). Post-migration vers `RelationCommerciale`, ces tables deviennent orphelines si on ne les migre pas.

**Modifications requises au SC4 (dans le même sous-chantier que la migration Client → RelationCommerciale) :**

```prisma
model Rappel {
  // Ajouter :
  relationId   String?  @map("relation_id") @db.Uuid   // FK vers RelationCommerciale
  relation     RelationCommerciale? @relation(fields: [relationId], references: [id], onDelete: SetNull)
  // Conserver clientId nullable pendant la transition
}

model ContactClient {
  // Ajouter :
  relationId   String?  @map("relation_id") @db.Uuid
  relation     RelationCommerciale? @relation(fields: [relationId], references: [id], onDelete: SetNull)
  // Conserver clientId nullable pendant la transition
}
```

**Backfill :** pour chaque `Rappel` et `ContactClient` lié à un `Client`, trouver la `RelationCommerciale` correspondante via `organisationClienteId` (dérivé du `Client.uai` ou `Client.nom`) et renseigner `relationId`.

**Suppression de `Client`, `ContactClient`, `Rappel → clientId` :** au SC8 uniquement, après validation que `relationId` est renseigné pour tous les enregistrements actifs.

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

## 5bis. Le flow invitation signataire post-refactor (SC4ter)

### 5bis.1 Contexte et problème

L'`InvitationDirecteur` actuelle stocke `etablissementUai` et `etablissementNom` à plat, sans lien vers `Organisation`. Quand le signataire s'inscrit via le token, `registerSignataire` crée un utilisateur avec ces champs copiés sur `User` mais **ne crée pas de Membership**. Il n'y a donc aucun lien structurel entre le signataire et l'Organisation du séjour.

Par ailleurs, le formulaire `/register/signataire` est entièrement orienté scolaire (filtres École/Collège/Lycée, recherche UAI, message "directeur d'établissement"), rendant le flow inutilisable pour un signataire hors-scolaire (maire, président d'asso, DGS).

### 5bis.2 Cas 1 — Signataire scolaire (directeur d'école)

**Contexte :** un enseignant du Collège Victor Hugo invite son directeur à signer le dossier.

**Flow cible :**
1. L'organisateur envoie l'invitation → `InvitationDirecteur` créée avec `organisationId` = l'Organisation "Collège Victor Hugo" de l'organisateur, `typeContexte='SCOLAIRE'`
2. Le directeur reçoit l'email, clique le lien → `/register/signataire?token=XXX`
3. Le frontend lit le token → récupère `organisationId` + `typeContexte`
4. Si `organisationId` non null et `typeContexte=SCOLAIRE` → affiche le nom de l'établissement en lecture seule (pré-rempli, non modifiable), pas de recherche UAI à refaire
5. L'inscription crée le Membership : `Membership(userId=directeur, organisationId=CollègeVictorHugo, role=MEMBRE, isPrimary=true)`
6. Résultat : le directeur est rattaché au même collège que l'organisateur, sans ressaisie

**Règle :** le signataire scolaire **ne peut pas choisir une autre organisation** que celle de l'invitation. L'organisation est imposée par le contexte du séjour.

### 5bis.3 Cas 2 — Signataire hors-scolaire (maire, président d'asso, DGS)

**Contexte :** un directeur de centre de loisirs (Organisation = "Association Les Pins") organise une colo et a besoin de la signature du maire de sa commune.

**Différence fondamentale avec le cas scolaire :** le signataire (maire) représente une Organisation **distincte** de celle de l'organisateur. La mairie n'est pas l'asso. Ce ne sont pas deux membres de la même Organisation.

**Flow cible :**
1. L'organisateur envoie l'invitation → `InvitationDirecteur` créée avec `organisationId=null` (la mairie n'est pas encore en base ou pas connue), `typeContexte='HORS_SCOLAIRE'`
2. Le maire reçoit l'email, clique le lien → `/register/signataire?token=XXX`
3. Le frontend lit `typeContexte=HORS_SCOLAIRE` → affiche `<StructureSearch>` (SIRENE) pour que le maire trouve sa mairie, avec fallback saisie libre
4. Le maire sélectionne ou saisit sa mairie → Organisation créée ou récupérée via `findOrCreateOrganisation()`
5. L'inscription crée le Membership : `Membership(userId=maire, organisationId=MairieDeXxx, role=PROPRIETAIRE, isPrimary=true)`
6. L'`InvitationDirecteur` est mise à jour : `organisationId = MairieDeXxx.id` (trace pour l'historique)

**Note :** dans ce cas, l'organisateur et le signataire appartiennent à deux Organisations différentes. Le lien entre eux est établi via le séjour (`Sejour.createurId` → organisateur) et la signature (`Devis.signatureDirecteur`), pas via un Membership commun. C'est intentionnel.

### 5bis.4 Modifications techniques requises (SC4ter)

**Durée estimée : 1 jour. Dépendances : SC1, SC1bis, SC4.**

**Backend — `InvitationDirecteur` :**
- Ajouter champs `organisationId` (FK nullable) et `typeContexte` (VARCHAR 20) — cf. section 3.6
- Modifier `invitations-directeur.service.ts` `findByToken()` : retourner `organisationId` + `typeContexte` + `organisation.nom` en plus des champs existants
- Modifier `auth.service.ts` `registerSignataire()` : si `organisationId` non null → créer Membership automatique vers cette Organisation avec `isPrimary=true`
- Modifier le service créateur d'invitation (dans `sejour.service.ts` ou équivalent) : renseigner `organisationId` depuis `getOrganisationPrincipale(organisateurId)` et `typeContexte` depuis `sejour.typeContexte`

**Frontend — `/register/signataire` :**
- Si `typeContexte=SCOLAIRE` et `organisationId` non null → afficher l'établissement pré-rempli en lecture seule, supprimer les filtres École/Collège/Lycée et la recherche UAI
- Si `typeContexte=HORS_SCOLAIRE` → afficher `<StructureSearch allowFreeText={true}>` à la place de la recherche UAI
- Si token absent ou `typeContexte` non reconnu → fallback sur le comportement actuel (recherche UAI)
- Supprimer le message "Seuls les directeurs d'établissement peuvent valider des dossiers de séjours scolaires" — remplacer par un message contextuel selon `typeContexte`

### 5bis.5 Visibilité des séjours pour le SIGNATAIRE

**Règle validée :** un SIGNATAIRE voit **tous** les séjours dont le créateur appartient à la même Organisation que lui (Membership commun), PLUS les séjours pour lesquels il a reçu une invitation directe (`InvitationDirecteur.emailDirecteur = signataire.email`).

Cela signifie concrètement : un directeur du Collège Victor Hugo voit tous les séjours de tous les enseignants de ce collège, pas seulement ceux pour lesquels il a été explicitement invité. C'est cohérent avec sa responsabilité légale de validation sur son établissement.

Pour un signataire hors-scolaire (maire, président d'asso), la visibilité est limitée aux séjours avec invitation directe, car il n'y a pas de notion d'appartenance commune — il signe ponctuellement pour un séjour précis.

**Post-refactor**, la requête `getAllSejoursSignataire()` doit être adaptée : au lieu de matcher sur `etablissementUai`, elle filtre sur Membership commun (cas scolaire) OU invitation directe (cas hors-scolaire + fallback legacy).

```typescript
// Logique cible dans sejour.service.ts getAllSejoursSignataire(userId, signataire)
const orgaSignataire = await getOrganisationPrincipale(userId, prisma);

// Cas scolaire : TOUS les séjours des organisateurs de la même Organisation
const sejoursParOrga = orgaSignataire
  ? await prisma.sejour.findMany({
      where: {
        createur: {
          memberships: { some: { organisationId: orgaSignataire.id } }
        }
      }
    })
  : [];

// Cas hors-scolaire + fallback invitations legacy
const sejoursParInvitation = await prisma.sejour.findMany({
  where: {
    invitationsDirecteur: {
      some: { emailDirecteur: signataire.email }
    }
  }
});

// Union dédupliquée — les séjours scolaires apparaissent une seule fois
// même si le signataire a aussi reçu une invitation directe dessus
return deduplicateById([...sejoursParOrga, ...sejoursParInvitation]);
```

**Note importante sur les performances :** pour un collège actif avec 10 enseignants et 30 séjours sur l'année, cette requête reste légère. Si le volume augmente significativement (réseaux avec centaines d'établissements), envisager une pagination au SC4ter.

---

## 5ter. Refactor StatutDevis — SC9

### Problème identifié (04/05/2026)

Le badge affiché sur le devis dans le dashboard hébergeur indique « Sélectionné » alors que le devis est dans l’onglet « Signé direction ». Ce n’est pas un bug d’affichage à corriger par un patch conditionnel : c’est une incohérence de modélisation. Le cycle de vie réel d’un devis est encodé dans plusieurs champs (`statut` + `typeDocument` + `signatureDirecteur`) alors qu’il devrait être représenté par un seul enum à la source.

### Anatomie du problème

**`StatutDevis` actuel en BDD (6 valeurs) :**
```
EN_ATTENTE | ACCEPTE | REFUSE | EN_ATTENTE_VALIDATION | SELECTIONNE | NON_RETENU
```

**États réels du cycle de vie (9 états distincts) encodés sur 3 champs :**

| État réel | `statut` BDD | `typeDocument` | `signatureDirecteur` | Affichage actuel |
|---|---|---|---|---|
| En attente de réponse hébergeur | `EN_ATTENTE` | `DEVIS` | null | « En attente » |
| Devis envoyé, non encore sélectionné | `EN_ATTENTE` | `DEVIS` | null | « En attente » |
| Sélectionné par l’enseignant | `SELECTIONNE` | `DEVIS` | null | « Sélectionné » ✅ |
| Signé par le signataire | `SELECTIONNE` | `DEVIS` | non-null | « Sélectionné » ❌ (devrait être « Signé ») |
| Converti en facture acompte | `SELECTIONNE` | `FACTURE_ACOMPTE` | non-null | « Sélectionné » ❌ |
| Acompte versé | `SELECTIONNE` | `FACTURE_ACOMPTE` | non-null | « Sélectionné » ❌ |
| Facture solde émise | `SELECTIONNE` | `FACTURE_SOLDE` | non-null | « Sélectionné » ❌ |
| Non retenu | `NON_RETENU` | `DEVIS` | null | « Non retenu » ✅ |
| Refusé | `REFUSE` | `DEVIS` | null | « Refusé » ✅ |

**Cause racine :** `SELECTIONNE` couvre 5 états différents. Le frontend compense avec `matchesOnglet()` (logique de filtrage multi-champs) mais le badge ne suit pas, et les états avancés du cycle de facturation sont invisibles en BDD.

### Solution à la source : étendre `StatutDevis`

**Enum cible :**
```
EN_ATTENTE            → inchangé
ACCEPTE               → inchangé (si utilisé)
REFUSE                → inchangé
EN_ATTENTE_VALIDATION → inchangé (si utilisé)
NON_RETENU            → inchangé
SELECTIONNE           → inchangé (enseignant a sélectionné, signataire pas encore signé)
SIGNE_DIRECTION       → NOUVEAU (signataire a signé, pas encore facturé)
FACTURE_ACOMPTE       → NOUVEAU (facture acompte émise)
FACTURE_SOLDE         → NOUVEAU (facture solde émise)
```

**`typeDocument` devient redondant :** une fois `StatutDevis` étendu, `typeDocument` peut être supprimé ou conservé comme méta-information technique (utile pour le PDF et Chorus Pro). Décision prise : **conserver `typeDocument`** en redondance pour ces usages, ne plus l’utiliser comme indicateur d’état.

**`EN_ATTENTE_VALIDATION` et `ACCEPTE` :** ces deux valeurs sont déclarées dans l’enum Prisma mais **n’apparaissent nulle part dans le code** (grep confirmé le 04/05/2026). Elles sont mortes. Décision : les **conserver comme valeurs réservées** — supprimer une valeur d’un enum PostgreSQL est complexe (recréation de l’enum), le risque est disproportionné au bénéfice. Documenter : « réservées, non utilisées ».

### Impact cascade à anticiper

**Backend :**
- `schema.prisma` : ajout 3 valeurs dans enum `StatutDevis`
- Migration SQL : `ALTER TYPE` sur l’enum PostgreSQL (non-destructif)
- `devis.service.ts` `updateStatut()` : transition `SELECTIONNE` → `SIGNE_DIRECTION` au moment de la signature signataire
- `devis.service.ts` `facturerAcompte()` : transition `SIGNE_DIRECTION` → `FACTURE_ACOMPTE`
- `devis.service.ts` `facturerSolde()` : transition `FACTURE_ACOMPTE` → `FACTURE_SOLDE`
- Backfill BDD : mettre à jour les devis existants avec `signatureDirecteur` non-null → `SIGNE_DIRECTION`
- Backfill BDD : devis avec `typeDocument=FACTURE_ACOMPTE` → `FACTURE_ACOMPTE`
- Backfill BDD : devis avec `typeDocument=FACTURE_SOLDE` → `FACTURE_SOLDE`

**Frontend :**
- `STATUT_BADGE` dans `hebergeur/devis/page.tsx` : ajouter les 3 nouveaux statuts
- `matchesOnglet()` : simplifier — les onglets peuvent filtrer sur `statut` seul au lieu de `statut` + `typeDocument` + `signatureDirecteur`
- Partout où `typeDocument` est utilisé pour du routing conditionnel : migrer vers `statut`

**Risques :**
- Les devis existants en prod avec `typeDocument=FACTURE_ACOMPTE` et `statut=SELECTIONNE` doivent être backfillés avant que le frontend lise `statut` — sinon ils disparaissent des onglets. Faire le backfill SQL AVANT de déployer le nouveau frontend.
- Vérifier que `getChorusXml()` ne dépend pas du `typeDocument` pour sa logique interne.

### Prérequis avant de coder

1. Audit complet des usages de `typeDocument` dans le backend (grep `typeDocument` dans `src/`)
2. Audit complet des usages de `signatureDirecteur` comme condition de routage
3. Décider si `typeDocument` est supprimé ou conservé en rédondance
4. Rédiger le script de backfill SQL + le valider sur un dump de la prod avant exécution

### Quand faire SC9

SC9 est à faire **avant la visio LMDJ**, pas après. Règle absolue : aucune visio, aucun onboarding tant que le refactor complet de LIAVO n’est pas finalisé (totalité du doc architecture). Si LMDJ voit des incohérences dans l’outil, il n’y aura pas de signature.

SC9 s’intègre donc dans la séquence des sous-chantiers avant toute présentation commerciale.

**Estimé : 1 jour (migration + backfill + frontend).**

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
| 4ter | Flow invitation signataire post-refactor (InvitationDirecteur + Membership auto) | 1 j | 1, 4 |
| 5 | Refactor frontend dashboards + routes françaises | 2 j | 4, 4ter |
| 5bis | Page publique de claim hébergeur | 1 j | 4bis, 3 |
| 6 | Page publique demande de séjour sans compte | 1.5 j | 3, 4 |
| 7 | Widget signalement intérêt + notification auto centres | 0.5 j | 4, 5bis |
| 8 | Suppression champs legacy User | 0.5 j | Tous |

**Total : 16.5-18.5 jours** (incluant Phase 0 Scalingo + renommage rôles + widget notification + SC4ter signataire).

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

### Sous-chantier 4ter — Flow invitation signataire post-refactor (1 j)

Cf. section 5bis pour le détail complet.

**Livrables backend :**
- Migration Prisma : ajout `organisationId` + `typeContexte` sur `InvitationDirecteur`
- Ajout `typeContexte` + enum `TypeContexteSejour` sur `Sejour` (avec `DECLARE_TAM` dans `StatutSejour`)
- `invitations-directeur.service.ts` `findByToken()` : expose `organisationId`, `typeContexte`, `organisation.nom`
- `auth.service.ts` `registerSignataire()` : création Membership automatique si `organisationId` non null
- Service émetteur d'invitation : renseigner `organisationId` + `typeContexte` à la création
- `sejour.service.ts` : adapter `getAllSejoursSignataire()` — cf. section 5bis.5

**Livrables frontend :**
- `/register/signataire` : bifurcation `typeContexte=SCOLAIRE` (pré-rempli lecture seule) vs `HORS_SCOLAIRE` (`<StructureSearch>` libre)
- Dashboard signataire : adapter le filtre "À signer" pour inclure séjours par Membership + séjours par invitation directe

**Bugs cascade à anticiper :**
- #25 — Invitations legacy (sans `organisationId`) : le fallback doit rester fonctionnel, ne pas casser les invitations déjà envoyées
- #26 — Double Membership si le signataire existait déjà avec un Membership sur la même Organisation : vérifier l'unicité `(userId, organisationId)` avant création

### Sous-chantier 5 — Refactor frontend + routes françaises (2 j)

- `/register/teacher` → `/register/organisateur` (+ redirect 301)
- `/register/director` → `/register/signataire` (+ redirect 301)
- `/register/venue` → `/register/hebergeur` (+ redirect 301)
- `/dashboard/teacher` → `/dashboard/organisateur` (+ redirect 301)
- `/dashboard/venue` → `/dashboard/hebergeur` (+ redirect 301)
- Intégration `<StructureSearch>` dans tous les formulaires d'inscription
- Adaptation dashboards pour Organisation primary

### Sous-chantier 5bis — Page publique claim hébergeur (2-3 j)

**Audit des 5 routes d’entrée hébergeur (04/05/2026) :**

| Route | Couverture | Bugs |
|---|---|---|
| 1 — Invitation réseau (LMDJ/IDDJ) | ✅ Complet | Matching APIDAE sur email uniquement — si email centre ≠ email invitation → doublon silencieux |
| 2 — Invitation organisateur | ⚠️ Partiel | `registerHebergeur()` ne fait pas de matching APIDAE ni `findOrCreateOrganisation` → centre sans Organisation |
| 3a — Autonome, centre inexistant | ⚠️ Partiel | Idem Route 2 — `registerHebergeur()` ne crée pas d’Organisation |
| 3b — Autonome, centre en base | ❌ Manquant | SC5bis — pas de page `/centre/[id]/claim`, pas de matérialisation des centres EN |
| 4 — Push email géographique (appel d’offres) | ⏸ SC7 suspendu | Le lien dans l’email n’existe pas encore — à concevoir en même temps que SC7 |
| 5 — Autonome, trouve son centre dans le catalogue | ❌ Manquant | Identique à 3b — SC5bis |
| 6 — Invitation admin avec pré-création centre | ❌ Manquant | `InvitationHebergement` existe en BDD mais sans email, sans pré-création centre, sans interface admin |

**3 corrections préalables à SC5bis (dans cet ordre) :**

**Correction A — `registerHebergeur()` dans `auth.service.ts` (0.5j)**
Ajouter `findOrCreateOrganisation` + `findOrCreateMembership` après la création du centre. Même logique que `centre.service.ts register()`. Sans ça, tout hébergeur passant par la Route 2 ou 3a se retrouve avec un centre sans Organisation — incohérence avec le modèle de données.

**Correction B — Matching APIDAE dans `centre.service.ts register()` (0.5j)**
Etape actuelle : `where: { email: invitation.email, userId: null, source: 'APIDAE' }`. Problème : si l’email du centre APIDAE est différent de l’email de l’invitation (cas fréquent — email perso vs email centre), le matching échoue et un doublon est créé silencieusement.
Solution : fallback nom+ville si aucun match par email. Ordre : email → nom+ville normalisé (insensitive).

**Correction C — Déduplication dans `searchPublic()` (0.5j)**
Current: `[...prismaResults, ...enResults]` sans déduplication. Même centre peut apparaître 2 fois.
Solution : après concat, filtrer les résultats EN dont le nom+ville correspond à un résultat Prisma (insensitive). Privilégier le résultat Prisma (UUID) en cas de doublon.

**SC5bis proprement dit (2j) :**

*Sous-problème 1 — Centre APIDAE en base (UUID connu)*
Flow direct : CTA "C’est mon centre" → `POST /organisations/:organisationId/claim` → upload Kbis si requis → notification admin.

*Sous-problème 2 — Centre API EN hors base (identifiant string, pas UUID)*
`searchPublic()` concatène des résultats Prisma (UUID) et des résultats API EN live (identifiant string non-UUID). Ces derniers n’ont pas d’Organisation en base.
Solution : à la sélection d’un centre EN par un HEBERGEUR, matérialiser en base via `findOrCreateOrganisation()` + création d’un `CentreHebergement` minimal (source=API_EDUCATION_NATIONALE), puis rediriger vers le claim.
Point d’attention : `getPublic(id)` fait un `isUuid` check — les ids EN ne passent pas. Le frontend détecte si l’id est UUID (centre en base) ou string (centre EN) et bifurque vers un endpoint de matérialisation.

**Estimé total (corrections A+B+C + SC5bis) : 3.5 jours.**

**Route 4 (push email géographique) :** lien dans l’email à concevoir en même temps que SC7. Le lien doit pointer vers `/appel-offres?centreId={id}` avec un token de pré-remplissage pour que l’hébergeur soit redirigé vers le claim de son centre après inscription.

**Route 6 — Invitation admin avec pré-création centre (1.5j) — à coder avec SC5bis**

Cas d’usage : Théo démarche un hébergeur, veut lui pré-créer son centre et lui envoyer un lien pour qu’il n’ait plus qu’à créer son compte et valider la propriété.

**Modèle `InvitationHebergement` à enrichir :**
Ajouter en migration SQL (nullable pour compatibilité ascendante) :
- `centrePrecreerNom`, `centrePrecreerAdresse`, `centrePrecreerVille`, `centrePrecreerCodePostal`, `centrePrecreerCapacite`, `centrePrecreerSiret`, `centrePrecreerDepartement`
- `centreExistantId` (FK nullable vers `CentreHebergement`) — pour pointer vers un centre déjà en base
- `emailEnvoye` (Boolean, default false) + `emailEnvoyeAt` (DateTime nullable)

**Comportement à `/register/hebergeur?token=XXX` selon le contenu de l’invitation :**
- `centreExistantId` renseigné → rediriger directement vers la page claim du centre existant
- Données `centrePrecreer*` renseignées → formulaire pré-rempli lecture seule, hébergeur définit son mot de passe
- Rien → formulaire vide (comportement actuel)

**Dashboard admin `/dashboard/admin/invitations` à créer :**
- Formulaire : email hébergeur + champs centre (optionnels) + sélection d’un centre existant (dropdown avec StructureSearch)
- Bouton "Envoyer l’invitation" → crée `InvitationHebergement`, envoie l’email avec le lien, marque `emailEnvoye=true`
- Liste des invitations envoyées avec statut (envoyée / utilisée)

**Backend à modifier :**
- `invitation.service.ts create()` : accepter les nouveaux champs, envoyer l’email via `EmailService`
- `centre.service.ts register()` : lire `centreExistantId` et `centrePrecreer*` depuis l’invitation pour pré-remplir ou rattacher

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
- [ ] Inscription signataire via invitation scolaire → établissement pré-rempli, **PAS de saisie UAI**, **PAS de Kbis**, Membership créé automatiquement
- [ ] Inscription signataire via invitation hors-scolaire → `<StructureSearch>` affiché, structure libre, **PAS de Kbis**, Membership créé sur l'orga choisie
- [ ] Inscription signataire sans invitation → fallback recherche UAI actuel
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
- [ ] Séjour `typeContexte=SCOLAIRE` → bouton "Soumettre au rectorat" visible, statut `SOUMIS_RECTORAT` atteignable
- [ ] Séjour `typeContexte=HORS_SCOLAIRE` → bouton "Télécharger le dossier" visible, statut `DECLARE_TAM` atteignable, rectorat masqué
- [ ] Dashboard signataire : séjours visibles par Membership (même Organisation) ET par invitation directe
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
- **typeContexte** : champ sur `Sejour` — `SCOLAIRE` ou `HORS_SCOLAIRE`. Détermine le flow de validation (rectorat vs TAM, UAI vs SIRET, directeur d'école vs signataire libre).
- **TypeContexteSejour** : enum Prisma `SCOLAIRE | HORS_SCOLAIRE`.
- **DECLARE_TAM** : statut `StatutSejour` pour les séjours hors-scolaire déclarés auprès du SDJES.
- **SC4ter** : sous-chantier dédié au flow invitation signataire post-refactor (InvitationDirecteur + Membership automatique + bifurcation frontend).
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

## 12. Journal d'avancement

### Session 03/05/2026 — Audit doc + v3.2

**Lacunes identifiées et documentées (aucun code modifié) :**
- SC4ter créé : flow invitation signataire post-refactor (section 5bis)
- Section 2.7 : appartenance du séjour → l'utilisateur (décision architecturale validée)
- Section 2.8 : `typeContexte` sur `Sejour` + enum `TypeContexteSejour` + statut `DECLARE_TAM`
- Section 3.6 : migration `InvitationDirecteur` + `InvitationCollaboration` (ajout `organisationId`, `typeContexte`)
- Section 3.7 : migration `Rappel` + `ContactClient` → `RelationCommerciale` (ajout `relationId`)
- Checklist section 8 : tests signataire scolaire/hors-scolaire + tests `typeContexte`
- Glossaire mis à jour

**Décision :** ne pas coder SC4ter avant validation de la v3.2 par Théo.

### Session 04/05/2026 — SC4ter complet (3 passes)

**Sous-chantier SC4ter — Flow invitation signataire post-refactor — TERMINÉ, DÉPLOYÉ**

*Passe A — Migrations Prisma (commit d6ea649) :*
- Enum `TypeContexteSejour` (SCOLAIRE/HORS_SCOLAIRE) ajouté au schéma
- Champ `typeContexte` ajouté sur `Sejour` (@default SCOLAIRE — compatibilité ascendante)
- Champs `organisationId` (FK nullable → Organisation, onDelete SetNull) et `typeContexte` (VARCHAR 20) ajoutés sur `InvitationDirecteur`
- Relation inverse `invitationsDirecteur` ajoutée sur `Organisation`
- Migration SQL `20260504_sc4ter_invitation_signataire` créée manuellement et appliquée sur Scalingo via `migrate deploy` au redémarrage
- `prisma generate` + `npm run build` backend : exit 0

*Passe B — Backend services (commit 8ea385c) :*
- `invitations-directeur.service.ts` `findByToken()` : inclut désormais l'organisation (id/nom/uai/ville) et retourne `organisationId`, `typeContexte`, `organisation`
- `sejour.service.ts` `inviterDirecteur()` : résout `getOrganisationPrincipale(userId)` + lit `sejour.typeContexte` avant création de l'invitation ; `organisationId` et `typeContexte` renseignés sur `InvitationDirecteur`
- `register-signataire.dto.ts` : ajout `invitationToken?` et `organisationId?`
- `auth.service.ts` `registerSignataire()` : création Membership automatique (MEMBRE/isPrimary:true/NON_APPLICABLE) si `dto.organisationId` non null ; marquage invitation `utilisedAt` (non bloquant) si `dto.invitationToken`

*Passe C — Frontend (commit 8ea385c) :*
- `register/signataire/page.tsx` : bifurcation complète selon `typeContexte`
  - SCOLAIRE + organisation connue → établissement pré-rempli verrouillé (non modifiable)
  - SCOLAIRE legacy (organisationId null) → comportement actuel conservé (recherche UAI API EN)
  - HORS_SCOLAIRE → `<StructureSearch allowFreeText={true}>` affiché à la place de la recherche UAI
  - `handleSubmit` transmet `invitationToken` + `organisationId` au backend
  - Suppression de l'appel `/utiliser` côté frontend (géré backend)
  - Titre h1 → "Inscription signataire", sous-titre conditionnel
  - Message d'erreur contextuel selon `typeContexte`
- `npm run build` frontend : exit 0, 43 pages générées

**Prochaine étape : SC5 — Refactor frontend dashboards (lecture Organisation via Membership)**

### Session 04/05/2026 — SC5 complet (commit bf328b4)

**Sous-chantier SC5 — Enrichissement getProfile() + consommation dashboards — TERMINÉ, DÉPLOYÉ**

*Fix à la source — pas cosmétique :*
- `users.service.ts` `getProfile()` : enrichi avec `getOrganisationPrincipale()` — retourne désormais `{ ...user, organisation: { id, nom, uai, siren, typeStructure, ville } | null }`. Tout appelant de `/users/me` reçoit automatiquement l'organisation principale sans passer par les champs `etablissement*` legacy.
- `src/types/auth.ts` : interface `OrganisationResume` ajoutée, champ `organisation?: OrganisationResume | null` ajouté à `User`.
- `AuthContext.tsx` : après login, appel non-bloquant `api.get('/users/me')` qui enrichit `user.organisation` en localStorage + state. Pas de blocage du flux de connexion.
- Dashboard organisateur navbar : `{user.organisation?.nom ?? 'Organisateur'}` — affiche le vrai nom de l'établissement depuis `Organisation`, fallback gracieux.
- Dashboard signataire navbar : `{user.organisation?.nom ?? 'Signataire'}` — idem.
- Bouton catalogue organisateur : `"Parcourir les 649 centres"` → `"Parcourir le catalogue"` (chiffre hardcodé supprimé).

*Ce que SC5 débloque pour SC8 :* les dashboards consomment déjà `user.organisation` — quand SC8 supprimera les colonnes `etablissement*` de `User`, aucun dashboard ne cassera.

**Prochaine étape : SC6 ou SC8 selon priorité commerciale**

### Session 04/05/2026 — SC6 complet (3 passes)

**Sous-chantier SC6 — Pages publiques + flow demande sans compte — TERMINÉ, DÉPLOYÉ**

*Passe A — Backend PublicModule + magic link (commits push 1) :*
- Migration SQL `20260504_sc6_magic_link` : 2 champs sur `utilisateurs` (`magic_link_token UUID`, `magic_link_expires TIMESTAMPTZ`)
- `EmailService.sendMagicLink()` ajoutée
- `CentreModule` : `exports: [CentreService]` ajouté
- `CentreService.getPublic(id)` ajoutée (guard UUID + select whitelist)
- `PublicModule` créé avec `PublicController` (3 endpoints) + `PublicService` (flow complet)
- `POST /public/demande` : crée User dormant + Organisation + Membership + Sejour + DemandeDevis en transaction + magic link TTL 7j + 1 email
- `GET /public/centres?search=` : catalogue public (throttle 30/min)
- `GET /public/centres/:id` : fiche centre publique
- `GET /auth/magic/:token` : valide token → active compte → génère JWT → redirige `/auth/callback`
- Anti-doublon : si email existant avec `compteValide=true` → `ConflictException` avec message clair
- Anti-doublon : si email existant avec `compteValide=false` → réutilise le User dormant

*Passe B — Frontend pages publiques (commit push 2) :*
- `src/lib/public.ts` : `searchCentresPublics()`, `getCentrePublic()`, `soumettreDemandePublique()` (fetch direct sans token)
- `app/auth/magic/[token]/page.tsx` : page transitionnelle → redirige vers backend
- `app/auth/callback/page.tsx` : décode JWT, stocke cookie + localStorage, redirige dashboard avec `?onboarding=true`
- `app/catalogue/page.tsx` : catalogue public avec recherche debounced, grille cartes, CTA appel d'offres
- `app/catalogue/[id]/page.tsx` : fiche centre publique, CTA "Envoyer une demande à ce centre" → `/appel-offres?centreId=...`
- `app/appel-offres/page.tsx` : formulaire 2-3 étapes (bifurcation `centreId` query param), contact direct ou appel d'offres géographique, écran de succès
- Build frontend : exit 0, 46 pages générées

*Passe C — Banner onboarding dashboard (commit push 3) :*
- `dashboard/organisateur/page.tsx` : détecte `?onboarding=true`, affiche bandeau bleu "Bienvenue — définissez votre mot de passe" avec CTA → profil section sécurité
- Wrapper `<Suspense>` ajouté pour `useSearchParams()`
- Build frontend : exit 0

**Flow utilisateur complet :**
1. Enseignant arrive sur `/catalogue` ou `/appel-offres` sans compte
2. Remplit formulaire (titre, dates, élèves, coordonnées) — pas de mot de passe
3. Backend crée compte dormant + demande + envoie 1 email avec magic link
4. Enseignant clique le lien → `/auth/magic/[token]` → backend valide → JWT → `/auth/callback` → dashboard avec banner onboarding
5. Hébergeurs reçoivent la demande et peuvent répondre immédiatement
6. Enseignant définit son mot de passe depuis le bandeau → compte pleinement actif

**Corrections UX post-SC6 (même session) :**
- `auth.service.ts` : détection compte dormant dans `login()` → `UnauthorizedException('COMPTE_DORMANT')` si `!compteValide && !emailVerifie` ; nouvelle méthode `renvoyerMagicLink()` (throttle 3/h)
- `auth.controller.ts` : endpoint `POST /auth/renvoyer-magic-link` ajouté
- `public.service.ts` : `centresNotifies` retourné (1 si contact direct, 0 si appel d'offres — honnête, pas de chiffre approximatif)
- `login/page.tsx` : bifurcation `COMPTE_DORMANT` → panneau bleu explicite + bouton "Recevoir un lien d'accès" (utilise `api` axios, pas fetch direct)
- `appel-offres/page.tsx` : affichage conditionnel "Votre demande a été transmise à 1 centre" dans l'écran de succès
- `catalogue/page.tsx` : lien "Inscrire mon centre" dans la nav + bandeau CTA hébergeur avant le footer
- `app/page.tsx` : lien "← Voir le catalogue des centres" ajouté avant "Référencer mon centre" dans le bloc hébergeurs

**Prochaine étape : SC7 — Widget signalement intérêt + notification auto centres APIDAE (dépend validation commerciale LMDJ/IDDJ)**

---

## Backlog — Idées notées, non planifiées

### SC6bis — Notification push centres catalogue EN labellisés

**Contexte :** Le Ministère de l'Éducation Nationale publie un catalogue national des structures d'accueil et d'hébergement labellisées pour les voyages scolaires (`data.education.gouv.fr`, dataset `fr-en-catalogue-structures-accueil-hebergement`). Ce catalogue recense les hébergeurs agréés par les DASEN département par département, renouvelés tous les 3 ans scolaires.

**Problème :** L'API publique de ce dataset n'expose pas les emails — uniquement le site web de chaque structure. Les emails ne sont donc pas directement récupérables via l'API.

**Idée validée :** Récupérer les emails en visitant les sites web de chaque structure (scraping ou enrichissement manuel), les stocker dans une table dédiée (`CentresCatalogueEN`), puis les inclure dans la mécanique de notification SC6 (même pattern rate-limit 7j via `dernierEmailDemandeAt`).

**Valeur :** Ces structures sont pré-qualifiées par l'État pour accueillir des séjours scolaires — c'est exactement la cible hébergeur de LIAVO. L'offre d'essai gratuit du module complet (plan Complet 30 jours) serait le CTA de l'email de notification.

**Ce qu'il faut faire avant de coder :**
1. Télécharger le CSV du catalogue EN et évaluer le volume (nombre de structures, couverture nationale)
2. Évaluer le taux de sites web renseignés dans le dataset
3. Décider de la méthode d'enrichissement email : scraping automatisé (fragile), enrichissement manuel (viable pour quelques centaines), ou prestataire data B2B
4. Valider le cadre légal : l'envoi d'emails prospectifs B2B en France est soumis à l'opt-out (pas d'opt-in requis pour les professionnels) mais nécessite une mention de désinscription — vérifier avec juriste
5. Valider la mécanique "essai gratuit Complet 30 jours" dans le schéma abonnement (nouveau statut `TRIALING` + date d'expiration + conversion automatique)

**Dépendances :** SC6 validé commercialement (LMDJ ou IDDJ) + enrichissement email dataset EN réalisé.

**Ne pas coder avant :** validation commerciale + enrichissement email + avis juridique opt-out B2B.

### Session 04/05/2026 — SC8 complet (3 passes)

**Sous-chantier SC8 — Suppression colonnes legacy etablissement* sur User — TERMINÉ, À DÉPLOYER**

**Contexte :** Sans utilisateurs réels (seul compte prod = Sauvageon / Théo), la période d'attente de stabilité est remplacée par un audit exhaustif du code. L'audit a confirmé 7 fichiers backend + 2 fichiers frontend utilisant encore les champs legacy. Tous corrigés à la source, 0 patch.

**Décision de positionnement validée :** LIAVO = couche post-mise-en-relation. L'hébergeur invite l'enseignant. LIAVO n'est pas un remplacement de la centrale LMDJ — c'est la plateforme de coordination une fois la mise en relation faite. Pitch adapté : "La plateforme développée par les hébergeurs, pour les hébergeurs."

*Passe A — Migration SQL :*
- `backend/prisma/schema.prisma` : 7 champs supprimés sur model User (`etablissementUai`, `etablissementNom`, `etablissementAdresse`, `etablissementVille`, `etablissementEmail`, `etablissementTelephone`, `typeStructure`). Conservés : `emailRectorat`, `reseauNom`, `reseauNomComplet`.
- Migration `backend/prisma/migrations/20260504_sc8_drop_etablissement_columns/migration.sql` créée : `ALTER TABLE utilisateurs DROP COLUMN IF EXISTS` sur les 7 colonnes.
- `npx prisma generate` : exit 0.

*Passe B — Backend : auth.service.ts, users.service.ts, users.controller.ts, public.service.ts (0 erreur) :*
- `auth.service.ts` `registerOrganisateur()` : suppression writes legacy + ajout `findOrCreateOrganisation()` + `findOrCreateMembership()` après inscription.
- `auth.service.ts` `registerSignataire()` : suppression writes legacy (Membership déjà géré via `dto.organisationId`).
- `users.service.ts` `getProfile()` : suppression champs legacy du select.
- `users.service.ts` : suppression méthode `updateEtablissement()` entière.
- `users.controller.ts` : suppression endpoint `PATCH mon-etablissement`.
- `public.service.ts` : suppression writes legacy dans `user.create()`.

*Passe C — Backend (9 fichiers) + Frontend (2 fichiers) — 0 erreur TypeScript :*
- `jwt.strategy.ts` : `etablissementUai` retiré du select.
- `admin.service.ts` : `etablissementNom` retiré de `getUtilisateurs()`.
- `hebergement.service.ts` : `getOrganisationPrincipale(enseignantId)` → `nomEtablissement`.
- `accompagnateur.service.ts` : `orgaCreateur` dans `getByToken()` et `getOrdreMissionHtml()` — PDF ordre de mission lit depuis Organisation.
- `invitation-collaboration.service.ts` : bloc pré-remplissage `etablissementUai` sur User supprimé.
- `demande.service.ts` : `getComparatif()` — enseignant et createur sans champs `etablissement*`.
- `collaboration.service.ts` : `orgaCreateur` retourné dans `getBudgetData()`.
- `sejour.service.ts` : `findByEtablissement()` réécrit (Organisation → Memberships → userIds) avec `memberships[0].organisation` dans le select createur. `getSejourDetail()`, `getDossierPedagogique()`, `soumettreAuRectorat()`, `soumettreAuDirecteur()`, `inviterDirecteur()`, `update()` tous migrés vers `getOrganisationPrincipale()`. Dossier rectorat HTML lit depuis `orgaCreateur`.
- `devis.service.ts` : `getMesDevis()` inclut `createur.memberships[0].organisation`. `getDevisById()`, `getDemandeInfo()`, `getDevisForDemande()`, `getFacturesAcompte()`, `signerDevis()` sans champs `etablissement*`. `updateStatut()` `autoRattacher` via `getOrganisationPrincipale()`. `getChorusXml()` createur réduit à `{id}` puis `orgaCreateur` lu dans le XML PEPPOL.
- `frontend/signataire/page.tsx` : `sejour.createur?.etablissementNom` → `sejour.createur?.memberships?.[0]?.organisation?.nom`.
- `frontend/hebergeur/devis/page.tsx` : `getEtablissementDisplay()` et `matchesSearch()` lisent `memberships?.[0]?.organisation?.nom`.

**Bugs cascade anticipés et corrigés dans le prompt avant exécution :**
1. `getMesDevis()` : au lieu de supprimer `etablissementNom` et mettre un TODO, le select inclut `createur.memberships[0].organisation` — 1 seul appel SQL, pas de boucle N+1.
2. Dashboard signataire `findByEtablissement()` : nouveau select inclut `memberships[0].organisation` pour éviter affichage vide côté frontend.
3. `getBudgetData()` : `orgaCreateur` récupéré depuis `sejour.createur.id` (déjà disponible dans le select), pas via double requête SQL.

**État post-SC8 :**
- Build backend : exit 0, 0 erreur TypeScript
- Build frontend : exit 0
- Migration SQL prête à appliquer via `npx prisma migrate deploy` au redémarrage Scalingo
- **À faire : commit + push main → déploiement Scalingo automatique**

**État au 04/05/2026 — fin de session**

| SC | Statut | Détail |
|---|---|---|
| SC0 | ✅ | Scalingo Paris, OVH Gravelines, Brevo FR |
| SC1 | ✅ | Schéma, backfill BDD, doublons nettoyés |
| SC1bis | ✅ | findOrCreateOrganisation, helpers |
| SC2 | ✅ | GET /organisations/search |
| SC3 | ✅ | StructureSearch.tsx |
| SC4 | ✅ | Rôles français, passe A+B |
| SC4bis | ✅ | claim.service.ts, page admin claims |
| SC4ter | ⚠️ PARTIEL | InvitationDirecteur enrichie ✅ — getAllSejoursSignataire() via Membership ❌ |
| SC5 | ✅ | Dashboards, routes françaises |
| SC5bis | 🔄 EN COURS | Corrections A+B+C+Route6+frontend ✅ — /centre/[id]/claim ❌ |
| SC6 | ✅ | /appel-offres, magic link |
| SC7 | ⏸ SUSPENDU | Validation commerciale |
| SC8 | ✅ | Colonnes etablissement* supprimées |
| SC9 | ❌ À FAIRE | Après SC4ter |

**Ordre prochains chantiers :** SC5bis claim → SC4ter signataire → SC9 StatutDevis → CRM legacy → HORS_SCOLAIRE → DECLARE_TAM

---

*Document à maintenir à jour. Toute déviation documentée ici avec date et raison.*

> **SC9 ajouté au glossaire de la section 11 :** `SC9` = refactor `StatutDevis`. `SIGNE_DIRECTION`, `FACTURE_ACOMPTE`, `FACTURE_SOLDE` = 3 nouvelles valeurs enum cibles.

**SC8 déployé en production :**
- Vérification préalable : 3 lignes avec `etablissement_nom` non-null en prod (directeur@test.fr, enseignant@test.fr, maeva.loison@gmail.com). Maeva (compte test Théo) supprimée. Les 2 comptes test conservés.
- JWT_SECRET changé sur Scalingo avant le push (secret aléatoire 64 hex)
- Commit + push main → déploiement Scalingo automatique
- Migration SQL appliquée via Procfile (`prisma migrate deploy` au démarrage)
- Vérification post-déploiement : 0 colonnes `etablissement%` sur `utilisateurs` ✅
- Test fonctionnel : dashboard hébergeur (resa@lesauvageon.com) opérationnel, établissement affiché depuis Organisation ✅

**SC9 (StatutDevis) identifié et documenté :**
- Bug constaté : badge « Sélectionné » affiché sur un devis signé dans l’onglet « Signé direction »
- Diagnostic : cause racine = `SELECTIONNE` couvre 5 états du cycle de vie différents
- Décision : fix à la source (extension enum `StatutDevis` + backfill), pas de patch conditionnel
- Documenté en section 5ter. À faire AVANT la visio LMDJ (règle : aucune visio tant que le refactor complet n’est pas finalisé).
- Estimé : 1 jour

---

### Session 01/05/2026 — Sous-chantiers 3 et 4 (partiels)

**Sous-chantier 3 — Composant `<StructureSearch>` — TERMINÉ**
- Fichier créé : `frontend/app/components/StructureSearch.tsx`
- Debounce 300ms, AbortController, navigation clavier, badge source, fallback freeText
- Confirmation manuelle obligatoire (highlight=-1 par défaut, pas de pré-sélection)
- Props : `onSelect`, `placeholder`, `disabled`, `allowFreeText`, `defaultSearchValue`, `label`
- Type-check OK. Pas encore intégré dans les formulaires (sera fait au SC5).

**Sous-chantier 4 — Refactor backend services — PASSE A TERMINÉE, PASSE B DÉCISION ARCHITECTURALE**

*Passe A (terminée, déployée en prod) :*
- `auth.controller.ts` : 3 routes POST renommées (`register/teacher` → `register/organisateur`, `register/venue` → `register/hebergeur`, `register/director` → `register/signataire`)
- `admin.service.ts` : 3 URLs emails corrigées (`/dashboard/teacher` → `/dashboard/organisateur`, `/register/venue?token=` → `/register/hebergeur?token=` ×2)
- `sejour.service.ts` : 4 URLs emails corrigées (`/dashboard/director` → `/dashboard/signataire` ×2, `/register/director?` → `/register/signataire?`, `/dashboard/venue` → `/dashboard/hebergeur`)
- Build exit 0, pushé sur main.

*Passe B — Migration `etablissement*` → `Organisation` dans les selects Prisma :*
- **DÉCISION : ne pas faire maintenant.** Les champs `etablissementNom`, `etablissementUai`, etc. sont encore lus directement sur `User` par les dashboards frontend (signataire, organisateur, dossier rectorat HTML, PDF). Migrer les selects Prisma maintenant casserait tous ces affichages.
- **Règle** : la migration des selects se fera AU SOUS-CHANTIER 8 (suppression champs legacy User), après que le SC5 (refactor frontend dashboards) ait adapté les composants pour lire depuis `Organisation` via `Membership`.
- **Ce qui a été fait à la place** : helper `getOrganisationPrincipale()` ajouté dans `backend/src/organisations/organisation.helpers.ts` (Passe B du SC4 — voir ci-dessous).

*Passe B (terminée) :*
- Helper `getOrganisationPrincipale(userId, prisma)` créé dans `organisation.helpers.ts`
- Retourne l'Organisation avec `isPrimary=true` pour un User donné, ou null
- Pas encore appelé par les controllers — prépare le terrain pour SC5 et SC8

**Prochaine étape : Sous-chantier 5 — Refactor frontend dashboards + routes françaises**
- Intégrer `<StructureSearch>` dans les formulaires d'inscription
- Adapter les dashboards pour lire Organisation primary (via le nouveau helper)
- Routes : redirects 301 restants à vérifier côté frontend
- NE PAS supprimer les champs `etablissement*` du User avant SC8

---

*Document à maintenir à jour. Toute déviation documentée ici avec date et raison.*

> **SC9 ajouté au glossaire de la section 11 :** `SC9` = refactor `StatutDevis`. `SIGNE_DIRECTION`, `FACTURE_ACOMPTE`, `FACTURE_SOLDE` = 3 nouvelles valeurs enum cibles.
