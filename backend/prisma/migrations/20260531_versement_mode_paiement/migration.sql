-- Étendre l'enum MethodePaiement avec CHEQUES_VACANCES et passer en MAJUSCULES
-- PostgreSQL : ALTER TYPE ... ADD VALUE ne peut pas être dans une transaction

-- 1. Renommer l'ancien enum
ALTER TYPE "MethodePaiement" RENAME TO "MethodePaiement_old";

-- 2. Créer le nouvel enum avec toutes les valeurs en MAJUSCULES
CREATE TYPE "MethodePaiement" AS ENUM ('CARTE', 'VIREMENT', 'CHEQUE', 'ESPECES', 'CHEQUES_VACANCES');

-- 3. Migrer la colonne existante sur la table paiements
ALTER TABLE "paiements"
  ALTER COLUMN "methode" TYPE "MethodePaiement"
  USING (
    CASE "methode"::text
      WHEN 'carte' THEN 'CARTE'::"MethodePaiement"
      WHEN 'virement' THEN 'VIREMENT'::"MethodePaiement"
      WHEN 'cheque' THEN 'CHEQUE'::"MethodePaiement"
      WHEN 'especes' THEN 'ESPECES'::"MethodePaiement"
      ELSE NULL
    END
  );

-- 4. Supprimer l'ancien enum
DROP TYPE "MethodePaiement_old";

-- 5. Ajouter la colonne sur versements_paiement
ALTER TABLE "versements_paiement" ADD COLUMN "mode_paiement" "MethodePaiement";
