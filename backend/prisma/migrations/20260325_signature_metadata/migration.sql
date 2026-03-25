ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "signature_ip_address" VARCHAR(45);
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "signature_user_agent" VARCHAR(500);
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "signature_hash" VARCHAR(64);
ALTER TABLE "autorisations_parentales" ADD COLUMN IF NOT EXISTS "signature_ip_address" VARCHAR(45);
ALTER TABLE "autorisations_parentales" ADD COLUMN IF NOT EXISTS "signature_hash" VARCHAR(64);
