ALTER TABLE devis ADD COLUMN is_complementaire BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE devis ADD COLUMN destinataire_nom VARCHAR(255);
ALTER TABLE devis ADD COLUMN destinataire_adresse TEXT;
ALTER TABLE devis ADD COLUMN destinataire_code_postal VARCHAR(10);
ALTER TABLE devis ADD COLUMN destinataire_ville VARCHAR(255);
ALTER TABLE devis ADD COLUMN destinataire_siret VARCHAR(14);
ALTER TABLE devis ADD COLUMN destinataire_email VARCHAR(255);
