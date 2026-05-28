# PROMPT CC — Phase 1 Partie 1 : Backend migration + endpoints séjour DIRECT

> **Contexte** : On implémente le "séjour en gestion directe" — l'hébergeur crée un séjour depuis son planning sans que le client ait besoin d'un compte LIAVO.
> **Référence architecture** : `docs/ARCHITECTURE_SEJOUR_DIRECT.md`
> **Règle** : Lire chaque fichier AVANT de le modifier. Ne jamais déduire le contenu.

---

## ÉTAPE 1 — Migration Prisma

### 1A. Ajouter `OPTION` à l'enum `StatutSejour` dans `backend/prisma/schema.prisma`

```prisma
enum StatutSejour {
  DRAFT
  OPTION          // ← AJOUTER ICI
  SUBMITTED
  APPROVED
  REJECTED
  CONVENTION
  SOUMIS_RECTORAT
  SIGNE_DIRECTION
  DECLARE_TAM
}
```

### 1B. Ajouter les nouveaux champs sur le modèle `Sejour`

Ajouter ces champs APRÈS le champ `projetEducatif` et AVANT les relations :

```prisma
  // ── Gestion directe (séjour créé par l'hébergeur sans compte organisateur) ──
  modeGestion       String    @default("COLLABORATIF") @map("mode_gestion") @db.VarChar(20)
  natureSejour      String    @default("SEJOUR") @map("nature_sejour") @db.VarChar(20)
  typeSejour        String?   @map("type_sejour") @db.VarChar(30)
  clientNom         String?   @map("client_nom") @db.VarChar(255)
  clientPrenom      String?   @map("client_prenom") @db.VarChar(255)
  clientEmail       String?   @map("client_email") @db.VarChar(255)
  clientTelephone   String?   @map("client_telephone") @db.VarChar(30)
  clientOrganisation String?  @map("client_organisation") @db.VarChar(255)
  clientOrganisationId String? @map("client_organisation_id") @db.Uuid
  deletedAt         DateTime? @map("deleted_at")
```

### 1C. Modifier le modèle `Devis`

1. Rendre `demandeId` nullable : changer `demandeId String @map("demande_id") @db.Uuid` en `demandeId String? @map("demande_id") @db.Uuid`
2. Rendre la relation `demande` nullable : changer `demande DemandeDevis @relation(...)` en `demande DemandeDevis? @relation(...)`
3. Ajouter ces champs APRÈS `demandeId` :

```prisma
  sejourDirectId        String?   @map("sejour_direct_id") @db.Uuid
  tokenSignature        String?   @unique @default(uuid()) @map("token_signature") @db.Uuid
```

4. Ajouter la relation (dans le bloc des relations, après `demande`) :

```prisma
  sejourDirect    Sejour?           @relation("DevisDirectSejour", fields: [sejourDirectId], references: [id], onDelete: Cascade)
```

### 1D. Ajouter la relation inverse sur le modèle `Sejour`

Dans le bloc des relations du modèle Sejour, ajouter :

```prisma
  devisDirect          Devis[]      @relation("DevisDirectSejour")
```

### 1E. Créer le fichier de migration SQL

Créer le dossier et fichier : `backend/prisma/migrations/20260528_sejour_direct/migration.sql`

Contenu :

```sql
-- Enum : ajout OPTION à StatutSejour
ALTER TYPE "StatutSejour" ADD VALUE IF NOT EXISTS 'OPTION' AFTER 'DRAFT';

-- Sejour : nouveaux champs gestion directe
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS mode_gestion VARCHAR(20) NOT NULL DEFAULT 'COLLABORATIF';
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS nature_sejour VARCHAR(20) NOT NULL DEFAULT 'SEJOUR';
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS type_sejour VARCHAR(30);
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS client_nom VARCHAR(255);
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS client_prenom VARCHAR(255);
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS client_email VARCHAR(255);
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS client_telephone VARCHAR(30);
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS client_organisation VARCHAR(255);
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS client_organisation_id UUID;
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index soft delete
CREATE INDEX IF NOT EXISTS idx_sejours_deleted_at ON sejours (deleted_at) WHERE deleted_at IS NULL;
-- Index nature_sejour pour filtrage
CREATE INDEX IF NOT EXISTS idx_sejours_nature ON sejours (nature_sejour);
-- Index mode_gestion
CREATE INDEX IF NOT EXISTS idx_sejours_mode_gestion ON sejours (mode_gestion);

-- Devis : demandeId nullable
ALTER TABLE devis ALTER COLUMN demande_id DROP NOT NULL;

-- Devis : lien direct séjour
ALTER TABLE devis ADD COLUMN IF NOT EXISTS sejour_direct_id UUID REFERENCES sejours(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_devis_sejour_direct ON devis (sejour_direct_id) WHERE sejour_direct_id IS NOT NULL;

-- Devis : token signature
ALTER TABLE devis ADD COLUMN IF NOT EXISTS token_signature UUID UNIQUE DEFAULT gen_random_uuid();
-- Backfill tokens pour devis existants
UPDATE devis SET token_signature = gen_random_uuid() WHERE token_signature IS NULL;
```

