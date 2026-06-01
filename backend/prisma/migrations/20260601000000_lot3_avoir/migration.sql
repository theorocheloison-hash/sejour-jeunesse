-- Lot 3 : support avoirs (notes de crédit) sur l'entité Facture
-- typeFacture est déjà VARCHAR(20) — 'AVOIR' est une nouvelle valeur string, pas d'ALTER TYPE

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS facture_annulee_id UUID REFERENCES factures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motif_avoir TEXT;

-- UNIQUE partiel : relation 1-1 (au plus un avoir par facture), NULL multiples autorisés
CREATE UNIQUE INDEX IF NOT EXISTS idx_factures_facture_annulee
  ON factures (facture_annulee_id)
  WHERE facture_annulee_id IS NOT NULL;
