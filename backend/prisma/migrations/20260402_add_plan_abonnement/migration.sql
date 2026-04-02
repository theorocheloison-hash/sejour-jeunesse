-- CreateEnum
CREATE TYPE "PlanAbonnement" AS ENUM ('DECOUVERTE', 'ESSENTIEL', 'COMPLET');

-- AlterTable
ALTER TABLE "centres_hebergement" ADD COLUMN "plan_abonnement" "PlanAbonnement" NOT NULL DEFAULT 'DECOUVERTE';
