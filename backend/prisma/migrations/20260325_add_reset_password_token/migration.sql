ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "reset_password_token" UUID;
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "reset_password_expires" TIMESTAMP(3);
