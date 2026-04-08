-- Migration: invitation_etablissement
-- Ajout des champs établissement scolaire sur InvitationCollaboration
-- Permet à l'hébergeur de pré-remplir l'établissement de l'enseignant lors de l'invitation

ALTER TABLE "invitations_collaboration"
ADD COLUMN "etablissement_uai" VARCHAR(20),
ADD COLUMN "etablissement_nom" VARCHAR(255),
ADD COLUMN "etablissement_adresse" VARCHAR(500),
ADD COLUMN "etablissement_ville" VARCHAR(255);
