-- AlterTable
ALTER TABLE "autorisations_parentales" ADD COLUMN "rgpd_accepte_at" TIMESTAMP(3);
ALTER TABLE "autorisations_parentales" ADD COLUMN "rgpd_version_cgu" VARCHAR(20);
ALTER TABLE "autorisations_parentales" ADD COLUMN "consentement_medical" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "autorisations_parentales" ADD COLUMN "consentement_medical_at" TIMESTAMP(3);
