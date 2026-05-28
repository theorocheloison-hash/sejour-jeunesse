# LIAVO — Architecture "Séjour en gestion directe"

> **Rédigé le 28 mai 2026** — Document de cadrage pour le chantier d'unification Séjour/DevisLibre.
> **Statut** — Architecture validée par Théo. Aucune ligne de code modifiée.
> **Référence** — Ce document est la source de vérité pour tous les prompts CC du chantier.

---

## 0. Résumé exécutif

L'hébergeur peut créer un séjour directement depuis son planning, émettre un devis structuré, l'envoyer par email pour signature, organiser les activités et facturer — le tout sans que le client ait besoin d'un compte LIAVO. L'invitation à collaborer est un upgrade, pas un prérequis.

Le modèle `DevisLibre` est supprimé. Tous les événements (mariages, séminaires) deviennent des `Sejour` de nature `EVENEMENT` en mode `DIRECT`.

---

## 1. Modèle mental unifié

### 1.1 Deux modes de gestion

| Mode | Qui crée le séjour | Client a un compte ? | Espace collaboratif |
|---|---|---|---|
| **COLLABORATIF** | Organisateur (via demande) OU Hébergeur (via invitation) | Oui (obligatoire) | Complet (messages, journal, docs partagés) |
| **DIRECT** | Hébergeur seul | Non (optionnel) | Désactivé (CTA "Inviter pour échanger") |

Transition possible : DIRECT → COLLABORATIF quand l'hébergeur invite l'organisateur et que celui-ci crée un compte.

### 1.2 Deux natures de séjour

| Nature | Usage | Participants individuels | Groupes | Autorisations parentales |
|---|---|---|---|---|
| **SEJOUR** | Séjour collectif (scolaire, colo, camp) | Oui | Oui | Oui |
| **EVENEMENT** | Événement ponctuel (mariage, séminaire) | Non (juste nb personnes) | Non | Non |

### 1.3 Sous-types

**Pour SEJOUR :**
- `CLASSE_DECOUVERTE`
- `COLONIE_VACANCES`
- `CAMP_SPORTIF`
- `SEJOUR_LINGUISTIQUE`
- `AUTRE_SEJOUR`

**Pour EVENEMENT :**
- `MARIAGE`
- `ANNIVERSAIRE`
- `SEMINAIRE`
- `TEAM_BUILDING`
- `REUNION_FAMILLE`
- `AUTRE_EVENEMENT`

> Les sous-types sont des constantes applicatives (String), pas des enums Prisma, pour éviter une migration à chaque ajout.

---

## 2. Modifications schema Prisma

### 2.1 Enum StatutSejour — ajout OPTION

```prisma
enum StatutSejour {
  DRAFT
  OPTION          // ← NOUVEAU — hébergeur a bloqué les dates, devis en cours
  SUBMITTED
  APPROVED
  REJECTED
  CONVENTION
  SOUMIS_RECTORAT
  SIGNE_DIRECTION
  DECLARE_TAM
}
```

Migration SQL :
```sql
ALTER TYPE "StatutSejour" ADD VALUE 'OPTION' AFTER 'DRAFT';
```

### 2.2 Nouveaux champs sur Sejour

```prisma
model Sejour {
  // ... champs existants inchangés ...

  // ── Gestion directe ──
  modeGestion       String    @default("COLLABORATIF") @map("mode_gestion") @db.VarChar(20)
  natureSejour      String    @default("SEJOUR") @map("nature_sejour") @db.VarChar(20)
  typeSejour        String?   @map("type_sejour") @db.VarChar(30)

  // Coordonnées client (mode DIRECT — pas de createurId)
  clientNom         String?   @map("client_nom") @db.VarChar(255)
  clientPrenom      String?   @map("client_prenom") @db.VarChar(255)
  clientEmail       String?   @map("client_email") @db.VarChar(255)
  clientTelephone   String?   @map("client_telephone") @db.VarChar(30)
  clientOrganisation String?  @map("client_organisation") @db.VarChar(255)
  clientOrganisationId String? @map("client_organisation_id") @db.Uuid

  // Soft delete
  deletedAt         DateTime? @map("deleted_at")
}
```

