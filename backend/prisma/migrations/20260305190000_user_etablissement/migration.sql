-- AlterTable: add etablissement fields to utilisateurs
ALTER TABLE "utilisateurs" ADD COLUMN "etablissement_uai" VARCHAR(20);
ALTER TABLE "utilisateurs" ADD COLUMN "etablissement_nom" VARCHAR(255);
ALTER TABLE "utilisateurs" ADD COLUMN "etablissement_adresse" VARCHAR(500);
ALTER TABLE "utilisateurs" ADD COLUMN "etablissement_ville" VARCHAR(255);
ALTER TABLE "utilisateurs" ADD COLUMN "etablissement_email" VARCHAR(255);
ALTER TABLE "utilisateurs" ADD COLUMN "etablissement_telephone" VARCHAR(20);