### 1F. Vérification post-migration

Après avoir modifié `schema.prisma` et créé le fichier de migration, exécuter :
```bash
cd backend && npx prisma generate
```

Vérifier : 0 erreur. Ne PAS exécuter `prisma migrate dev` (migration appliquée en prod via Scalingo Procfile).

---

## ÉTAPE 2 — DTO création séjour DIRECT

Créer `backend/src/sejours/dto/create-sejour-direct.dto.ts` :

```typescript
import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsEmail,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSejourDirectDto {
  @IsString()
  @MinLength(1)
  titre!: string;

  @IsString()
  natureSejour!: string; // "SEJOUR" | "EVENEMENT"

  @IsOptional()
  @IsString()
  typeSejour?: string; // sous-type (CLASSE_DECOUVERTE, MARIAGE, etc.)

  @IsDateString()
  dateDebut!: string;

  @IsDateString()
  dateFin!: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  nombreParticipants!: number;

  @IsOptional()
  @IsString()
  clientNom?: string;

  @IsOptional()
  @IsString()
  clientPrenom?: string;

  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  clientTelephone?: string;

  @IsOptional()
  @IsString()
  clientOrganisation?: string;

  @IsOptional()
  @IsUUID()
  clientOrganisationId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

---

## ÉTAPE 3 — Service : createDirect() + softDelete()

Dans `backend/src/sejours/sejour.service.ts`, ajouter ces imports en haut si pas déjà présents :

```typescript
import { getCentreForUser } from '../centres/centre.helper.js';
```

Puis ajouter ces deux méthodes dans la classe `SejourService` (NE PAS modifier les méthodes existantes) :

```typescript
  async createDirect(
    dto: CreateSejourDirectDto,
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    // Valider natureSejour
    if (!['SEJOUR', 'EVENEMENT'].includes(dto.natureSejour)) {
      throw new ForbiddenException('natureSejour doit être SEJOUR ou EVENEMENT');
    }

    const sejour = await this.prisma.sejour.create({
      data: {
        titre: dto.titre,
        description: dto.description ?? null,
        lieu: centre.ville,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        placesTotales: dto.nombreParticipants,
        placesRestantes: dto.nombreParticipants,
        statut: 'OPTION',
        modeGestion: 'DIRECT',
        natureSejour: dto.natureSejour,
        typeSejour: dto.typeSejour ?? null,
        createurId: null,
        hebergementSelectionneId: centre.id,
        clientNom: dto.clientNom ?? null,
        clientPrenom: dto.clientPrenom ?? null,
        clientEmail: dto.clientEmail ?? null,
        clientTelephone: dto.clientTelephone ?? null,
        clientOrganisation: dto.clientOrganisation ?? null,
        clientOrganisationId: dto.clientOrganisationId ?? null,
      },
    });

    // Auto-création / rattachement Client CRM
    if (dto.clientEmail || dto.clientNom) {
      try {
        await this.linkSejourToClient(sejour, centre.id);
      } catch (err) {
        console.error('[SEJOUR_DIRECT] Erreur liaison CRM:', err);
        // Non bloquant — le séjour est créé même si le CRM échoue
      }
    }

    return sejour;
  }

  /**
   * Lie un séjour DIRECT à un Client CRM.
   * Cherche par email+centreId, puis par organisationId+centreId, sinon crée le client.
   */
  private async linkSejourToClient(
    sejour: { id: string; clientEmail: string | null; clientNom: string | null; clientOrganisation: string | null; clientOrganisationId: string | null; clientTelephone: string | null; titre: string; dateDebut: Date; dateFin: Date },
    centreId: string,
  ) {
    let client = null;

    // 1. Chercher par email
    if (sejour.clientEmail) {
      client = await this.prisma.client.findFirst({
        where: { centreId, email: sejour.clientEmail },
      });
    }

    // 2. Chercher par organisationId
    if (!client && sejour.clientOrganisationId) {
      client = await this.prisma.client.findFirst({
        where: { centreId, organisationId: sejour.clientOrganisationId },
      });
    }

    // 3. Créer si pas trouvé
    if (!client) {
      client = await this.prisma.client.create({
        data: {
          centreId,
          nom: sejour.clientOrganisation || sejour.clientNom || 'Client inconnu',
          email: sejour.clientEmail ?? undefined,
          telephone: sejour.clientTelephone ?? undefined,
          type: 'ETABLISSEMENT_SCOLAIRE',
          statut: 'EN_NEGOCIATION',
          organisationId: sejour.clientOrganisationId ?? undefined,
        },
      });
    }

    // 4. Créer SejourClient (lien CRM)
    await this.prisma.sejourClient.upsert({
      where: {
        clientId_sejourId: { clientId: client.id, sejourId: sejour.id },
      },
      update: {},
      create: { clientId: client.id, sejourId: sejour.id },
    });

    // 5. Log activité CRM
    const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    await this.prisma.activiteClient.create({
      data: {
        clientId: client.id,
        centreId,
        type: 'NOTE',
        description: `Séjour "${sejour.titre}" créé — ${fmtDate(sejour.dateDebut)} → ${fmtDate(sejour.dateFin)}`,
        metadata: { sejourId: sejour.id },
      },
    });
  }

  async softDeleteSejour(sejourId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: {
        id: true,
        hebergementSelectionneId: true,
        modeGestion: true,
        titre: true,
        deletedAt: true,
        clientEmail: true,
      },
    });

    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.deletedAt) throw new NotFoundException('Séjour déjà supprimé');
    if (sejour.hebergementSelectionneId !== centre.id) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }

    await this.prisma.sejour.update({
      where: { id: sejourId },
      data: { deletedAt: new Date() },
    });

    // Log CRM si client lié
    try {
      const sejourClient = await this.prisma.sejourClient.findFirst({
        where: { sejourId },
        select: { clientId: true },
      });
      if (sejourClient) {
        await this.prisma.activiteClient.create({
          data: {
            clientId: sejourClient.clientId,
            centreId: centre.id,
            type: 'NOTE',
            description: `Séjour "${sejour.titre}" annulé`,
            metadata: { sejourId },
          },
        });
      }
    } catch { /* non bloquant */ }

    return { deleted: true };
  }
