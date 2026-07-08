-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('MOLLIE', 'VIREMENT');

-- AlterTable
ALTER TABLE "centres_hebergement" ADD COLUMN "mode_paiement" "ModePaiement";
