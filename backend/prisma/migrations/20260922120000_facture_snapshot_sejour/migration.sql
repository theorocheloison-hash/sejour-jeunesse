-- AlterTable
ALTER TABLE "factures"
  ADD COLUMN "sejour_date_debut" DATE,
  ADD COLUMN "sejour_date_fin"   DATE,
  ADD COLUMN "sejour_nature"     VARCHAR(20);
-- Backfill (idempotent : ne touche que les lignes encore vierges)
UPDATE "factures" f
   SET "sejour_date_debut" = s."date_debut",
       "sejour_date_fin"   = s."date_fin",
       "sejour_nature"     = s."nature_sejour"
  FROM "sejours" s
 WHERE s."id" = f."sejour_id"
   AND f."sejour_date_debut" IS NULL
   AND f."sejour_nature" IS NULL;
