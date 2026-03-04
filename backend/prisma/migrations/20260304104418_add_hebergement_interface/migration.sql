-- CreateEnum
CREATE TYPE "StatutCentre" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TypeDocument" AS ENUM ('AGREMENT', 'ASSURANCE', 'AUTRE');

-- CreateTable
CREATE TABLE "centres_hebergement" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "adresse" VARCHAR(500) NOT NULL,
    "ville" VARCHAR(255) NOT NULL,
    "code_postal" VARCHAR(10) NOT NULL,
    "telephone" VARCHAR(20),
    "email" VARCHAR(255),
    "capacite" INTEGER NOT NULL,
    "description" TEXT,
    "user_id" UUID NOT NULL,
    "statut" "StatutCentre" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "centres_hebergement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilites" (
    "id" UUID NOT NULL,
    "centre_id" UUID NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "capacite_disponible" INTEGER NOT NULL,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disponibilites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "centre_id" UUID NOT NULL,
    "type" "TypeDocument" NOT NULL DEFAULT 'AUTRE',
    "nom" VARCHAR(255) NOT NULL,
    "s3_key" VARCHAR(500),
    "url" VARCHAR(500),
    "date_expiration" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations_hebergement" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "nom_centre" VARCHAR(255) NOT NULL,
    "token" UUID NOT NULL,
    "utilised_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_hebergement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_hebergement_token_key" ON "invitations_hebergement"("token");

-- AddForeignKey
ALTER TABLE "centres_hebergement" ADD CONSTRAINT "centres_hebergement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilites" ADD CONSTRAINT "disponibilites_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
