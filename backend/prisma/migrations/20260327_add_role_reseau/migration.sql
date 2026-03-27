-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'RESEAU';

-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN "reseau_nom" VARCHAR(100);
