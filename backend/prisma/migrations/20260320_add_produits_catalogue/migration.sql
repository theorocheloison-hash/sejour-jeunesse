-- CreateTable
CREATE TABLE "produits_catalogue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "centre_id" UUID NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(50) NOT NULL,
    "prix_unitaire_ht" DOUBLE PRECISION NOT NULL,
    "tva" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "unite" VARCHAR(50) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produits_catalogue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "produits_catalogue" ADD CONSTRAINT "produits_catalogue_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
