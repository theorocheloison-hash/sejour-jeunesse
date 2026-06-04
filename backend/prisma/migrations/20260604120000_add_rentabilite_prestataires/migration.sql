-- CreateTable
CREATE TABLE "factures_prestataires" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "centre_id" UUID NOT NULL,
    "nom_prestataire" VARCHAR(255) NOT NULL,
    "type_charge" VARCHAR(50) NOT NULL,
    "numero_facture" VARCHAR(100),
    "date_facture" DATE,
    "montant_total_ttc" DOUBLE PRECISION NOT NULL,
    "fichier_url" VARCHAR(500),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factures_prestataires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventilations_sejour_prestataire" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facture_prestataire_id" UUID NOT NULL,
    "sejour_id" UUID NOT NULL,
    "montant_ttc" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventilations_sejour_prestataire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "factures_prestataires_centre_id_idx" ON "factures_prestataires"("centre_id");

-- CreateIndex
CREATE INDEX "factures_prestataires_centre_id_date_facture_idx" ON "factures_prestataires"("centre_id", "date_facture");

-- CreateIndex
CREATE INDEX "ventilations_sejour_prestataire_sejour_id_idx" ON "ventilations_sejour_prestataire"("sejour_id");

-- CreateIndex
CREATE INDEX "ventilations_sejour_prestataire_facture_prestataire_id_idx" ON "ventilations_sejour_prestataire"("facture_prestataire_id");

-- AddForeignKey
ALTER TABLE "factures_prestataires" ADD CONSTRAINT "factures_prestataires_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventilations_sejour_prestataire" ADD CONSTRAINT "ventilations_sejour_prestataire_facture_prestataire_id_fkey" FOREIGN KEY ("facture_prestataire_id") REFERENCES "factures_prestataires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventilations_sejour_prestataire" ADD CONSTRAINT "ventilations_sejour_prestataire_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
