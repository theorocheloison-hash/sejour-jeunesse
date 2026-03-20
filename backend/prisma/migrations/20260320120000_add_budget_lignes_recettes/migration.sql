-- CreateTable
CREATE TABLE "lignes_budget_complementaires" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sejour_id" UUID NOT NULL,
    "categorie" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lignes_budget_complementaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recettes_budget" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sejour_id" UUID NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recettes_budget_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lignes_budget_complementaires" ADD CONSTRAINT "lignes_budget_complementaires_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recettes_budget" ADD CONSTRAINT "recettes_budget_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