```

**IMPORTANT** : L'import de `CreateSejourDirectDto` doit être ajouté en haut du fichier :
```typescript
import { CreateSejourDirectDto } from './dto/create-sejour-direct.dto.js';
```

Vérifier aussi que le modèle `Client` a bien un champ `organisationId` — lire `backend/prisma/schema.prisma` modèle Client avant d'écrire. Si `organisationId` n'existe pas sur Client, remplacer par `undefined`.

---

## ÉTAPE 4 — Controller : routes POST /direct et DELETE /:id

Dans `backend/src/sejours/sejour.controller.ts`, ajouter les imports :

```typescript
import { CreateSejourDirectDto } from './dto/create-sejour-direct.dto.js';
import { CentreId } from '../centres/centre-id.decorator.js';
```

Ajouter ces routes APRÈS la route `@Post('depuis-catalogue')` et AVANT `@Get('me')` (les routes statiques doivent être avant les routes paramétriques) :

```typescript
  /** POST /sejours/direct — Créer un séjour en gestion directe (HEBERGEUR) */
  @Post('direct')
  @Roles(Role.HEBERGEUR)
  createDirect(
    @Body() dto: CreateSejourDirectDto,
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.sejourService.createDirect(dto, user.id, centreId);
  }

  /** DELETE /sejours/:id — Soft delete d'un séjour (HEBERGEUR) */
  @Delete(':id')
  @Roles(Role.HEBERGEUR)
  softDelete(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.sejourService.softDeleteSejour(id, user.id, centreId);
  }
