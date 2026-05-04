-- SC8 : Suppression des champs etablissement* legacy sur utilisateurs
-- Ces données sont désormais portées par Organisation via Membership
-- IRRÉVERSIBLE sans restauration de backup

ALTER TABLE "utilisateurs"
  DROP COLUMN IF EXISTS "etablissement_uai",
  DROP COLUMN IF EXISTS "etablissement_nom",
  DROP COLUMN IF EXISTS "etablissement_adresse",
  DROP COLUMN IF EXISTS "etablissement_ville",
  DROP COLUMN IF EXISTS "etablissement_email",
  DROP COLUMN IF EXISTS "etablissement_telephone",
  DROP COLUMN IF EXISTS "type_structure";
