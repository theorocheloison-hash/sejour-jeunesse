-- AlterTable: ajouter token_verification_expires
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "token_verification_expires" TIMESTAMP(3);