Migration SQL :
```sql
ALTER TABLE sejours ADD COLUMN mode_gestion VARCHAR(20) NOT NULL DEFAULT 'COLLABORATIF';
ALTER TABLE sejours ADD COLUMN nature_sejour VARCHAR(20) NOT NULL DEFAULT 'SEJOUR';
ALTER TABLE sejours ADD COLUMN type_sejour VARCHAR(30);
ALTER TABLE sejours ADD COLUMN client_nom VARCHAR(255);
ALTER TABLE sejours ADD COLUMN client_prenom VARCHAR(255);
ALTER TABLE sejours ADD COLUMN client_email VARCHAR(255);
ALTER TABLE sejours ADD COLUMN client_telephone VARCHAR(30);
ALTER TABLE sejours ADD COLUMN client_organisation VARCHAR(255);
ALTER TABLE sejours ADD COLUMN client_organisation_id UUID;
ALTER TABLE sejours ADD COLUMN deleted_at TIMESTAMPTZ;

-- Index pour soft delete (toutes les queries doivent filtrer)
CREATE INDEX idx_sejours_deleted_at ON sejours (deleted_at) WHERE deleted_at IS NULL;
```

### 2.3 Devis — demandeId nullable + sejourId ajouté + tokenSignature

```prisma
model Devis {
  // demandeId devient nullable
  demandeId             String?      @map("demande_id") @db.Uuid

  // Lien direct Sejour (mode DIRECT, pas de DemandeDevis)
  sejourId              String?      @map("sejour_direct_id") @db.Uuid
  sejourDirect          Sejour?      @relation("DevisDirectSejour", fields: [sejourId], references: [id], onDelete: Cascade)

  // Signature par lien public (même mécanisme que DevisLibre)
  tokenSignature        String?      @unique @default(uuid()) @map("token_signature") @db.Uuid

  // ... reste inchangé ...
}
```

> ⚠ Contrainte applicative : un Devis a SOIT demandeId (flux collaboratif), SOIT sejourId (flux direct). Jamais les deux null, jamais les deux remplis.

Migration SQL :
```sql
-- demandeId nullable
ALTER TABLE devis ALTER COLUMN demande_id DROP NOT NULL;

-- Nouvelle colonne lien direct séjour
ALTER TABLE devis ADD COLUMN sejour_direct_id UUID REFERENCES sejours(id) ON DELETE CASCADE;
CREATE INDEX idx_devis_sejour_direct ON devis (sejour_direct_id) WHERE sejour_direct_id IS NOT NULL;

-- Token signature
ALTER TABLE devis ADD COLUMN token_signature UUID UNIQUE DEFAULT gen_random_uuid();
-- Backfill les devis existants
UPDATE devis SET token_signature = gen_random_uuid() WHERE token_signature IS NULL;
```

### 2.4 Relation Prisma ajoutée sur Sejour

```prisma
model Sejour {
  // ... relations existantes ...
  devisDirect          Devis[]      @relation("DevisDirectSejour")
}
```

### 2.5 Backfill données existantes

```sql
-- Tous les séjours existants sont COLLABORATIF par défaut
-- typeContexte → natureSejour mapping
UPDATE sejours SET nature_sejour = 'SEJOUR' WHERE type_contexte = 'SCOLAIRE';
UPDATE sejours SET nature_sejour = 'SEJOUR' WHERE type_contexte = 'HORS_SCOLAIRE';
-- On garde SEJOUR pour tout — la distinction EVENEMENT n'existe que via typeSejour
```

---

## 3. Chaîne complète — Du clic planning à la facturation

### 3.1 Création séjour DIRECT depuis le planning

**Frontend — Modale enrichie :**

L'hébergeur clique sur une date du planning. La modale actuelle (2 boutons : "Créer un événement" / "Marquer indisponible") est remplacée par :

```
┌─────────────────────────────────────────┐
│  Que souhaitez-vous faire ?             │
│                                         │
│  [📋 Nouveau séjour]                    │
│  [🎉 Nouvel événement]                  │
│  [🚫 Marquer indisponible]              │
└─────────────────────────────────────────┘
```

Clic "Nouveau séjour" ou "Nouvel événement" → formulaire en modale ou redirection vers page dédiée :

```
┌─────────────────────────────────────────┐
│  Nouveau séjour                         │
│                                         │
│  Type : [Classe de découverte ▾]        │
│  Titre : [____________________________] │
│  Dates : [pré-rempli] → [pré-rempli]   │
│  Nb participants : [__]                 │
│                                         │
│  ── Structure organisatrice ──          │
│  [🔍 Rechercher (SIRENE / Éducation    │
│   Nationale / base LIAVO)]             │
│  → Auto-remplit : nom, adresse,        │
│    SIRET/UAI, ville                     │
│                                         │
│  Email du contact : [_________________] │
│  Nom du contact : [___________________] │
│  Téléphone : [________________________] │
│                                         │
│  [Créer le séjour]                      │
└─────────────────────────────────────────┘
```

> Le composant StructureSearch existant (inviter-enseignant/page.tsx) est réutilisé. Il interroge API EN, SIRENE, et base LIAVO en parallèle.

