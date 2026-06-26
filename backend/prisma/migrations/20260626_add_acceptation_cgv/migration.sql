-- Audit acceptation CGV lors de la souscription SEPA (preuve juridique).
-- Horodatage + IP de l'acceptation, scopé centre + user.

CREATE TABLE "acceptations_cgv" (
    "id" UUID NOT NULL,
    "centre_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan" TEXT NOT NULL,
    "frequence" TEXT NOT NULL,
    "ip_address" TEXT,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acceptations_cgv_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "acceptations_cgv" ADD CONSTRAINT "acceptations_cgv_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "acceptations_cgv" ADD CONSTRAINT "acceptations_cgv_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
