-- ============================================================
-- Migration : add_organisations_memberships
-- Sous-chantier 1/3 : Schéma Organisations + Memberships + RelationCommerciale
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enrichissement de l'enum TypeStructure (3 nouvelles valeurs)
-- ------------------------------------------------------------
-- L'enum TypeStructure a été créé par la migration 20260429_add_type_structure_user.
-- On ajoute 3 nouvelles valeurs (idempotent grâce à IF NOT EXISTS).
ALTER TYPE "TypeStructure" ADD VALUE IF NOT EXISTS 'COLLECTIVITE_TERRITORIALE';
ALTER TYPE "TypeStructure" ADD VALUE IF NOT EXISTS 'ENTREPRISE';
ALTER TYPE "TypeStructure" ADD VALUE IF NOT EXISTS 'MICRO_ENTREPRISE';

-- ------------------------------------------------------------
-- 2. Création des nouveaux enums (idempotent)
-- ------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE "SourceOrganisation" AS ENUM ('MANUAL', 'APIDAE', 'API_EDUCATION_NATIONALE', 'API_SIRENE', 'IMPORT_CSV', 'IMPORT_API_EN', 'RESEAU_IMPORT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "RoleMembership" AS ENUM ('PROPRIETAIRE', 'ADMINISTRATEUR', 'MEMBRE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "ClaimStatut" AS ENUM ('NON_APPLICABLE', 'EN_ATTENTE_DOCUMENT', 'EN_ATTENTE_VALIDATION', 'VALIDE', 'REFUSE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "StatutRelation" AS ENUM ('PROSPECT', 'CONTACTE', 'INTERESSE', 'EN_NEGOCIATION', 'CLIENT', 'INACTIF');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------
-- 3. AlterTable : ajout de organisation_id sur centres_hebergement
-- ------------------------------------------------------------
ALTER TABLE "centres_hebergement" ADD COLUMN IF NOT EXISTS "organisation_id" UUID;

-- ------------------------------------------------------------
-- 4. CreateTable : organisations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "organisations" (
    "id" UUID NOT NULL,
    "siren" VARCHAR(9),
    "siret" VARCHAR(14),
    "rna" VARCHAR(10),
    "uai" VARCHAR(20),
    "nom" VARCHAR(255) NOT NULL,
    "raison_sociale" VARCHAR(255),
    "adresse" VARCHAR(500),
    "code_postal" VARCHAR(10),
    "ville" VARCHAR(255),
    "departement" VARCHAR(10),
    "email_contact" VARCHAR(255),
    "telephone_contact" VARCHAR(20),
    "site_web" VARCHAR(500),
    "type_structure" "TypeStructure",
    "academie" VARCHAR(100),
    "source" "SourceOrganisation" NOT NULL DEFAULT 'MANUAL',
    "source_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- 5. CreateTable : memberships
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "role" "RoleMembership" NOT NULL DEFAULT 'MEMBRE',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "claim_statut" "ClaimStatut" NOT NULL DEFAULT 'NON_APPLICABLE',
    "claim_document_url" VARCHAR(500),
    "claim_siret_extrait" VARCHAR(14),
    "claim_validated_by_id" UUID,
    "claim_validated_at" TIMESTAMP(3),
    "claim_refuse_raison" TEXT,
    "claim_submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- 6. CreateTable : relations_commerciales
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "relations_commerciales" (
    "id" UUID NOT NULL,
    "organisation_hebergeur_id" UUID NOT NULL,
    "organisation_cliente_id" UUID NOT NULL,
    "statut" "StatutRelation" NOT NULL DEFAULT 'PROSPECT',
    "notes" TEXT,
    "source" VARCHAR(20) NOT NULL DEFAULT 'MANUEL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "relations_commerciales_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- 7. CreateTable : sejours_relations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "sejours_relations" (
    "id" UUID NOT NULL,
    "relation_id" UUID NOT NULL,
    "sejour_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sejours_relations_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- 8. CreateIndex (idempotent)
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "organisations_siren_key" ON "organisations"("siren");
CREATE INDEX IF NOT EXISTS "organisations_siren_idx" ON "organisations"("siren");
CREATE INDEX IF NOT EXISTS "organisations_siret_idx" ON "organisations"("siret");
CREATE INDEX IF NOT EXISTS "organisations_uai_idx" ON "organisations"("uai");
CREATE INDEX IF NOT EXISTS "organisations_rna_idx" ON "organisations"("rna");
CREATE INDEX IF NOT EXISTS "organisations_nom_idx" ON "organisations"("nom");

CREATE INDEX IF NOT EXISTS "memberships_user_id_idx" ON "memberships"("user_id");
CREATE INDEX IF NOT EXISTS "memberships_organisation_id_idx" ON "memberships"("organisation_id");
CREATE INDEX IF NOT EXISTS "memberships_claim_statut_idx" ON "memberships"("claim_statut");
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_user_id_organisation_id_key" ON "memberships"("user_id", "organisation_id");

CREATE INDEX IF NOT EXISTS "relations_commerciales_organisation_hebergeur_id_idx" ON "relations_commerciales"("organisation_hebergeur_id");
CREATE INDEX IF NOT EXISTS "relations_commerciales_organisation_cliente_id_idx" ON "relations_commerciales"("organisation_cliente_id");
CREATE UNIQUE INDEX IF NOT EXISTS "relations_commerciales_organisation_hebergeur_id_organisati_key" ON "relations_commerciales"("organisation_hebergeur_id", "organisation_cliente_id");

CREATE UNIQUE INDEX IF NOT EXISTS "sejours_relations_relation_id_sejour_id_key" ON "sejours_relations"("relation_id", "sejour_id");

-- ------------------------------------------------------------
-- 9. AddForeignKey (idempotent via DO blocks)
-- ------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE "centres_hebergement"
        ADD CONSTRAINT "centres_hebergement_organisation_id_fkey"
        FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "memberships"
        ADD CONSTRAINT "memberships_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "utilisateurs"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "memberships"
        ADD CONSTRAINT "memberships_organisation_id_fkey"
        FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "memberships"
        ADD CONSTRAINT "memberships_claim_validated_by_id_fkey"
        FOREIGN KEY ("claim_validated_by_id") REFERENCES "utilisateurs"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "relations_commerciales"
        ADD CONSTRAINT "relations_commerciales_organisation_hebergeur_id_fkey"
        FOREIGN KEY ("organisation_hebergeur_id") REFERENCES "organisations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "relations_commerciales"
        ADD CONSTRAINT "relations_commerciales_organisation_cliente_id_fkey"
        FOREIGN KEY ("organisation_cliente_id") REFERENCES "organisations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "sejours_relations"
        ADD CONSTRAINT "sejours_relations_relation_id_fkey"
        FOREIGN KEY ("relation_id") REFERENCES "relations_commerciales"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "sejours_relations"
        ADD CONSTRAINT "sejours_relations_sejour_id_fkey"
        FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- BACKFILL IDEMPOTENT : Organisations + Memberships
-- ============================================================
-- NOTE PostgreSQL : ALTER TYPE ADD VALUE ne permet pas d'utiliser
-- la nouvelle valeur dans la même transaction. Les nouvelles valeurs
-- 'ENTREPRISE', 'COLLECTIVITE_TERRITORIALE', 'MICRO_ENTREPRISE'
-- ne sont donc PAS référencées dans le backfill ci-dessous.
-- type_structure est laissé NULL pour les organisations dérivées
-- des centres_hebergement — il sera renseigné dans une étape
-- ultérieure (UPDATE manuel ou migration suivante).
-- Pour les organisations dérivées des Users, on réutilise la valeur
-- déjà présente dans utilisateurs.type_structure (subset existant).

-- Étape 1 : Créer une Organisation pour chaque CentreHebergement existant
-- (les centres sont les orgas hébergeur)
INSERT INTO organisations (id, nom, adresse, code_postal, ville, email_contact, telephone_contact, site_web, source, source_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  ch.nom,
  ch.adresse,
  ch.code_postal,
  ch.ville,
  ch.email,
  ch.telephone,
  ch.site_web,
  CASE WHEN ch.source = 'APIDAE' THEN 'APIDAE'::"SourceOrganisation" ELSE 'MANUAL'::"SourceOrganisation" END,
  ch.apidae_id,
  ch.created_at,
  NOW()
FROM centres_hebergement ch
WHERE ch.organisation_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM organisations o WHERE o.nom = ch.nom AND o.ville = ch.ville
);

-- Étape 2 : Rattacher chaque CentreHebergement à son Organisation
UPDATE centres_hebergement ch
SET organisation_id = o.id
FROM organisations o
WHERE ch.organisation_id IS NULL
AND o.nom = ch.nom AND o.ville = ch.ville;

-- Étape 3 : Copier le SIRET du centre vers l'Organisation
UPDATE organisations o
SET siret = ch.siret,
    siren = LEFT(ch.siret, 9)
FROM centres_hebergement ch
WHERE ch.organisation_id = o.id
AND ch.siret IS NOT NULL
AND o.siret IS NULL;

-- Étape 4 : Créer une Organisation pour chaque User TEACHER/DIRECTOR
-- qui a un etablissementNom et n'a pas encore de membership
INSERT INTO organisations (id, nom, uai, adresse, ville, email_contact, telephone_contact, type_structure, source, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.etablissement_nom,
  u.etablissement_uai,
  u.etablissement_adresse,
  u.etablissement_ville,
  u.etablissement_email,
  u.etablissement_telephone,
  u.type_structure,
  'MANUAL'::"SourceOrganisation",
  u.created_at,
  NOW()
FROM utilisateurs u
WHERE u.etablissement_nom IS NOT NULL
AND u.role IN ('TEACHER', 'DIRECTOR')
AND NOT EXISTS (
  SELECT 1 FROM memberships m WHERE m.user_id = u.id
)
AND NOT EXISTS (
  SELECT 1 FROM organisations o
  WHERE (u.etablissement_uai IS NOT NULL AND o.uai = u.etablissement_uai)
     OR (u.etablissement_uai IS NULL AND o.nom = u.etablissement_nom AND o.ville = u.etablissement_ville)
);

-- Étape 5 : Memberships pour les Users TEACHER/DIRECTOR
INSERT INTO memberships (id, user_id, organisation_id, role, is_primary, claim_statut, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  o.id,
  'PROPRIETAIRE'::"RoleMembership",
  true,
  'NON_APPLICABLE'::"ClaimStatut",
  NOW(),
  NOW()
FROM utilisateurs u
JOIN organisations o ON (
  (u.etablissement_uai IS NOT NULL AND o.uai = u.etablissement_uai)
  OR (u.etablissement_uai IS NULL AND o.nom = u.etablissement_nom AND o.ville = u.etablissement_ville)
)
WHERE u.etablissement_nom IS NOT NULL
AND u.role IN ('TEACHER', 'DIRECTOR')
AND NOT EXISTS (
  SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.organisation_id = o.id
);

-- Étape 6 : Memberships pour les Users VENUE (via CentreHebergement → Organisation)
INSERT INTO memberships (id, user_id, organisation_id, role, is_primary, claim_statut, created_at, updated_at)
SELECT
  gen_random_uuid(),
  ch.user_id,
  ch.organisation_id,
  'PROPRIETAIRE'::"RoleMembership",
  true,
  'NON_APPLICABLE'::"ClaimStatut",
  NOW(),
  NOW()
FROM centres_hebergement ch
WHERE ch.user_id IS NOT NULL
AND ch.organisation_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM memberships m WHERE m.user_id = ch.user_id AND m.organisation_id = ch.organisation_id
);
