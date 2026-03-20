-- AlterTable
ALTER TABLE "demandes_devis" ADD COLUMN "nombre_accompagnateurs" INTEGER;
ALTER TABLE "demandes_devis" ADD COLUMN "heure_arrivee" VARCHAR(10);
ALTER TABLE "demandes_devis" ADD COLUMN "heure_depart" VARCHAR(10);
ALTER TABLE "demandes_devis" ADD COLUMN "transport_demande" BOOLEAN DEFAULT false;
ALTER TABLE "demandes_devis" ADD COLUMN "activites_souhaitees" TEXT;
ALTER TABLE "demandes_devis" ADD COLUMN "budget_max_par_eleve" DOUBLE PRECISION;
