-- 1. Ajouter la colonne compte_valide (défaut true pour les existants)
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "compte_valide" BOOLEAN NOT NULL DEFAULT true;

-- 2. Ajouter ADMIN au type enum Role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'Role' AND e.enumlabel = 'ADMIN') THEN
    ALTER TYPE "Role" ADD VALUE 'ADMIN';
  END IF;
END $$;

-- 3. Créer l'utilisateur admin
INSERT INTO "utilisateurs" (id, email, "mot_de_passe", role, prenom, nom, "email_verifie", "compte_valide", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  'admin@sejour-jeunesse.fr',
  '$2b$10$Ldl8wAcILXJqLD9vEBsFxuIx9wn7X1ausEBf2RXJ0Q55wJMNM5sKu',
  'ADMIN'::"Role",
  'Admin',
  'Séjour Jeunesse',
  true,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "utilisateurs" WHERE email = 'admin@sejour-jeunesse.fr'
);
