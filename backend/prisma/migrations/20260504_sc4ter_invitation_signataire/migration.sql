-- SC4ter : Flow invitation signataire post-refactor
-- Ajout TypeContexteSejour enum, typeContexte sur Sejour et InvitationDirecteur

-- 1. Créer l'enum TypeContexteSejour
CREATE TYPE "TypeContexteSejour" AS ENUM ('SCOLAIRE', 'HORS_SCOLAIRE');

-- 2. Ajouter typeContexte sur la table sejours (défaut SCOLAIRE pour compatibilité ascendante)
ALTER TABLE "sejours" ADD COLUMN "type_contexte" "TypeContexteSejour" NOT NULL DEFAULT 'SCOLAIRE';

-- 3. Ajouter organisationId et typeContexte sur invitations_directeur
ALTER TABLE "invitations_directeur" ADD COLUMN "organisation_id" UUID;
ALTER TABLE "invitations_directeur" ADD COLUMN "type_contexte" VARCHAR(20);

-- 4. Contrainte FK vers organisations (nullable, SetNull)
ALTER TABLE "invitations_directeur"
  ADD CONSTRAINT "invitations_directeur_organisation_id_fkey"
  FOREIGN KEY ("organisation_id")
  REFERENCES "organisations"("id")
  ON DELETE SET NULL;
