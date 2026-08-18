ALTER TABLE factures_liavo ADD COLUMN destinataire_nom VARCHAR(255);
ALTER TABLE factures_liavo ADD COLUMN destinataire_adresse TEXT;
ALTER TABLE factures_liavo ADD COLUMN destinataire_siret VARCHAR(14);
ALTER TABLE factures_liavo ADD COLUMN destinataire_email VARCHAR(255);
ALTER TABLE factures_liavo ADD COLUMN date_echeance TIMESTAMP(3);
