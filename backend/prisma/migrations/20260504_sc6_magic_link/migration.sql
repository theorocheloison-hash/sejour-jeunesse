ALTER TABLE "utilisateurs"
  ADD COLUMN IF NOT EXISTS "magic_link_token" UUID,
  ADD COLUMN IF NOT EXISTS "magic_link_expires" TIMESTAMPTZ;
