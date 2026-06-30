ALTER TABLE "lignes_devis" ADD COLUMN "produit_catalogue_id" UUID;
ALTER TABLE "lignes_devis" ADD CONSTRAINT "lignes_devis_produit_catalogue_id_fkey" FOREIGN KEY ("produit_catalogue_id") REFERENCES "produits_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "lignes_devis_produit_catalogue_id_idx" ON "lignes_devis"("produit_catalogue_id");
