ALTER TABLE "autorisations_parentales" ADD COLUMN IF NOT EXISTS "montant_verse_total" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "autorisations_parentales" ADD COLUMN IF NOT EXISTS "nombre_versements_effectues" INTEGER DEFAULT 0;
