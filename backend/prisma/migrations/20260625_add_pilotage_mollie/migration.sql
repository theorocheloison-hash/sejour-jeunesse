-- Lot 1 Mollie : ajout PILOTAGE à PlanAbonnement + champs Mollie sur centres_hebergement.
-- Idempotent : exécutable via pgsql-console ET via prisma migrate deploy.

ALTER TYPE "PlanAbonnement" ADD VALUE IF NOT EXISTS 'PILOTAGE';

ALTER TABLE "centres_hebergement" ADD COLUMN IF NOT EXISTS "mollie_customer_id" VARCHAR(50);
ALTER TABLE "centres_hebergement" ADD COLUMN IF NOT EXISTS "mollie_subscription_id" VARCHAR(50);
ALTER TABLE "centres_hebergement" ADD COLUMN IF NOT EXISTS "mollie_mandat_id" VARCHAR(50);
ALTER TABLE "centres_hebergement" ADD COLUMN IF NOT EXISTS "trial_started_at" TIMESTAMP(3);
