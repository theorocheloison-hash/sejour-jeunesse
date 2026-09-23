-- Nettoyage inscriptions 5b (23/09/2026) : colonnes retirées du schema Prisma par
-- 92e392e (champs_inscription centre, champs_personnalises) et 037fd32 (brochure_url).
-- Aucun lecteur ni écrivain. champs_personnalises vide en prod ; brochure_url dupliquée
-- dans brochure_url_sejour / brochure_url_evenement ; champs_inscription : 3 anciennes
-- configs centre, sans usage depuis le Lot 5b. Backup préalable : 6ab3d5b1998269f88bc14ca9.
ALTER TABLE "centres_hebergement" DROP COLUMN IF EXISTS "champs_inscription";
ALTER TABLE "centres_hebergement" DROP COLUMN IF EXISTS "brochure_url";
ALTER TABLE "autorisations_parentales" DROP COLUMN IF EXISTS "champs_personnalises";
