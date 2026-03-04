-- CreateEnum
CREATE TYPE "TypeAbonnement" AS ENUM ('MENSUEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "StatutAbonnement" AS ENUM ('INACTIF', 'ACTIF', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "StatutDemande" AS ENUM ('OUVERTE', 'FERMEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutDevis" AS ENUM ('EN_ATTENTE', 'ACCEPTE', 'REFUSE');

-- AlterTable
ALTER TABLE "centres_hebergement" ADD COLUMN     "abonnement" "TypeAbonnement",
ADD COLUMN     "abonnement_actif_jusqua" DATE,
ADD COLUMN     "abonnement_statut" "StatutAbonnement" NOT NULL DEFAULT 'INACTIF';

-- CreateTable
CREATE TABLE "demandes_devis" (
    "id" UUID NOT NULL,
    "sejour_id" UUID,
    "titre" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "nombre_eleves" INTEGER NOT NULL,
    "ville_hebergement" VARCHAR(255) NOT NULL,
    "statut" "StatutDemande" NOT NULL DEFAULT 'OUVERTE',
    "enseignant_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demandes_devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis" (
    "id" UUID NOT NULL,
    "demande_id" UUID NOT NULL,
    "centre_id" UUID NOT NULL,
    "montant_total" DECIMAL(10,2) NOT NULL,
    "montant_par_eleve" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "conditions_annulation" TEXT,
    "statut" "StatutDevis" NOT NULL DEFAULT 'EN_ATTENTE',
    "document_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devis_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "demandes_devis" ADD CONSTRAINT "demandes_devis_enseignant_id_fkey" FOREIGN KEY ("enseignant_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_devis" ADD CONSTRAINT "demandes_devis_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_demande_id_fkey" FOREIGN KEY ("demande_id") REFERENCES "demandes_devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
