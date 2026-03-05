-- AlterTable: add email verification fields to utilisateurs
ALTER TABLE "utilisateurs" ADD COLUMN "email_verifie" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "utilisateurs" ADD COLUMN "token_verification" UUID;
