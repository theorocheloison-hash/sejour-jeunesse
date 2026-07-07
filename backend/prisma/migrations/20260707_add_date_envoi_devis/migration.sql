-- Devis.dateEnvoi : date du dernier envoi du devis au client.
-- Backfill : les devis historiques sont réputés envoyés à leur création.
ALTER TABLE devis ADD COLUMN date_envoi TIMESTAMP(3);
UPDATE devis SET date_envoi = created_at;
