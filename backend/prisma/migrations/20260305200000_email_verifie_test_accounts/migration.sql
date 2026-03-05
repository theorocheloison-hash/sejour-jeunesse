UPDATE "User" SET "emailVerifie" = true WHERE email IN (
  'enseignant@test.fr',
  'directeur@test.fr',
  'recteur@test.fr',
  'contact@chalet-sauvageon.fr'
);
