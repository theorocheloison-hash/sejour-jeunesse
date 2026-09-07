-- Lot 2 onboarding : progression du tour organisateur (additif, aucun impact existant)
ALTER TABLE utilisateurs ADD COLUMN onboarding_tour_etape INTEGER NOT NULL DEFAULT 0;
