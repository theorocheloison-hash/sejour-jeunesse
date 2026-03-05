-- AlterTable
ALTER TABLE "autorisations_parentales" ADD COLUMN "taille" INTEGER;
ALTER TABLE "autorisations_parentales" ADD COLUMN "poids" INTEGER;
ALTER TABLE "autorisations_parentales" ADD COLUMN "pointure" INTEGER;
ALTER TABLE "autorisations_parentales" ADD COLUMN "regime_alimentaire" VARCHAR(100);
ALTER TABLE "autorisations_parentales" ADD COLUMN "niveau_ski" VARCHAR(50);
