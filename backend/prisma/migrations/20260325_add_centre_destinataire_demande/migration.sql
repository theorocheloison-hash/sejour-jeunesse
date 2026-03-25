ALTER TABLE "demandes_devis" ADD COLUMN IF NOT EXISTS "centre_destinataire_id" UUID;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demandes_devis_centre_destinataire_id_fkey') THEN
    ALTER TABLE "demandes_devis" ADD CONSTRAINT "demandes_devis_centre_destinataire_id_fkey" FOREIGN KEY ("centre_destinataire_id") REFERENCES "centres_hebergement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
