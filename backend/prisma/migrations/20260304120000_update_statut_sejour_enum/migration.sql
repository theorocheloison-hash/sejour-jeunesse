-- Migration: update StatutSejour enum values
-- Old: ouvert | complet | annule | termine
-- New: DRAFT | SUBMITTED | APPROVED | REJECTED

-- 1. Créer le nouveau type enum
CREATE TYPE "StatutSejour_new" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- 2. Migrer les données existantes (correspondance sémantique)
UPDATE "sejours" SET "statut" = 'ouvert'  WHERE "statut" = 'ouvert';  -- sera remplacé
UPDATE "sejours" SET "statut" = 'complet' WHERE "statut" = 'complet'; -- sera remplacé
UPDATE "sejours" SET "statut" = 'annule'  WHERE "statut" = 'annule';  -- sera remplacé
UPDATE "sejours" SET "statut" = 'termine' WHERE "statut" = 'termine'; -- sera remplacé

-- 3. Changer le type de la colonne en castant via text
ALTER TABLE "sejours"
  ALTER COLUMN "statut" DROP DEFAULT,
  ALTER COLUMN "statut" TYPE "StatutSejour_new"
    USING CASE "statut"::text
      WHEN 'ouvert'  THEN 'DRAFT'::"StatutSejour_new"
      WHEN 'complet' THEN 'SUBMITTED'::"StatutSejour_new"
      WHEN 'annule'  THEN 'REJECTED'::"StatutSejour_new"
      WHEN 'termine' THEN 'APPROVED'::"StatutSejour_new"
      ELSE 'DRAFT'::"StatutSejour_new"
    END,
  ALTER COLUMN "statut" SET DEFAULT 'DRAFT'::"StatutSejour_new";

-- 4. Supprimer l'ancien type et renommer le nouveau
DROP TYPE "StatutSejour";
ALTER TYPE "StatutSejour_new" RENAME TO "StatutSejour";
