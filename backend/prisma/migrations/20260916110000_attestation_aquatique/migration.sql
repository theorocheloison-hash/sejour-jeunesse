-- Lot 5a-bis « refonte inscriptions » — attestation_aquatique remplace sait_nager.
-- Un booléen « sait nager » ne veut rien dire en ACM (attestations multiples :
-- Pass-nautique, ASNS, Sauv'nage, aisance aquatique…) → statut à 3 valeurs
-- (FOURNIE / NON_FOURNIE / NON_CONCERNE), VARCHAR côté base, enum applicative.
-- DROP sûr : sait_nager posée au Lot 1, JAMAIS écrite (aucun writer déployé,
-- 0 donnée vérifiée en local et en prod à la recette Lot 1).

-- AlterTable
ALTER TABLE "autorisations_parentales" DROP COLUMN "sait_nager";

-- AlterTable
ALTER TABLE "autorisations_parentales" ADD COLUMN     "attestation_aquatique" VARCHAR(20);
