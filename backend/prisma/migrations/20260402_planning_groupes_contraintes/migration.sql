-- Ajout couleur sur planning_activites
ALTER TABLE "planning_activites" ADD COLUMN "couleur" VARCHAR(50);

-- Ajout champs capacité sur produits_catalogue
ALTER TABLE "produits_catalogue" ADD COLUMN "capacite_par_groupe" INTEGER;
ALTER TABLE "produits_catalogue" ADD COLUMN "encadrement_par_groupe" INTEGER;
ALTER TABLE "produits_catalogue" ADD COLUMN "simultaneite_possible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "produits_catalogue" ADD COLUMN "duree_minutes" INTEGER;

-- CreateTable groupes_sejour
CREATE TABLE "groupes_sejour" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sejour_id" UUID NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "couleur" VARCHAR(50) NOT NULL,
    "taille" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "groupes_sejour_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "groupes_sejour_sejour_id_idx" ON "groupes_sejour"("sejour_id");
ALTER TABLE "groupes_sejour" ADD CONSTRAINT "groupes_sejour_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ajout groupe_id sur planning_activites
ALTER TABLE "planning_activites" ADD COLUMN "groupe_id" UUID;
ALTER TABLE "planning_activites" ADD CONSTRAINT "planning_activites_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "groupes_sejour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable contraintes_centre
CREATE TABLE "contraintes_centre" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "centre_id" UUID NOT NULL,
    "libelle" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "jour_semaine" INTEGER,
    "heure_debut" VARCHAR(5),
    "heure_fin" VARCHAR(5),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contraintes_centre_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contraintes_centre_centre_id_idx" ON "contraintes_centre"("centre_id");
ALTER TABLE "contraintes_centre" ADD CONSTRAINT "contraintes_centre_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable contraintes_sejour
CREATE TABLE "contraintes_sejour" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sejour_id" UUID NOT NULL,
    "libelle" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "date" DATE,
    "jour_semaine" INTEGER,
    "heure_debut" VARCHAR(5),
    "heure_fin" VARCHAR(5),
    "produit_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contraintes_sejour_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contraintes_sejour_sejour_id_idx" ON "contraintes_sejour"("sejour_id");
ALTER TABLE "contraintes_sejour" ADD CONSTRAINT "contraintes_sejour_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contraintes_sejour" ADD CONSTRAINT "contraintes_sejour_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
