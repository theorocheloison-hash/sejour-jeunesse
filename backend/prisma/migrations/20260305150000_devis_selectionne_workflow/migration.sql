-- AlterEnum
ALTER TYPE "StatutSejour" ADD VALUE 'CONVENTION';

-- AlterTable
ALTER TABLE "sejours" ADD COLUMN "hebergement_selectionne_id" UUID;

-- AddForeignKey
ALTER TABLE "sejours" ADD CONSTRAINT "sejours_hebergement_selectionne_id_fkey" FOREIGN KEY ("hebergement_selectionne_id") REFERENCES "centres_hebergement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
