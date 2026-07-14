-- AlterTable
ALTER TABLE "centres_hebergement"
  ADD COLUMN "regime_marge_actif" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taux_tva_marge" DOUBLE PRECISION NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "produits_catalogue"
  ADD COLUMN "revendu_tiers_defaut" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "categorie_marge" VARCHAR(50);

-- AlterTable
ALTER TABLE "lignes_devis"
  ADD COLUMN "revendu_tiers" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "categorie_marge" VARCHAR(50);

-- CreateIndex
CREATE INDEX "idx_lignes_devis_revendu_tiers"
  ON "lignes_devis" ("revendu_tiers") WHERE "revendu_tiers" = true;
