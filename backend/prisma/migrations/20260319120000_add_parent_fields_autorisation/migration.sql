-- AlterTable
ALTER TABLE "autorisations_parentales" ADD COLUMN "nom_parent" VARCHAR(255),
ADD COLUMN "telephone_urgence" VARCHAR(20),
ADD COLUMN "attestation_assurance_url" VARCHAR(500);
