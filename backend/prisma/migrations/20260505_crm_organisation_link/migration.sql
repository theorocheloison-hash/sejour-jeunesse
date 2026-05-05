-- AlterTable : link Client → Organisation (nullable, idempotent)
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "organisation_id" UUID
  REFERENCES "organisations"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "clients_organisation_id_idx"
  ON "clients"("organisation_id");
