-- AlterTable: champs ACM (HORS_SCOLAIRE) sur Sejour, idempotent
ALTER TABLE "sejours"
  ADD COLUMN IF NOT EXISTS "age_min" INTEGER,
  ADD COLUMN IF NOT EXISTS "age_max" INTEGER,
  ADD COLUMN IF NOT EXISTS "moins_de_6_ans" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "type_accueil_acm" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "projet_educatif" TEXT;
