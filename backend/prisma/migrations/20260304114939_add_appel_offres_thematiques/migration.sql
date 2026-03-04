/*
  Warnings:

  - Made the column `sejour_id` on table `demandes_devis` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "AppelOffreStatut" AS ENUM ('BROUILLON', 'OUVERT', 'FERME');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatutDevis" ADD VALUE 'EN_ATTENTE_VALIDATION';
ALTER TYPE "StatutDevis" ADD VALUE 'SELECTIONNE';
ALTER TYPE "StatutDevis" ADD VALUE 'NON_RETENU';

-- DropForeignKey
ALTER TABLE "demandes_devis" DROP CONSTRAINT "demandes_devis_sejour_id_fkey";

-- AlterTable
ALTER TABLE "demandes_devis" ADD COLUMN     "date_butoire_reponse" DATE,
ADD COLUMN     "region_cible" VARCHAR(255) NOT NULL DEFAULT '',
ALTER COLUMN "sejour_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "sejours" ADD COLUMN     "appel_offre_statut" "AppelOffreStatut" NOT NULL DEFAULT 'BROUILLON',
ADD COLUMN     "date_butoire_devis" DATE,
ADD COLUMN     "niveau_classe" VARCHAR(50),
ADD COLUMN     "region_souhaitee" VARCHAR(255),
ADD COLUMN     "thematiques_pedagogiques" TEXT[];

-- AddForeignKey
ALTER TABLE "demandes_devis" ADD CONSTRAINT "demandes_devis_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
