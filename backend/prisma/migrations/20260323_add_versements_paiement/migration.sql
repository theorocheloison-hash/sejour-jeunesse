-- AlterTable
ALTER TABLE "devis" ADD COLUMN "montant_verse_total" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "versements_paiement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "devis_id" UUID NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "date_paiement" DATE NOT NULL,
    "reference" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versements_paiement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "versements_paiement" ADD CONSTRAINT "versements_paiement_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
