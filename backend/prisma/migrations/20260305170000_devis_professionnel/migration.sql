-- AlterTable: add professional fields to devis
ALTER TABLE "devis" ADD COLUMN "nom_entreprise" VARCHAR(255);
ALTER TABLE "devis" ADD COLUMN "adresse_entreprise" TEXT;
ALTER TABLE "devis" ADD COLUMN "siret_entreprise" VARCHAR(20);
ALTER TABLE "devis" ADD COLUMN "email_entreprise" VARCHAR(255);
ALTER TABLE "devis" ADD COLUMN "tel_entreprise" VARCHAR(20);

ALTER TABLE "devis" ADD COLUMN "taux_tva" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "devis" ADD COLUMN "montant_ht" DOUBLE PRECISION;
ALTER TABLE "devis" ADD COLUMN "montant_tva" DOUBLE PRECISION;
ALTER TABLE "devis" ADD COLUMN "montant_ttc" DOUBLE PRECISION;

ALTER TABLE "devis" ADD COLUMN "pourcentage_acompte" DOUBLE PRECISION DEFAULT 30;
ALTER TABLE "devis" ADD COLUMN "montant_acompte" DOUBLE PRECISION;

ALTER TABLE "devis" ADD COLUMN "est_facture" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "devis" ADD COLUMN "date_facture" TIMESTAMP(3);
ALTER TABLE "devis" ADD COLUMN "numero_devis" VARCHAR(50);
ALTER TABLE "devis" ADD COLUMN "numero_facture" VARCHAR(50);

ALTER TABLE "devis" ADD COLUMN "type_devis" VARCHAR(20) NOT NULL DEFAULT 'PLATEFORME';

-- CreateTable
CREATE TABLE "lignes_devis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "devis_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "prix_unitaire" DOUBLE PRECISION NOT NULL,
    "tva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_ht" DOUBLE PRECISION NOT NULL,
    "total_ttc" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "lignes_devis_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lignes_devis" ADD CONSTRAINT "lignes_devis_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
