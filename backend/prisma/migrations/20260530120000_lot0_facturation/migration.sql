-- LOT 0 — Conformité facturation
-- 0.1 Compteur séquentiel atomique par émetteur + champs Devis
-- 0.2 Champ montant_solde (fin de la corruption de montant_acompte par facturerSolde)

-- CreateTable : compteur séquentiel atomique par (émetteur, année, type de doc)
CREATE TABLE "sequence_numero" (
    "id" UUID NOT NULL,
    "emetteur_id" UUID NOT NULL,
    "annee" INTEGER NOT NULL,
    "type_doc" VARCHAR(20) NOT NULL,
    "dernier_numero" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequence_numero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex : une seule séquence par émetteur / année / type de document
CREATE UNIQUE INDEX "sequence_numero_emetteur_id_annee_type_doc_key" ON "sequence_numero"("emetteur_id", "annee", "type_doc");

-- AlterTable : nouveaux champs sur Devis
ALTER TABLE "devis" ADD COLUMN "montant_solde" DOUBLE PRECISION;
ALTER TABLE "devis" ADD COLUMN "emetteur_id" UUID;

-- CreateIndex : index émetteur
CREATE INDEX "devis_emetteur_id_idx" ON "devis"("emetteur_id");

-- CreateIndex : garde-fou unicité du numéro de facture par émetteur (index unique partiel)
CREATE UNIQUE INDEX "devis_emetteur_id_numero_facture_key" ON "devis"("emetteur_id", "numero_facture") WHERE "numero_facture" IS NOT NULL;
