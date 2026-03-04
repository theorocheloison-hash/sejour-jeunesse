-- CreateTable
CREATE TABLE "autorisations_parentales" (
    "id" UUID NOT NULL,
    "sejour_id" UUID NOT NULL,
    "eleve_nom" VARCHAR(100) NOT NULL,
    "eleve_prenom" VARCHAR(100) NOT NULL,
    "parent_email" VARCHAR(255) NOT NULL,
    "token_acces" UUID NOT NULL,
    "signee_at" TIMESTAMP(3),
    "infos_medicales" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autorisations_parentales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "autorisations_parentales_token_acces_key" ON "autorisations_parentales"("token_acces");

-- AddForeignKey
ALTER TABLE "autorisations_parentales" ADD CONSTRAINT "autorisations_parentales_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
