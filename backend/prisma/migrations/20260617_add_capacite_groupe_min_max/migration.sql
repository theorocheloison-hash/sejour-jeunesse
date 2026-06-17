-- Fourchette de participants acceptée par un centre (filtre des demandes broadcast).
-- NULL = pas de filtre. Le total participants = nombreEleves + nombreAccompagnateurs.
ALTER TABLE "centres_hebergement" ADD COLUMN "capacite_groupe_min" INTEGER;
ALTER TABLE "centres_hebergement" ADD COLUMN "capacite_groupe_max" INTEGER;
