-- Justificatif de revendication par centre (hébergeur déjà validé ajoutant un centre).
-- Champs nullables : aucun impact sur les centres existants (restent ACTIVE).
ALTER TABLE "centres_hebergement"
  ADD COLUMN "claim_document_url" VARCHAR(500),
  ADD COLUMN "claim_submitted_at" TIMESTAMP(3),
  ADD COLUMN "claim_submitted_by" UUID;
