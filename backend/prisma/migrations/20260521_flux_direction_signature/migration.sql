-- Champs signature sans compte sur InvitationDirecteur
ALTER TABLE invitations_directeur ADD COLUMN IF NOT EXISTS nom_signataire TEXT;
ALTER TABLE invitations_directeur ADD COLUMN IF NOT EXISTS fonction_signataire TEXT;
ALTER TABLE invitations_directeur ADD COLUMN IF NOT EXISTS signe_at TIMESTAMP(3);
ALTER TABLE invitations_directeur ADD COLUMN IF NOT EXISTS signature_ip TEXT;

-- Champ document scanné signé sur Devis
ALTER TABLE devis ADD COLUMN IF NOT EXISTS signature_document_url TEXT;
