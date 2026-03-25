ALTER TABLE "centres_hebergement" ADD COLUMN IF NOT EXISTS "mandat_facturation_accepte" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "centres_hebergement" ADD COLUMN IF NOT EXISTS "mandat_facturation_accepte_at" TIMESTAMP(3);
ALTER TABLE "centres_hebergement" ADD COLUMN IF NOT EXISTS "mandat_facturation_version" VARCHAR(20);
