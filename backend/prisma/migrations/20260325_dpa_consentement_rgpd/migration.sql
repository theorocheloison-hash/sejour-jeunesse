-- CreateTable
CREATE TABLE "consentements_rgpd" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "version_dpa" VARCHAR(20) NOT NULL,
    "accepte_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "etablissement_uai" VARCHAR(20),

    CONSTRAINT "consentements_rgpd_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "consentements_rgpd" ADD CONSTRAINT "consentements_rgpd_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
