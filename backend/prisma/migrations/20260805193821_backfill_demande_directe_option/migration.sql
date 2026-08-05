-- Backfill : demandes CIBLÉES (centre_destinataire_id) dont le centre a déjà émis
-- un devis encore en course → le séjour resté SUBMITTED/non-rattaché passe en
-- OPTION rattaché au centre destinataire (aligné sur la nouvelle bascule à
-- l'envoi du devis dans devis.service.create).
UPDATE "sejours" s
SET "hebergement_selectionne_id" = d."centre_destinataire_id",
    "statut" = 'OPTION'
FROM "demandes_devis" d
WHERE d."sejour_id" = s."id"
  AND d."centre_destinataire_id" IS NOT NULL
  AND s."statut" = 'SUBMITTED'
  AND s."hebergement_selectionne_id" IS NULL
  AND s."deleted_at" IS NULL
  AND EXISTS (
    SELECT 1 FROM "devis" dv
    WHERE dv."demande_id" = d."id"
      AND dv."centre_id" = d."centre_destinataire_id"
      AND dv."statut" <> 'NON_RETENU'
  );
