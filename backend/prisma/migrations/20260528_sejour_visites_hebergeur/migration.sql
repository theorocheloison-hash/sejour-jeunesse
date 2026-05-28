-- CreateTable SejourVisiteHebergeur
CREATE TABLE "sejour_visites_hebergeur" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "sejour_id" UUID NOT NULL,
    "onglet" VARCHAR(30) NOT NULL,
    "visited_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "sejour_visites_hebergeur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex unique
CREATE UNIQUE INDEX "sejour_visites_hebergeur_user_id_sejour_id_onglet_key" ON "sejour_visites_hebergeur"("user_id", "sejour_id", "onglet");

-- AddForeignKey
ALTER TABLE "sejour_visites_hebergeur" ADD CONSTRAINT "sejour_visites_hebergeur_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sejour_visites_hebergeur" ADD CONSTRAINT "sejour_visites_hebergeur_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
