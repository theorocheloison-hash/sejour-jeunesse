UPDATE "utilisateurs" SET "email_verifie" = true WHERE email IN (
  'enseignant@test.fr',
  'directeur@test.fr',
  'recteur@test.fr',
  'contact@chalet-sauvageon.fr'
);
