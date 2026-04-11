CREATE TABLE "invitations_directeur" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sejour_id" UUID NOT NULL,
  "devis_id" UUID,
  "email_directeur" VARCHAR(255) NOT NULL,
  "etablissement_uai" VARCHAR(20),
  "etablissement_nom" VARCHAR(255),
  "enseignant_prenom" VARCHAR(100),
  "sejour_titre" VARCHAR(255),
  "utilised_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invitations_directeur_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invitations_directeur_token_key" UNIQUE ("token")
);
