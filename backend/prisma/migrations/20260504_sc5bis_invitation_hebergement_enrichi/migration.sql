-- SC5bis : Enrichissement InvitationHebergement
-- Pré-création de centre par admin + traçabilité email + rattachement centre existant

ALTER TABLE "invitations_hebergement"
  ADD COLUMN IF NOT EXISTS "centre_existant_id" UUID,
  ADD COLUMN IF NOT EXISTS "centre_precreer_nom" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "centre_precreer_adresse" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "centre_precreer_ville" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "centre_precreer_code_postal" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "centre_precreer_capacite" INTEGER,
  ADD COLUMN IF NOT EXISTS "centre_precreer_siret" VARCHAR(14),
  ADD COLUMN IF NOT EXISTS "centre_precreer_departement" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "email_envoye" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "email_envoye_at" TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invitations_hebergement_centre_existant_id_fkey'
      AND table_name = 'invitations_hebergement'
  ) THEN
    ALTER TABLE "invitations_hebergement"
      ADD CONSTRAINT "invitations_hebergement_centre_existant_id_fkey"
      FOREIGN KEY ("centre_existant_id") REFERENCES "centres_hebergement"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "invitations_hebergement_centre_existant_id_idx"
  ON "invitations_hebergement"("centre_existant_id");
