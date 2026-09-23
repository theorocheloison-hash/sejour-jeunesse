-- Expiration glissante du lien public de signature (chantier révocation/expiration).
ALTER TABLE "devis" ADD COLUMN "lien_signature_expires_at" TIMESTAMP(3);

-- Backfill : liens armés à J+30 pour les devis encore OUVERTS à la signature
-- (miroir SQL de estDevisOuvertPourSignature : aucune trace de signature ET
-- statut non figé). Devis signés/figés laissés NULL (consultation illimitée).
UPDATE "devis" SET "lien_signature_expires_at" = NOW() + INTERVAL '30 days'
WHERE "nom_signataire_directeur" IS NULL
  AND "date_signature_directeur" IS NULL
  AND "signature_document_url" IS NULL
  AND "statut"::text NOT IN ('FACTURE_ACOMPTE','FACTURE_SOLDE','NON_RETENU');
