-- Module chambres (Monde 1) — référentiel physique + primitive d'occupation datée + étage 1
-- capacité globale (flag D10 sur sejours). Réf : docs/ARCHITECTURE_MODULE_CHAMBRES.md §2,
-- plan : docs/run-chambres-1.md. DDL des tables généré par `prisma migrate diff` ; extension
-- et bloc final (EXCLUDE / CHECK) manuels, inexprimables en Prisma.

-- D2 : l'exclusion de chevauchement (uuid WITH =) exige btree_gist.
-- Vérifié en prod le 21/07/2026 : extension 1.7 disponible, CREATE testé en BEGIN/ROLLBACK.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- AlterTable
ALTER TABLE "sejours" ADD COLUMN     "capacite_alerte_acquittee_at" TIMESTAMP(3),
ADD COLUMN     "capacite_alerte_situation" VARCHAR(64);

-- CreateTable
CREATE TABLE "chambres" (
    "id" UUID NOT NULL,
    "centre_id" UUID NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "etage" VARCHAR(50),
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chambres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lits" (
    "id" UUID NOT NULL,
    "chambre_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "places" INTEGER NOT NULL DEFAULT 1,
    "libelle" VARCHAR(50),
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occupations_chambre" (
    "id" UUID NOT NULL,
    "chambre_id" UUID NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "statut" VARCHAR(12) NOT NULL DEFAULT 'OPTION',
    "sejour_id" UUID,
    "motif" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occupations_chambre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affectations_chambre" (
    "id" UUID NOT NULL,
    "occupation_id" UUID NOT NULL,
    "sejour_id" UUID NOT NULL,
    "autorisation_id" UUID,
    "accompagnateur_id" UUID,
    "lit_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affectations_chambre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chambres_centre_id_idx" ON "chambres"("centre_id");

-- CreateIndex
CREATE INDEX "lits_chambre_id_idx" ON "lits"("chambre_id");

-- CreateIndex
CREATE INDEX "occupations_chambre_chambre_id_date_debut_idx" ON "occupations_chambre"("chambre_id", "date_debut");

-- CreateIndex
CREATE INDEX "occupations_chambre_sejour_id_idx" ON "occupations_chambre"("sejour_id");

-- CreateIndex — support du FK composite d'affectations_chambre
CREATE UNIQUE INDEX "occupations_chambre_id_sejour_id_key" ON "occupations_chambre"("id", "sejour_id");

-- CreateIndex
CREATE INDEX "affectations_chambre_occupation_id_idx" ON "affectations_chambre"("occupation_id");

-- CreateIndex — un élève = une chambre max par séjour
CREATE UNIQUE INDEX "affectations_chambre_sejour_id_autorisation_id_key" ON "affectations_chambre"("sejour_id", "autorisation_id");

-- CreateIndex — idem accompagnateur
CREATE UNIQUE INDEX "affectations_chambre_sejour_id_accompagnateur_id_key" ON "affectations_chambre"("sejour_id", "accompagnateur_id");

-- AddForeignKey
ALTER TABLE "chambres" ADD CONSTRAINT "chambres_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lits" ADD CONSTRAINT "lits_chambre_id_fkey" FOREIGN KEY ("chambre_id") REFERENCES "chambres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey — Restrict : le rooming d'un séjour passé est une donnée, on désactive
-- (actif=false), on ne détruit pas.
ALTER TABLE "occupations_chambre" ADD CONSTRAINT "occupations_chambre_chambre_id_fkey" FOREIGN KEY ("chambre_id") REFERENCES "chambres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupations_chambre" ADD CONSTRAINT "occupations_chambre_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey — FK composite : impossible EN BASE d'affecter un participant sur l'occupation
-- d'un AUTRE séjour. MATCH SIMPLE + sejour_id NOT NULL côté affectation ⇒ une occupation
-- BLOCAGE (sejour_id NULL) ne peut porter aucune affectation.
ALTER TABLE "affectations_chambre" ADD CONSTRAINT "affectations_chambre_occupation_id_sejour_id_fkey" FOREIGN KEY ("occupation_id", "sejour_id") REFERENCES "occupations_chambre"("id", "sejour_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_chambre" ADD CONSTRAINT "affectations_chambre_autorisation_id_fkey" FOREIGN KEY ("autorisation_id") REFERENCES "autorisations_parentales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_chambre" ADD CONSTRAINT "affectations_chambre_accompagnateur_id_fkey" FOREIGN KEY ("accompagnateur_id") REFERENCES "accompagnateurs_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_chambre" ADD CONSTRAINT "affectations_chambre_lit_id_fkey" FOREIGN KEY ("lit_id") REFERENCES "lits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── SQL manuel (doc §2.2, copie conforme) — les 5 contraintes inexprimables en Prisma ──
ALTER TABLE "occupations_chambre"
  ADD CONSTRAINT "occupation_dates_valides" CHECK ("date_fin" > "date_debut"),
  ADD CONSTRAINT "occupation_statut_valide" CHECK ("statut" IN ('OPTION','FERME','A_REPLACER')),
  ADD CONSTRAINT "occupation_sejour_coherent" CHECK (
    ("source" = 'SEJOUR' AND "sejour_id" IS NOT NULL) OR
    ("source" <> 'SEJOUR' AND "sejour_id" IS NULL)
  ),
  -- La règle d'or (D2) : exclusion des seules occupations FERMES — [debut, fin) demi-ouvert,
  -- le jour de départ est libre (rotation des samedis).
  ADD CONSTRAINT "occupation_non_chevauchement" EXCLUDE USING gist (
    "chambre_id" WITH =,
    daterange("date_debut", "date_fin", '[)') WITH &&
  ) WHERE ("statut" = 'FERME');

ALTER TABLE "affectations_chambre"
  ADD CONSTRAINT "affectation_cible_xor" CHECK (
    ("autorisation_id" IS NOT NULL)::int + ("accompagnateur_id" IS NOT NULL)::int = 1
  );
