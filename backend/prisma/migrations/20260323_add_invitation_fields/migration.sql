ALTER TABLE "invitations_collaboration" ADD COLUMN IF NOT EXISTS "niveau_classe" VARCHAR(50);
ALTER TABLE "invitations_collaboration" ADD COLUMN IF NOT EXISTS "nombre_accompagnateurs" INTEGER;
ALTER TABLE "invitations_collaboration" ADD COLUMN IF NOT EXISTS "thematiques_pedagogiques" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "invitations_collaboration" ADD COLUMN IF NOT EXISTS "heure_arrivee" VARCHAR(10);
ALTER TABLE "invitations_collaboration" ADD COLUMN IF NOT EXISTS "heure_depart" VARCHAR(10);
ALTER TABLE "invitations_collaboration" ADD COLUMN IF NOT EXISTS "transport_aller" VARCHAR(30);
ALTER TABLE "invitations_collaboration" ADD COLUMN IF NOT EXISTS "transport_sur_place" BOOLEAN;
ALTER TABLE "invitations_collaboration" ADD COLUMN IF NOT EXISTS "activites_souhaitees" TEXT;
ALTER TABLE "invitations_collaboration" ADD COLUMN IF NOT EXISTS "budget_max_par_eleve" DOUBLE PRECISION;
