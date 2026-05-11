-- AlterTable: informations complémentaires sur DemandeDevis, idempotent
ALTER TABLE "demandes_devis"
  ADD COLUMN IF NOT EXISTS "informations_complementaires" TEXT;
