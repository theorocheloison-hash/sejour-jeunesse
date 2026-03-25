-- AlterTable: Devis signature metadata
ALTER TABLE "devis" ADD COLUMN "signature_ip_address" VARCHAR(45);
ALTER TABLE "devis" ADD COLUMN "signature_user_agent" VARCHAR(500);
ALTER TABLE "devis" ADD COLUMN "signature_hash" VARCHAR(64);

-- AlterTable: AutorisationParentale signature metadata
ALTER TABLE "autorisations_parentales" ADD COLUMN "signature_ip_address" VARCHAR(45);
ALTER TABLE "autorisations_parentales" ADD COLUMN "signature_hash" VARCHAR(64);
