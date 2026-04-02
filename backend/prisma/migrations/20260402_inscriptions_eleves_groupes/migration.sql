-- Ajout inscriptions_cloturees sur sejours
ALTER TABLE "sejours" ADD COLUMN "inscriptions_cloturees" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable eleves_groupes
CREATE TABLE "eleves_groupes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "groupe_id" UUID NOT NULL,
    "autorisation_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eleves_groupes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "eleves_groupes_groupe_id_autorisation_id_key" UNIQUE ("groupe_id", "autorisation_id")
);

CREATE INDEX "eleves_groupes_groupe_id_idx" ON "eleves_groupes"("groupe_id");
ALTER TABLE "eleves_groupes" ADD CONSTRAINT "eleves_groupes_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "groupes_sejour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eleves_groupes" ADD CONSTRAINT "eleves_groupes_autorisation_id_fkey" FOREIGN KEY ("autorisation_id") REFERENCES "autorisations_parentales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
