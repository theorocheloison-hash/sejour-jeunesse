-- 3c/3d : expiration des tokens d'accès publics (autorisation parentale & ordre de mission).
-- Idempotent : exécutable manuellement (scalingo pgsql-console) ET via `prisma migrate deploy`
-- sans double-application (ADD COLUMN IF NOT EXISTS + backfill gardé par IS NULL).

ALTER TABLE autorisations_parentales ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP;
ALTER TABLE accompagnateurs_missions ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP;

-- Backfill : on ne doit JAMAIS invalider un token déjà en circulation.
-- Règle : max(date_fin + 30j, NOW() + 30j) ; si date_fin NULL → created_at + 1 an.
UPDATE autorisations_parentales ap SET token_expires_at = GREATEST(COALESCE(s.date_fin + INTERVAL '30 days', ap.created_at + INTERVAL '365 days'), NOW() + INTERVAL '30 days') FROM sejours s WHERE s.id = ap.sejour_id AND ap.token_expires_at IS NULL;
UPDATE accompagnateurs_missions am SET token_expires_at = GREATEST(COALESCE(s.date_fin + INTERVAL '30 days', am.created_at + INTERVAL '365 days'), NOW() + INTERVAL '30 days') FROM sejours s WHERE s.id = am.sejour_id AND am.token_expires_at IS NULL;
