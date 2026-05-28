-- Champ notesInternes sur Sejour
ALTER TABLE "sejours" ADD COLUMN "notes_internes" TEXT;

-- sejourId sur Rappel
ALTER TABLE "rappels" ADD COLUMN "sejour_id" UUID;
ALTER TABLE "rappels" ADD CONSTRAINT "rappels_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "idx_rappels_sejour" ON "rappels" ("sejour_id") WHERE "sejour_id" IS NOT NULL;

-- sejourId sur ActiviteClient
ALTER TABLE "activites_client" ADD COLUMN "sejour_id" UUID;
ALTER TABLE "activites_client" ADD CONSTRAINT "activites_client_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "idx_activites_client_sejour" ON "activites_client" ("sejour_id") WHERE "sejour_id" IS NOT NULL;