**Backend — Endpoint `POST /sejours/direct` :**

```
@Post('direct')
@Roles(Role.HEBERGEUR)
createDirect(dto: CreateSejourDirectDto, user: JwtUser, centreId: string | null)
```

DTO :
```typescript
class CreateSejourDirectDto {
  @IsString() titre: string;
  @IsString() natureSejour: string;   // "SEJOUR" | "EVENEMENT"
  @IsOptional() @IsString() typeSejour?: string;
  @IsString() dateDebut: string;
  @IsString() dateFin: string;
  @IsNumber() nombreParticipants: number;
  @IsOptional() @IsString() clientNom?: string;
  @IsOptional() @IsString() clientPrenom?: string;
  @IsOptional() @IsString() clientEmail?: string;
  @IsOptional() @IsString() clientTelephone?: string;
  @IsOptional() @IsString() clientOrganisation?: string;
  @IsOptional() @IsString() clientOrganisationId?: string;  // UUID Organisation si trouvée
  @IsOptional() @IsString() description?: string;
}
```

Logique service :
```
1. getCentreForUser(userId, centreId)
2. Créer Sejour :
   - modeGestion = "DIRECT"
   - natureSejour = dto.natureSejour
   - typeSejour = dto.typeSejour
   - statut = OPTION
   - createurId = null
   - hebergementSelectionneId = centre.id
   - lieu = centre.ville
   - placesTotales = dto.nombreParticipants
   - placesRestantes = dto.nombreParticipants
   - clientNom/Prenom/Email/Telephone/Organisation = dto.*
   - clientOrganisationId = dto.clientOrganisationId (si fourni)
3. Si clientEmail fourni → chercher Client CRM existant :
   - Par (email + centreId) ou (organisationId + centreId)
   - Si trouvé → créer SejourClient
   - Si pas trouvé → créer Client (statut EN_NEGOCIATION) + SejourClient
   - Créer ActiviteClient (type NOTE, "Séjour {titre} créé")
4. Retourner le séjour créé
```

### 3.2 Affichage planning — 3 couleurs + événements

**Sources de données (loadData dans planning/page.tsx) :**

Aujourd'hui : 3 appels parallèles (séjours convention + dispos + devis libres).

Nouveau : 3 appels parallèles (séjours TOUS STATUTS du centre + dispos + rien). Plus de devis libres — tout est dans Sejour.

**Nouvel endpoint `GET /collaboration/mes-sejours-planning` :**

Retourne les séjours du centre avec statuts : `OPTION`, `CONVENTION`, `SIGNE_DIRECTION`. Inclut les infos nécessaires à l'affichage planning (dates, titre, statut, natureSejour, clientNom, planningActivites).

