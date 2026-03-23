-- AlterTable
ALTER TABLE "invitations_collaboration" ADD COLUMN "niveau_classe" VARCHAR(50);
ALTER TABLE "invitations_collaboration" ADD COLUMN "nombre_accompagnateurs" INTEGER;
ALTER TABLE "invitations_collaboration" ADD COLUMN "thematiques_pedagogiques" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "invitations_collaboration" ADD COLUMN "heure_arrivee" VARCHAR(10);
ALTER TABLE "invitations_collaboration" ADD COLUMN "heure_depart" VARCHAR(10);
ALTER TABLE "invitations_collaboration" ADD COLUMN "transport_aller" VARCHAR(30);
ALTER TABLE "invitations_collaboration" ADD COLUMN "transport_sur_place" BOOLEAN;
ALTER TABLE "invitations_collaboration" ADD COLUMN "activites_souhaitees" TEXT;
ALTER TABLE "invitations_collaboration" ADD COLUMN "budget_max_par_eleve" DOUBLE PRECISION;
