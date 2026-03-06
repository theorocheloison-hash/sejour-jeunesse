-- AlterTable
ALTER TABLE "centres_hebergement" ADD COLUMN "siret" VARCHAR(14),
ADD COLUMN "departement" VARCHAR(100),
ADD COLUMN "agrement_education_nationale" VARCHAR(50),
ADD COLUMN "type_sejours" TEXT[] DEFAULT ARRAY[]::TEXT[];
