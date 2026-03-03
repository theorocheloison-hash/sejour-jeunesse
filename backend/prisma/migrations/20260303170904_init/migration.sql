-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEACHER', 'DIRECTOR', 'RECTOR', 'PARENT', 'VENUE');

-- CreateEnum
CREATE TYPE "StatutSejour" AS ENUM ('ouvert', 'complet', 'annule', 'termine');

-- CreateEnum
CREATE TYPE "StatutInscription" AS ENUM ('en_attente', 'confirmee', 'annulee', 'remboursee');

-- CreateEnum
CREATE TYPE "StatutPaiement" AS ENUM ('en_attente', 'valide', 'refuse', 'rembourse');

-- CreateEnum
CREATE TYPE "MethodePaiement" AS ENUM ('carte', 'virement', 'cheque', 'especes');

-- CreateEnum
CREATE TYPE "TypeHebergement" AS ENUM ('chalet', 'tente', 'auberge', 'hotel', 'gite', 'autre');

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" UUID NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PARENT',
    "prenom" VARCHAR(100) NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "mot_de_passe" VARCHAR(255) NOT NULL,
    "telephone" VARCHAR(20),
    "date_naissance" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sejours" (
    "id" UUID NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "lieu" VARCHAR(255) NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "places_totales" INTEGER NOT NULL,
    "places_restantes" INTEGER NOT NULL,
    "prix" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "statut" "StatutSejour" NOT NULL DEFAULT 'ouvert',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sejours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hebergements" (
    "id" UUID NOT NULL,
    "sejour_id" UUID NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "type" "TypeHebergement" NOT NULL DEFAULT 'autre',
    "adresse" VARCHAR(500),
    "capacite" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hebergements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscriptions" (
    "id" UUID NOT NULL,
    "sejour_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "statut" "StatutInscription" NOT NULL DEFAULT 'en_attente',
    "date_inscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarques" TEXT,

    CONSTRAINT "inscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements" (
    "id" UUID NOT NULL,
    "inscription_id" UUID NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "statut" "StatutPaiement" NOT NULL DEFAULT 'en_attente',
    "methode" "MethodePaiement",
    "date_paiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "inscriptions_sejour_id_utilisateur_id_key" ON "inscriptions"("sejour_id", "utilisateur_id");

-- AddForeignKey
ALTER TABLE "hebergements" ADD CONSTRAINT "hebergements_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "inscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
