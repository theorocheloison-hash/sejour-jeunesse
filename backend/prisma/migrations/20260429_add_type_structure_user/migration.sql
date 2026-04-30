-- CreateEnum
CREATE TYPE "TypeStructure" AS ENUM ('COLLEGE_LYCEE', 'ECOLE_PRIMAIRE', 'MAIRIE', 'CENTRE_LOISIRS', 'ASSOCIATION', 'COMITE_ENTREPRISE', 'AUTRE');

-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN "type_structure" "TypeStructure";

-- Backfill : tous les TEACHER existants avec UAI sont des établissements scolaires
-- On ne peut pas distinguer collège/lycée de l'école primaire sans plus d'info
-- On laisse NULL pour les comptes existants — ils pourront le compléter plus tard
-- Optionnel : on peut backfiller ceux qui ont un UAI vers COLLEGE_LYCEE par défaut
UPDATE "utilisateurs" SET "type_structure" = 'COLLEGE_LYCEE' WHERE "role" = 'TEACHER' AND "etablissement_uai" IS NOT NULL;
