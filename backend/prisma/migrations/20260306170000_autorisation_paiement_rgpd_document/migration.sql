-- AlterTable
ALTER TABLE "autorisations_parentales" ADD COLUMN "rgpd_accepte" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "autorisations_parentales" ADD COLUMN "nombre_mensualites" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "autorisations_parentales" ADD COLUMN "document_medical_url" VARCHAR(500);
