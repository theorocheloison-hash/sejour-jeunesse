-- CreateEnum
CREATE TYPE "TypeDocumentSejour" AS ENUM ('PROGRAMME', 'TRANSPORT', 'ASSURANCE', 'FACTURE', 'AUTRE');

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sejour_id" UUID NOT NULL,
    "auteur_id" UUID NOT NULL,
    "contenu" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_activites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sejour_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "heure_debut" VARCHAR(5) NOT NULL,
    "heure_fin" VARCHAR(5) NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "responsable" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_activites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents_sejour" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sejour_id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "type" "TypeDocumentSejour" NOT NULL DEFAULT 'AUTRE',
    "url" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_sejour_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_activites" ADD CONSTRAINT "planning_activites_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_sejour" ADD CONSTRAINT "documents_sejour_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_sejour" ADD CONSTRAINT "documents_sejour_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
