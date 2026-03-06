-- CreateTable
CREATE TABLE "accompagnateurs_missions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sejour_id" UUID NOT NULL,
    "prenom" VARCHAR(100) NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "telephone" VARCHAR(30),
    "contact_urgence_nom" VARCHAR(200),
    "contact_urgence_tel" VARCHAR(30),
    "token_acces" UUID NOT NULL DEFAULT gen_random_uuid(),
    "signee_at" TIMESTAMP(3),
    "signature_nom" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accompagnateurs_missions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accompagnateurs_missions_token_acces_key" ON "accompagnateurs_missions"("token_acces");

-- AddForeignKey
ALTER TABLE "accompagnateurs_missions" ADD CONSTRAINT "accompagnateurs_missions_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
