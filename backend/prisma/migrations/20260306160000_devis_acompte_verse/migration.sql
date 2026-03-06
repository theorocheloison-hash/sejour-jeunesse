-- AlterTable
ALTER TABLE "devis" ADD COLUMN "acompte_verse" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "devis" ADD COLUMN "date_versement_acompte" TIMESTAMP(3);