> Séparer de `getMesSejoursConvention` (qui reste inchangé pour l'espace collaboratif) pour ne pas casser le contrat existant.

**Couleurs au planning :**

| Statut | natureSejour | Style | Couleur |
|---|---|---|---|
| OPTION | SEJOUR | Hachures | Orange `#F59E0B` |
| OPTION | EVENEMENT | Hachures | Violet `#7B3FA0` |
| CONVENTION | SEJOUR | Plein | Palette existante (8 couleurs) |
| CONVENTION | EVENEMENT | Plein | Vert `#16A34A` |
| SIGNE_DIRECTION | * | Plein + badge | Palette + icône ✓ |
| Indisponibilité | — | Hachures rouges | Rouge (existant) |

### 3.3 Création devis sur séjour DIRECT

**Adaptation `CreateDevisDto` :**

```typescript
class CreateDevisDto {
  @IsOptional() @IsUUID() demandeId?: string;    // ← était @IsUUID() required
  @IsOptional() @IsUUID() sejourDirectId?: string; // ← NOUVEAU
  // ... reste identique ...
}
```

> Contrainte applicative : exactement un des deux doit être fourni.

**Adaptation `DevisService.create()` :**

```
SI dto.demandeId fourni :
  → Flux existant inchangé (vérif demande OUVERTE, etc.)
SI dto.sejourDirectId fourni :
  → Vérifier sejour.modeGestion === 'DIRECT'
  → Vérifier sejour.hebergementSelectionneId === centre.id
  → Vérifier pas de devis actif existant sur ce séjour
  → Créer le devis avec sejourId = dto.sejourDirectId, demandeId = null
```

### 3.4 Envoi devis par email avec signature publique

**Backend — Endpoint `POST /devis/:id/envoyer` :**

```
@Post(':id/envoyer')
@Roles(Role.HEBERGEUR)
envoyerDevis(id: string, user: JwtUser, centreId: string | null, body: { pjPlanningActivites?: boolean })
```

Logique :
```
1. Charger devis + centre + sejour
2. Vérifier devis.centreId appartient à l'hébergeur
3. Vérifier sejour.modeGestion === 'DIRECT'
4. Vérifier sejour.clientEmail existe (sinon erreur "Email client requis")
5. Générer tokenSignature si pas encore set
6. Passer devis.statut → EN_ATTENTE (si BROUILLON)
7. Envoyer email Brevo :
   - Destinataire : sejour.clientEmail
   - Sujet : "Devis {numeroDevis} — {centre.nom}"
   - Corps : résumé + lien /devis/signer/{token}
   - PJ : brochure centre (si brochureUrl existe)
   - PJ optionnelle : PlanningPDF (si pjPlanningActivites = true et planningActivites non vide)
8. Créer ActiviteClient (type DEVIS, "Devis {numero} envoyé — {montantTTC}€")
```

### 3.5 Page publique signature — `/devis/signer/[token]`

**Backend — Endpoints publics (pas de JWT) :**

```
GET  /devis/public/:token      → retourne devis + centre + sejour (données publiques)
POST /devis/public/:token/signer → signature client direct
POST /devis/public/:token/envoyer-direction → crée InvitationDirecteur
POST /devis/public/:token/upload-signature → upload scan signé
```

**Page frontend — 3 options de signature :**

1. **Signer soi-même** : nom + fonction + checkbox "J'accepte" → `POST /signer`
   - Le devis passe EN_ATTENTE → SELECTIONNE
   - Le séjour passe OPTION → CONVENTION
   - Email confirmation au client + email notification à l'hébergeur
   - ActiviteClient (type SIGNATURE)

2. **Faire signer la direction** : email du signataire → `POST /envoyer-direction`
   - Crée InvitationDirecteur (même modèle existant)
   - Le directeur reçoit l'email, signe sur `/invitation-direction/[token]`
   - Pas de création de compte obligatoire. CTA "Créer un compte" post-signature, non bloquant
   - Signature direction → devis SIGNE_DIRECTION, séjour SIGNE_DIRECTION

3. **Upload document signé** : drag & drop PDF → `POST /upload-signature`
   - Le PDF est stocké dans OVH Object Storage
   - Le devis.signatureDocumentUrl est set
   - Le devis passe SELECTIONNE, le séjour passe CONVENTION

**Documents joints affichés sur la page :**
- Brochure du centre (si brochureUrl)
- Documents centre (agréments, assurances)
- PlanningPDF (si généré et attaché à l'envoi)

### 3.6 Gestion interne hébergeur

Après signature, le séjour est en CONVENTION. L'hébergeur accède à `/dashboard/sejour/[id]` avec les onglets :

| Onglet | SEJOUR (nature) | EVENEMENT (nature) | Mode DIRECT | Mode COLLAB |
|---|---|---|---|---|
| Infos | ✅ | ✅ | Client depuis champs séjour | Organisateur depuis User |
| Devis/Facturation | ✅ | ✅ | ✅ | ✅ |
| Planning/Programme | ✅ "Planning d'activités" | ✅ "Programme" | ✅ (hébergeur seul) | ✅ (partagé) |
| Participants | ✅ | ❌ (masqué) | ✅ | ✅ |
| Documents | ✅ | ✅ | ✅ (hébergeur seul) | ✅ (partagé) |
| Groupes | ✅ | ❌ (masqué) | ✅ | ✅ |
| Messages | ✅ | ✅ | 🔒 Grisé "Inviter pour échanger" | ✅ |
| Journal | ✅ | ✅ (optionnel) | 🔒 Grisé "Inviter pour publier" | ✅ |

### 3.7 Upgrade DIRECT → COLLABORATIF

Bouton "Inviter l'organisateur à collaborer" visible en haut de page quand `modeGestion = DIRECT`.

Action :
1. Vérifie plan abonnement ≥ COMPLET (sinon CTA upgrade)
2. Envoie InvitationCollaboration (même flux existant)
3. L'organisateur accepte → crée un compte → devient createurId
4. `modeGestion` passe de DIRECT à COLLABORATIF
5. Onglets Messages/Journal se déverrouillent

### 3.8 Auto-log CRM

Chaque action sur un séjour DIRECT crée une ActiviteClient automatiquement :

| Événement | Type | Description |
|---|---|---|
| Séjour créé | `NOTE` | "Séjour {titre} créé — {dates}" |
| Devis envoyé | `DEVIS` | "Devis {numero} envoyé — {montantTTC}€" |
| Devis signé (client) | `SIGNATURE` | "Devis signé par {nom}" |
| Devis signé (direction) | `SIGNATURE` | "Devis signé par {nom} (direction)" |
| Acompte reçu | `VERSEMENT` | "Acompte {montant}€ reçu" |
| Facture solde | `VERSEMENT` | "Solde {montant}€ facturé" |
| Séjour supprimé | `NOTE` | "Séjour {titre} annulé" |

---

## 4. Migration DevisLibre → Séjour DIRECT

### 4.1 Script de migration

Pour chaque `DevisLibre` en base :

```sql
-- 1. Créer le Séjour DIRECT
INSERT INTO sejours (
  id, titre, lieu, date_debut, date_fin, places_totales, places_restantes,
  statut, mode_gestion, nature_sejour, type_sejour,
  hebergement_selectionne_id,
  client_nom, client_prenom, client_email, client_telephone,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  COALESCE(dl.type_evenement, 'Événement'),
  c.ville,
  dl.date_debut,
  dl.date_fin,
  0,  -- pas de places pour événement
  0,
  CASE
    WHEN dl.statut = 'BROUILLON' THEN 'OPTION'
    WHEN dl.statut = 'ENVOYE' THEN 'OPTION'
    WHEN dl.statut IN ('ACCEPTE', 'PAYE') THEN 'CONVENTION'
    WHEN dl.statut = 'REFUSE' THEN 'REJECTED'
  END :: "StatutSejour",
  'DIRECT',
  'EVENEMENT',
  CASE
    WHEN dl.type_evenement ILIKE '%mariage%' THEN 'MARIAGE'
    WHEN dl.type_evenement ILIKE '%séminaire%' OR dl.type_evenement ILIKE '%seminaire%' THEN 'SEMINAIRE'
    WHEN dl.type_evenement ILIKE '%anniversaire%' THEN 'ANNIVERSAIRE'
    WHEN dl.type_evenement ILIKE '%team%building%' THEN 'TEAM_BUILDING'
    ELSE 'AUTRE_EVENEMENT'
  END,
  dl.centre_id,
  dl.nom_client, dl.prenom_client, dl.email_client, dl.tel_client,
  dl.created_at, dl.updated_at
FROM devis_libres dl
JOIN centres_hebergement c ON c.id = dl.centre_id;
```

Puis pour chaque DevisLibre → créer un Devis standard :

```sql
-- 2. Créer le Devis (lié au Sejour via sejour_direct_id)
INSERT INTO devis (
  id, sejour_direct_id, centre_id,
  montant_total, montant_par_eleve, montant_ht, montant_tva, montant_ttc,
  taux_tva, pourcentage_acompte, montant_acompte,
  montant_verse_total, numero_devis, statut,
  conditions_annulation, description,
  token_signature,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  s.id,  -- sejour_direct_id = séjour créé ci-dessus
  dl.centre_id,
  COALESCE(dl.montant_ttc, 0), 0,
  dl.montant_ht, dl.montant_tva, dl.montant_ttc,
  dl.taux_tva, dl.pourcentage_acompte, dl.montant_acompte,
  dl.montant_verse_total, dl.numero_devis,
  CASE
    WHEN dl.statut = 'BROUILLON' THEN 'EN_ATTENTE' :: "StatutDevis"
    WHEN dl.statut = 'ENVOYE' THEN 'EN_ATTENTE' :: "StatutDevis"
    WHEN dl.statut = 'ACCEPTE' THEN 'SELECTIONNE' :: "StatutDevis"
    WHEN dl.statut = 'PAYE' THEN 'FACTURE_SOLDE' :: "StatutDevis"
    WHEN dl.statut = 'REFUSE' THEN 'NON_RETENU' :: "StatutDevis"
  END,
  dl.conditions_annulation, dl.description,
  dl.token_signature,
  dl.created_at, dl.updated_at
FROM devis_libres dl
JOIN sejours s ON s.client_email = dl.email_client
  AND s.date_debut = dl.date_debut
  AND s.mode_gestion = 'DIRECT'
  AND s.hebergement_selectionne_id = dl.centre_id;
```

> ⚠ Le script exact sera affiné lors de l'implémentation. La jointure ci-dessus est simplifiée — en réalité on utilisera une table de mapping temporaire DL.id → Sejour.id.

```sql
-- 3. Migrer les lignes de devis
INSERT INTO lignes_devis (id, devis_id, description, quantite, prix_unitaire, tva, total_ht, total_ttc)
SELECT gen_random_uuid(), d.id, ldl.description, ldl.quantite, ldl.prix_unitaire, ldl.tva, ldl.total_ht, ldl.total_ttc
FROM lignes_devis_libre ldl
JOIN mapping_dl_devis m ON m.devis_libre_id = ldl.devis_libre_id
JOIN devis d ON d.id = m.devis_id;

-- 4. Migrer les versements
INSERT INTO versements_paiement (id, devis_id, montant, date_paiement, reference, created_at)
SELECT gen_random_uuid(), d.id, v.montant, v.date_paiement, v.reference, v.created_at
FROM versements_devis_libre v
JOIN mapping_dl_devis m ON m.devis_libre_id = v.devis_libre_id
JOIN devis d ON d.id = m.devis_id;

-- 5. Redirect tokens (pour les liens de signature existants)
-- Les tokens sont migrés sur Devis.token_signature → les URLs /devis-libre/signer/[token]
-- seront redirigées vers /devis/signer/[token] côté frontend (même token)
```

### 4.2 Nettoyage post-migration

```sql
-- Vérification : tous les DL migrés
SELECT COUNT(*) FROM devis_libres dl
LEFT JOIN mapping_dl_devis m ON m.devis_libre_id = dl.id
WHERE m.devis_libre_id IS NULL;
-- Doit retourner 0

-- Suppression (APRÈS validation complète)
DROP TABLE IF EXISTS lignes_devis_libre CASCADE;
DROP TABLE IF EXISTS versements_devis_libre CASCADE;
DROP TABLE IF EXISTS devis_libres CASCADE;
DROP TABLE IF EXISTS mapping_dl_devis;
```

Backend : supprimer le module `devis-libres/` (controller, service, DTOs, module).
Frontend : supprimer `/dashboard/hebergeur/devis-libres/`, `/devis-libre/signer/`, `lib/devis-libres.ts`.
Redirect : `/devis-libre/signer/[token]` → `/devis/signer/[token]` dans next.config.

---

## 5. Analyse d'impact — Bugs cascade anticipés

### 5.1 verifyAccess() — collaboration.service.ts

**Problème :** La méthode vérifie que le séjour est en `CONVENTION` ou `SIGNE_DIRECTION`. En mode DIRECT, un séjour en `OPTION` n'est pas accessible via cet endpoint. Mais l'hébergeur doit pouvoir gérer le planning et les documents dès la création.

**Fix :** Créer une méthode `verifyAccessHebergeur(sejourId, userId)` qui accepte aussi `OPTION` et ne vérifie que `hebergementSelectionne.userId === userId`. Utiliser `verifyAccess` pour les endpoints collaboratifs (messages, journal), `verifyAccessHebergeur` pour les endpoints hébergeur (planning, documents, participants).

**Risque cascade :** Si on modifie `verifyAccess` directement, les organisateurs pourraient accéder à des séjours OPTION qui ne leur sont pas destinés. → Méthode séparée obligatoire.

### 5.2 getMesSejoursConvention() — collaboration.service.ts

**Problème :** Filtre `statut: { in: ['CONVENTION', 'SIGNE_DIRECTION'] }`. Les séjours OPTION ne sont pas inclus.

**Fix :** Ne PAS modifier cet endpoint (il sert le dashboard collaboratif existant). Créer un NOUVEL endpoint `getMesSejoursPlanning()` qui inclut aussi `OPTION`.

**Risque cascade :** Si on élargit le filtre de `getMesSejoursConvention`, le dashboard hébergeur existant montrerait des séjours OPTION dans la liste des séjours collaboratifs → confusion UX.

### 5.3 DevisService.create() — demandeId required

**Problème :** `CreateDevisDto.demandeId` est `@IsUUID()` required. Le code vérifie `demande.statut === 'OUVERTE'`.

**Fix :** `demandeId` devient `@IsOptional() @IsUUID()`. Ajouter `@IsOptional() @IsUUID() sejourDirectId`. Validation : exactement un des deux doit être fourni. Si `sejourDirectId` → vérifier modeGestion === DIRECT et centre.userId === userId.

**Risque cascade :** Les devis existants ont tous un demandeId. La relation Prisma `Devis.demande` utilise `demandeId` comme FK required. Quand demandeId est null, `devis.demande` sera null → TOUS les includes `demande: { select: ... }` doivent gérer le cas null. Points critiques :
- `devis.service.ts` getMesDevis() : include demande → OK si optional
- `collaboration.service.ts` getBudgetData() : `demande?.devis?.[0]` → déjà optionnel
- PDF generators (DevisPDF) : accèdent à `devis.demande.enseignant` → CRASH si null
- `invitations-directeur.service.ts` findByToken() : `devis.demande.enseignant` → CRASH si null

**Fix PDF :** En mode DIRECT, les données client viennent de `sejour.clientNom/clientEmail` au lieu de `devis.demande.enseignant.memberships[0].organisation`. Le composant PDF doit accepter les deux sources.

### 5.4 Soft delete — WHERE deleted_at IS NULL partout

**Problème :** Chaque query Prisma sur `sejours` doit ajouter `deletedAt: null`. Si on en oublie une, des séjours supprimés apparaissent.

**Fix :** Utiliser le middleware Prisma `$use` pour injecter automatiquement le filtre. OU — plus simple et moins magique — ajouter `deletedAt: null` explicitement dans chaque `where` existant. On choisira au moment du prompt CC.

**Risque cascade :** Les queries de comptage (dashboard KPIs), les queries de liste (séjours hébergeur), les queries de recherche (CRM) doivent TOUTES être auditées.

### 5.5 Planning frontend — remplacement du dataset devisLibres

**Problème :** Le planning charge `getMesDevisLibres()` et affiche les DevisLibres avec des couleurs spécifiques. Après migration, ce dataset n'existe plus.

**Fix :** Remplacer par le nouvel endpoint `getMesSejoursPlanning()` qui retourne séjours OPTION + CONVENTION + SIGNE_DIRECTION. Le code de rendu doit distinguer par `statut` et `natureSejour` au lieu de par type de source (séjour vs devisLibre).

**Risque cascade :** Le combobox de recherche dans le planning filtre séparément séjours et devisLibres. Il devra filtrer par natureSejour (SEJOUR vs EVENEMENT) à la place.

### 5.6 Devis — numérotation

**Problème :** `generateNumeroDevis()` compte les devis du centre pour l'année. `generateNumero()` des DevisLibres compte séparément (DL-YYYY-XXX). Après migration, les DL-XXX coexistent avec les DEV-XXX dans la même table.

**Fix :** Les devis migrés gardent leur numéro DL-XXX. Les nouveaux devis utilisent DEV-XXX. Le `generateNumeroDevis()` existant ne compte que les devis avec `numero_devis LIKE 'DEV-%'` pour ne pas décaler la séquence.

### 5.7 Signature devis — conflit avec le flux collaboratif existant

**Problème :** Le flux collaboratif existant gère la sélection de devis via `updateStatutDevis()` dans le controller (l'organisateur sélectionne un devis). En mode DIRECT, c'est le client externe qui "accepte" le devis via la page publique.

**Fix :** La route publique `/devis/public/:token/signer` est un endpoint SÉPARÉ, sans JWT, qui gère la transition EN_ATTENTE → SELECTIONNE + OPTION → CONVENTION. Il ne touche pas au flux existant de sélection par l'organisateur.

**Risque cascade :** Le `updateStatutDevis()` existant vérifie que l'utilisateur est l'organisateur du séjour. En mode DIRECT, il n'y a pas d'organisateur. → Cet endpoint n'est jamais appelé en mode DIRECT, la signature publique est un chemin séparé.

### 5.8 InvitationDirecteur — devis.demande.enseignant null

**Problème :** `creer()` dans `invitations-directeur.service.ts` vérifie `sejour.createurId === enseignantId`. En mode DIRECT, createurId est null et ce n'est pas un "enseignant" qui envoie.

**Fix :** La création d'InvitationDirecteur en mode DIRECT passe par un endpoint DIFFÉRENT (la page publique `/devis/public/:token/envoyer-direction`), pas par le controller existant qui requiert un JWT ORGANISATEUR. L'endpoint public crée l'InvitationDirecteur avec les données du séjour DIRECT (pas besoin de enseignantId).

---

## 6. Phasage d'implémentation

### Phase 1 — Schema + création séjour DIRECT + planning (4-5j)

**Backend :**
- Migration Prisma (enum OPTION, champs Sejour, Devis nullable demandeId + sejourId + tokenSignature)
- Endpoint `POST /sejours/direct`
- Endpoint `GET /collaboration/mes-sejours-planning` (séjours OPTION + CONVENTION + SIGNE_DIRECTION)
- Endpoint `DELETE /sejours/:id` (soft delete + log CRM)
- Auto-création Client CRM + SejourClient + ActiviteClient

**Frontend :**
- Modale planning enrichie (3 boutons)
- Formulaire création séjour DIRECT (StructureSearch réutilisé)
- Planning : 3 couleurs + remplacement dataset devisLibres

### Phase 2 — Devis unifié + signature publique (3-4j)

**Backend :**
- `DevisService.create()` adapté (demandeId optionnel, sejourId)
- `POST /devis/:id/envoyer` (envoi email + PJ brochure + PJ planning optionnel)
- Endpoints publics `/devis/public/:token/*` (get, signer, envoyer-direction, upload-signature)
- Emails Brevo (confirmation client + notification hébergeur)

**Frontend :**
- Page `/devis/signer/[token]` unifiée (PDF inline + 3 options + PJ)
- Bouton "Envoyer le devis" dans page séjour DIRECT
- Checkbox "Joindre le planning d'activités" à l'envoi

### Phase 3 — Page séjour universelle + CRM auto (2-3j)

**Backend :**
- `verifyAccessHebergeur()` (accepte OPTION)
- Adaptation endpoints planning/participants/documents pour séjours DIRECT
- Auto-log CRM sur toutes les actions

**Frontend :**
- `/dashboard/sejour/[id]` : onglets conditionnels (modeGestion + natureSejour)
- Onglets grisés Messages/Journal avec CTA "Inviter pour échanger"
- Onglet Infos : affiche client (DIRECT) ou organisateur (COLLAB)

### Phase 4 — Upgrade DIRECT → COLLABORATIF + gating (1-2j)

**Backend :**
- `POST /sejours/:id/inviter-organisateur` (vérifie plan ≥ COMPLET)
- À l'acceptation invitation : modeGestion → COLLABORATIF, createurId set

**Frontend :**
- Bouton "Inviter l'organisateur" en haut de page séjour DIRECT
- Gating visuel : si plan < COMPLET, bouton mène vers page upgrade

### Phase 5 — Migration DevisLibres + nettoyage (2-3j)

**Backend :**
- Script migration SQL (cf. section 4)
- Suppression module devis-libres
- Redirect tokens

**Frontend :**
- Suppression pages devis-libres
- Redirect `/devis-libre/signer/[token]` → `/devis/signer/[token]`
- Filtre "Type" dans liste séjours (Tous / Séjour / Événement)

---

## 7. Décisions de référence

| Sujet | Décision | Justification |
|---|---|---|
| Signature direction | Sans compte, CTA non bloquant post-signature | Réduire friction |
| PJ devis | Brochure + docs + planning activités optionnel | Use case Sauvageon |
| Statut nouveau | OPTION (enum Prisma) | Distinct de DRAFT (brouillon organisateur) |
| Annulation | Soft delete (deletedAt), Client CRM conservé | Historique CRM préservé |
| Taxonomie | natureSejour + typeSejour (Strings) | Extensible sans migration |
| Recherche structure | StructureSearch obligatoire (API EN + SIRENE + LIAVO) | CRM fiable, données vérifiées |
| DevisLibre | Migré en phase 5, pas de coexistence long terme | Unification complète |
| Numéros devis | Anciens DL-XXX conservés, nouveaux DEV-XXX | Pas de re-numérotation |
| Planning partagé | Interne hébergeur, pas visible client | Upsell collaboratif |
| Upgrade COLLABORATIF | Gated plan Complet | Levier commercial |
| typeContexte existant | Conservé en base, plus utilisé dans nouveau code | Rétrocompatibilité |

---

## 8. Fichiers impactés (audit pré-implémentation)

### Backend — modifications :
- `prisma/schema.prisma` — enum + champs + relations
- `sejours/sejour.controller.ts` — nouveau endpoint POST /direct, DELETE /:id
- `sejours/sejour.service.ts` — createDirect(), softDelete()
- `devis/devis.service.ts` — create() adapté, envoyerDevis()
- `devis/devis.controller.ts` — envoyerDevis, endpoints publics
- `devis/dto/create-devis.dto.ts` — demandeId optionnel, sejourDirectId
- `collaboration/collaboration.service.ts` — getMesSejoursPlanning(), verifyAccessHebergeur()
- `collaboration/collaboration.controller.ts` — nouveau endpoint planning
- `invitations-directeur/invitations-directeur.service.ts` — adaptation pour mode DIRECT
- `clients/clients.service.ts` — auto-création depuis séjour DIRECT

### Backend — suppression (phase 5) :
- `devis-libres/` (tout le module)

### Frontend — modifications :
- `app/dashboard/hebergeur/planning/page.tsx` — modale + couleurs + dataset
- `app/dashboard/sejour/[id]/page.tsx` — onglets conditionnels
- `src/lib/collaboration.ts` — nouveau type + appel planning
- `src/contexts/AuthContext.tsx` — aucun changement prévu

### Frontend — création :
- `app/devis/signer/[token]/page.tsx` — page publique unifiée

### Frontend — suppression (phase 5) :
- `app/dashboard/hebergeur/devis-libres/` (tout le dossier)
- `app/devis-libre/signer/[token]/page.tsx`
- `src/lib/devis-libres.ts`

---

**Aucun code modifié dans le cadre de ce document.**
