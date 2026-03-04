/*
  Warnings:

  - Added the required column `ville` to the `hebergements` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "hebergements" ADD COLUMN     "activites" TEXT[],
ADD COLUMN     "agrement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "prix_par_jour" DECIMAL(10,2),
ADD COLUMN     "telephone" VARCHAR(20),
ADD COLUMN     "ville" VARCHAR(255) NOT NULL,
ALTER COLUMN "sejour_id" DROP NOT NULL;
