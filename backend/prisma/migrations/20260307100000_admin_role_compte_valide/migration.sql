-- Add ADMIN to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';

-- Add compte_valide column to utilisateurs
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "compte_valide" BOOLEAN NOT NULL DEFAULT false;

-- Set compte_valide = true for existing users (they're already active)
UPDATE "utilisateurs" SET "compte_valide" = true WHERE "compte_valide" = false;

-- Create admin user
INSERT INTO "utilisateurs" (id, email, "mot_de_passe", role, prenom, nom, "email_verifie", "compte_valide", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'admin@sejour-jeunesse.fr',
  '$2b$10$KwuQU3BAOaeDlP6CFHIpfOIXim8MzjW4jeW/KdGZS89hEsXBWzOym',
  'ADMIN',
  'Admin',
  'Séjour Jeunesse',
  true,
  true,
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;
