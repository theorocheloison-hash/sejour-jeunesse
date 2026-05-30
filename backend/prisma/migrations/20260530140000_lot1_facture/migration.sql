-- LOT 1 — Entité Facture immuable (snapshot) + LigneFacture
-- DDL seul. Appliqué par Scalingo via `migrate deploy` (pas de prisma migrate dev).

-- ------------------------------------------------------------
-- 1. CreateTable : factures (snapshot immuable émis depuis un devis)
-- ------------------------------------------------------------
CREATE TABLE "factures" (
    "id" UUID NOT NULL,
    "devis_id" UUID NOT NULL,
    "sejour_id" UUID,
    "emetteur_id" UUID NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "type_facture" VARCHAR(20) NOT NULL,
    "date_emission" TIMESTAMP(3) NOT NULL,
    "emetteur_nom" VARCHAR(255) NOT NULL,
    "emetteur_adresse" TEXT,
    "emetteur_siret" VARCHAR(14),
    "emetteur_tva" VARCHAR(20),
    "emetteur_email" VARCHAR(255),
    "emetteur_tel" VARCHAR(20),
    "emetteur_iban" VARCHAR(34),
    "destinataire_nom" VARCHAR(255) NOT NULL,
    "destinataire_adresse" TEXT,
    "destinataire_siret" VARCHAR(14),
    "destinataire_email" VARCHAR(255),
    "montant_ht" DOUBLE PRECISION NOT NULL,
    "montant_tva" DOUBLE PRECISION NOT NULL,
    "montant_ttc" DOUBLE PRECISION NOT NULL,
    "taux_tva" DOUBLE PRECISION NOT NULL,
    "montant_facture" DOUBLE PRECISION NOT NULL,
    "pourcentage_acompte" DOUBLE PRECISION,
    "facture_acompte_id" UUID,
    "montant_acompte_deja_facture" DOUBLE PRECISION,
    "montant_verse_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acompte_verse" BOOLEAN NOT NULL DEFAULT false,
    "date_versement" TIMESTAMP(3),
    "conditions_annulation" TEXT,
    "pdf_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- 2. CreateTable : lignes_facture (copie figée des lignes du devis)
-- ------------------------------------------------------------
CREATE TABLE "lignes_facture" (
    "id" UUID NOT NULL,
    "facture_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "prix_unitaire" DOUBLE PRECISION NOT NULL,
    "tva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_ht" DOUBLE PRECISION NOT NULL,
    "total_ttc" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "lignes_facture_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- 3. AlterTable : versements_paiement → facture_id (les nouveaux versements pointent vers la Facture)
-- ------------------------------------------------------------
ALTER TABLE "versements_paiement" ADD COLUMN "facture_id" UUID;

-- ------------------------------------------------------------
-- 4. CreateIndex
-- ------------------------------------------------------------
-- B11 : garde-fou unicité numéro de facture par émetteur, désormais sur la table factures
CREATE UNIQUE INDEX "factures_emetteur_id_numero_key" ON "factures"("emetteur_id", "numero");
CREATE INDEX "factures_devis_id_idx" ON "factures"("devis_id");
CREATE INDEX "factures_sejour_id_idx" ON "factures"("sejour_id");
CREATE INDEX "versements_paiement_facture_id_idx" ON "versements_paiement"("facture_id");

-- ------------------------------------------------------------
-- 5. AddForeignKey (idempotent via DO blocks)
-- ------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE "factures"
        ADD CONSTRAINT "factures_devis_id_fkey"
        FOREIGN KEY ("devis_id") REFERENCES "devis"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "factures"
        ADD CONSTRAINT "factures_facture_acompte_id_fkey"
        FOREIGN KEY ("facture_acompte_id") REFERENCES "factures"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "lignes_facture"
        ADD CONSTRAINT "lignes_facture_facture_id_fkey"
        FOREIGN KEY ("facture_id") REFERENCES "factures"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "versements_paiement"
        ADD CONSTRAINT "versements_paiement_facture_id_fkey"
        FOREIGN KEY ("facture_id") REFERENCES "factures"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
