-- Lot Mollie : facturation LIAVO → hébergeur (table factures_liavo).
-- Montants stockés en centimes (INTEGER). LIAVO SASU en franchise de base TVA (art. 293 B CGI).

CREATE TABLE "factures_liavo" (
    "id" UUID NOT NULL,
    "centre_id" UUID NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "date_emission" TIMESTAMP(3) NOT NULL,
    "montant_ht" INTEGER NOT NULL,
    "montant_tva" INTEGER NOT NULL DEFAULT 0,
    "montant_ttc" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "plan_abonnement" VARCHAR(20) NOT NULL,
    "type_abonnement" VARCHAR(20) NOT NULL,
    "mollie_payment_id" VARCHAR(50),
    "pdf_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factures_liavo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "factures_liavo_numero_key" ON "factures_liavo"("numero");

CREATE INDEX "factures_liavo_centre_id_idx" ON "factures_liavo"("centre_id");

CREATE INDEX "factures_liavo_date_emission_idx" ON "factures_liavo"("date_emission");

ALTER TABLE "factures_liavo" ADD CONSTRAINT "factures_liavo_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
