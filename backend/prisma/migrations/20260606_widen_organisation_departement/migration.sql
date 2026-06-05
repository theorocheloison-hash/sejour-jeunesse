-- Élargit organisations.departement de VARCHAR(10) à VARCHAR(100).
-- Les noms de département complets (ex. "Haute-Savoie" = 12 car.) issus de
-- l'import LMDJ dépassaient l'ancienne limite VARCHAR(10).
ALTER TABLE organisations ALTER COLUMN departement TYPE VARCHAR(100);
