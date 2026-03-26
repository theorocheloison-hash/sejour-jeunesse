-- AlterTable
ALTER TABLE "centres_hebergement" ADD COLUMN "accessible_pmr" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "centres_hebergement" ADD COLUMN "avis_securite" VARCHAR(50);
ALTER TABLE "centres_hebergement" ADD COLUMN "thematiques_centre" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "centres_hebergement" ADD COLUMN "activites_centre" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "centres_hebergement" ADD COLUMN "capacite_adultes" INTEGER;
ALTER TABLE "centres_hebergement" ADD COLUMN "periode_ouverture" VARCHAR(255);
