-- CreateTable
CREATE TABLE "invitations_centre_externe" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" UUID NOT NULL DEFAULT gen_random_uuid(),
    "enseignant_id" UUID NOT NULL,
    "email_destinataire" VARCHAR(255) NOT NULL,
    "nom_centre" VARCHAR(255) NOT NULL,
    "ville_centre" VARCHAR(255) NOT NULL,
    "code_postal_centre" VARCHAR(10) NOT NULL,
    "titre_sejour_suggere" VARCHAR(255) NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "nb_eleves_estime" INTEGER NOT NULL,
    "message" TEXT,
    "centre_id" UUID,
    "demande_creee" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_centre_externe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_centre_externe_token_key" ON "invitations_centre_externe"("token");

-- AddForeignKey
ALTER TABLE "invitations_centre_externe" ADD CONSTRAINT "invitations_centre_externe_enseignant_id_fkey" FOREIGN KEY ("enseignant_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