```

**IMPORTANT** : Ajouter `Delete` dans l'import `@nestjs/common` en haut du fichier.

---

## ÉTAPE 5 — Endpoint planning : getMesSejoursPlanning

Dans `backend/src/collaboration/collaboration.service.ts`, ajouter cette méthode (NE PAS modifier getMesSejoursConvention) :

```typescript
  /**
   * Retourne les séjours du centre pour le planning hébergeur.
   * Inclut OPTION (gestion directe), CONVENTION, SIGNE_DIRECTION.
   * Exclut les séjours soft-deleted.
   */
  async getMesSejoursPlanning(userId: string, centreId?: string | null) {
    let centreIds: string[];
    if (centreId) {
      const centre = await this.prisma.centreHebergement.findFirst({
        where: { id: centreId, userId },
        select: { id: true },
      });
      if (!centre) return [];
      centreIds = [centre.id];
    } else {
      const centres = await this.prisma.centreHebergement.findMany({
        where: { userId },
        select: { id: true },
      });
      centreIds = centres.map((c) => c.id);
      if (centreIds.length === 0) return [];
    }

    return this.prisma.sejour.findMany({
      where: {
        statut: { in: ['OPTION', 'CONVENTION', 'SIGNE_DIRECTION'] },
        hebergementSelectionneId: { in: centreIds },
        deletedAt: null,
      },
      select: {
        id: true,
        titre: true,
        lieu: true,
        dateDebut: true,
        dateFin: true,
        placesTotales: true,
        statut: true,
        modeGestion: true,
        natureSejour: true,
        typeSejour: true,
        clientNom: true,
        clientOrganisation: true,
        createur: { select: { prenom: true, nom: true } },
        hebergementSelectionne: { select: { nom: true } },
        planningActivites: {
          orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
        },
      },
      orderBy: { dateDebut: 'asc' },
    });
  }
```

Dans `backend/src/collaboration/collaboration.controller.ts`, ajouter cette route APRÈS `getMesSejoursConvention` et AVANT la route `@Get(':sejourId')` :

```typescript
  @Get('mes-sejours-planning')
  getMesSejoursPlanning(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.service.getMesSejoursPlanning(user.id, centreId);
  }
```

**IMPORTANT** : Vérifier que `CentreId` est bien importé en haut du fichier. S'il n'est pas importé, ajouter :
```typescript
import { CentreId } from '../centres/centre-id.decorator.js';
```

---

## ÉTAPE 6 — Filtre soft delete dans getMesSejoursConvention

Dans `backend/src/collaboration/collaboration.service.ts`, méthode `getMesSejoursConvention`, ajouter `deletedAt: null` dans le `where` du `findMany` final :

```typescript
    return this.prisma.sejour.findMany({
      where: {
        statut: { in: ['CONVENTION', 'SIGNE_DIRECTION'] },
        hebergementSelectionneId: { in: centreIds },
        deletedAt: null,  // ← AJOUTER
      },
      // ... reste inchangé
    });
```

---

## ÉTAPE 7 — Build et vérification

```bash
cd backend
npx prisma generate
npm run build
```

Vérifier : 0 erreur TypeScript. Si des erreurs apparaissent sur le type `StatutSejour` (car l'enum est modifié mais la DB n'a pas la valeur), c'est normal — le build TypeScript ne vérifie pas la DB.

---

## RÉSUMÉ DES FICHIERS MODIFIÉS

| Fichier | Action |
|---|---|
| `backend/prisma/schema.prisma` | Enum OPTION + champs Sejour + Devis nullable + relations |
| `backend/prisma/migrations/20260528_sejour_direct/migration.sql` | Créé |
| `backend/src/sejours/dto/create-sejour-direct.dto.ts` | Créé |
| `backend/src/sejours/sejour.service.ts` | Ajout createDirect() + linkSejourToClient() + softDeleteSejour() |
| `backend/src/sejours/sejour.controller.ts` | Ajout POST /direct + DELETE /:id |
| `backend/src/collaboration/collaboration.service.ts` | Ajout getMesSejoursPlanning() + deletedAt dans getMesSejoursConvention |
| `backend/src/collaboration/collaboration.controller.ts` | Ajout GET /mes-sejours-planning |

## FICHIERS À NE PAS MODIFIER
- `backend/src/devis/devis.service.ts` — sera adapté en Phase 2
- `frontend/**` — sera adapté en Phase 1 Partie 2
- `backend/src/devis-libres/**` — sera supprimé en Phase 5
