-- CreateTable
CREATE TABLE "demandes_ignorees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "demande_id" UUID NOT NULL,
    "centre_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demandes_ignorees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "demandes_ignorees_demande_id_centre_id_key" ON "demandes_ignorees"("demande_id", "centre_id");

-- AddForeignKey
ALTER TABLE "demandes_ignorees" ADD CONSTRAINT "demandes_ignorees_demande_id_fkey" FOREIGN KEY ("demande_id") REFERENCES "demandes_devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_ignorees" ADD CONSTRAINT "demandes_ignorees_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
