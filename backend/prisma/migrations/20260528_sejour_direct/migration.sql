-- Enum : ajout OPTION à StatutSejour
ALTER TYPE "StatutSejour" ADD VALUE IF NOT EXISTS 'OPTION' AFTER 'DRAFT';

-- Sejour : nouveaux champs gestion directe
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS mode_gestion VARCHAR(20) NOT NULL DEFAULT 'COLLABORATIF';
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS nature_sejour VARCHAR(20) NOT NULL DEFAULT 'SEJOUR';
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS type_sejour VARCHAR(30);
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS client_nom VARCHAR(255);
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS client_prenom VARCHAR(255);
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS client_email VARCHAR(255);
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS client_telephone VARCHAR(30);
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS client_organisation VARCHAR(255);
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS client_organisation_id UUID;
ALTER TABLE sejours ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index soft delete
CREATE INDEX IF NOT EXISTS idx_sejours_deleted_at ON sejours (deleted_at) WHERE deleted_at IS NULL;
-- Index nature_sejour pour filtrage
CREATE INDEX IF NOT EXISTS idx_sejours_nature ON sejours (nature_sejour);
-- Index mode_gestion
CREATE INDEX IF NOT EXISTS idx_sejours_mode_gestion ON sejours (mode_gestion);

-- Devis : demandeId nullable
ALTER TABLE devis ALTER COLUMN demande_id DROP NOT NULL;

-- Devis : lien direct séjour
ALTER TABLE devis ADD COLUMN IF NOT EXISTS sejour_direct_id UUID REFERENCES sejours(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_devis_sejour_direct ON devis (sejour_direct_id) WHERE sejour_direct_id IS NOT NULL;

-- Devis : token signature
ALTER TABLE devis ADD COLUMN IF NOT EXISTS token_signature UUID UNIQUE DEFAULT gen_random_uuid();
-- Backfill tokens pour devis existants
UPDATE devis SET token_signature = gen_random_uuid() WHERE token_signature IS NULL;
