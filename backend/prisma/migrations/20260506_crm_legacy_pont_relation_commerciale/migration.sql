-- AlterTable: pont CRM legacy → RelationCommerciale (idempotent)
ALTER TABLE "rappels"
  ADD COLUMN IF NOT EXISTS "relation_id" UUID
  REFERENCES "relations_commerciales"("id") ON DELETE SET NULL;

ALTER TABLE "contacts_clients"
  ADD COLUMN IF NOT EXISTS "relation_id" UUID
  REFERENCES "relations_commerciales"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "rappels_relation_id_idx"
  ON "rappels"("relation_id");

CREATE INDEX IF NOT EXISTS "contacts_clients_relation_id_idx"
  ON "contacts_clients"("relation_id");
