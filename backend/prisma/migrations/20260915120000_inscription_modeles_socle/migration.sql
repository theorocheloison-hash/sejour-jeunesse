-- Lot 1 « refonte inscriptions » — socle données ADDITIF strict : bibliothèque de
-- modèles d'inscription par centre (modeles_inscription), config figée par séjour
-- (sejours.champs_inscription) et 2 champs santé structurés (autorisations_parentales).
-- Aucun consommateur rebranché : colonnes NULLABLE + nouvelle table uniquement.
-- Seed « Défaut » et backfill séjours en fin de fichier, IDEMPOTENTS et GUARDÉS.

-- AlterTable
ALTER TABLE "sejours" ADD COLUMN     "champs_inscription" JSONB;

-- AlterTable
ALTER TABLE "autorisations_parentales" ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "sait_nager" BOOLEAN;

-- CreateTable
CREATE TABLE "modeles_inscription" (
    "id" UUID NOT NULL,
    "centre_id" UUID NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "champs_actifs" TEXT[] NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modeles_inscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modeles_inscription_centre_id_nom_key" ON "modeles_inscription"("centre_id", "nom");

-- CreateIndex
CREATE INDEX "modeles_inscription_centre_id_idx" ON "modeles_inscription"("centre_id");

-- AddForeignKey
ALTER TABLE "modeles_inscription" ADD CONSTRAINT "modeles_inscription_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── SQL manuel — SEED : un modèle « Défaut » par centre exploité (user_id posé),
-- champs actifs = Bloc B du centre (config live moins les clés Bloc A désormais
-- toujours demandées), fallback = défaut produit. IDEMPOTENT (ON CONFLICT). ──
INSERT INTO "modeles_inscription" ("id", "centre_id", "nom", "champs_actifs", "created_at", "updated_at")
SELECT gen_random_uuid(), c."id", 'Défaut',
  COALESCE(
    (SELECT array_agg(k) FROM jsonb_array_elements_text(c."champs_inscription"->'champsActifs') k
      WHERE k NOT IN ('eleveDateNaissance','nomParent','telephoneUrgence')),
    ARRAY['taille','poids','pointure','niveauSki','regimeAlimentaire','infosMedicales']::text[]
  ),
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "centres_hebergement" c
WHERE c."user_id" IS NOT NULL
ON CONFLICT ("centre_id", "nom") DO NOTHING;

-- ── SQL manuel — BACKFILL : snapshot figé pour les séjours SEJOUR déjà peuplés
-- (au moins une autorisation parentale), GUARDÉ : jamais d'écrasement
-- (champs_inscription IS NULL), soft-deleted exclus. ──
UPDATE "sejours" s SET "champs_inscription" = jsonb_build_object('champsActifs',
  COALESCE(
    (SELECT jsonb_agg(k) FROM jsonb_array_elements_text(c."champs_inscription"->'champsActifs') k
      WHERE k NOT IN ('eleveDateNaissance','nomParent','telephoneUrgence')),
    '["taille","poids","pointure","niveauSki","regimeAlimentaire","infosMedicales"]'::jsonb
  ))
FROM "centres_hebergement" c
WHERE s."hebergement_selectionne_id" = c."id"
  AND s."nature_sejour" = 'SEJOUR'
  AND s."deleted_at" IS NULL
  AND s."champs_inscription" IS NULL
  AND EXISTS (SELECT 1 FROM "autorisations_parentales" a WHERE a."sejour_id" = s."id");
