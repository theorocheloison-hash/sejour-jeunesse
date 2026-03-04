-- AlterTable
ALTER TABLE "sejours" ADD COLUMN     "createur_id" UUID;

-- AddForeignKey
ALTER TABLE "sejours" ADD CONSTRAINT "sejours_createur_id_fkey" FOREIGN KEY ("createur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
