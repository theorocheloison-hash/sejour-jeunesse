-- Re-backfill de sécurité (Lot 2e) : rejeu VERBATIM du bloc c) de la migration
-- 20260806150000_abonnement_organisation. Referme la fenêtre L1→L2e pendant
-- laquelle demarrerOuAlignerTrial / register écrivaient l'abonnement sur le
-- CENTRE seul (pas encore sur l'org).
--
-- Idempotent par construction : le DISTINCT ON a un ordre TOTAL (déterministe),
-- l'UPDATE pose des valeurs absolues (aucun incrément). Rejouable sans effet de
-- bord ; no-op sur les organisations déjà à jour (chemins L2a en double écriture).
-- Aucune colonne / aucun index créé ici (déjà en place depuis L1).

WITH ref AS (
  SELECT DISTINCT ON (organisation_id)
         organisation_id,
         abonnement,
         abonnement_statut,
         abonnement_actif_jusqua,
         plan_abonnement,
         mollie_customer_id,
         mollie_subscription_id,
         mollie_mandat_id,
         trial_started_at,
         mode_paiement
    FROM "centres_hebergement"
   WHERE organisation_id IS NOT NULL
   ORDER BY organisation_id,
            (mollie_mandat_id IS NOT NULL) DESC,
            COALESCE(mode_paiement = 'VIREMENT', false) DESC,
            CASE plan_abonnement
              WHEN 'PILOTAGE'  THEN 3
              WHEN 'COMPLET'   THEN 2
              WHEN 'ESSENTIEL' THEN 1
              ELSE 0
            END DESC,
            abonnement_actif_jusqua DESC NULLS LAST,
            (statut <> 'SUSPENDED') DESC,
            created_at ASC,
            id ASC
),
alerte AS (
  SELECT organisation_id, MAX(dernier_email_alerte_at) AS max_alerte
    FROM "centres_hebergement"
   WHERE organisation_id IS NOT NULL
   GROUP BY organisation_id
)
UPDATE "organisations" o
   SET "abonnement"              = ref.abonnement,
       "abonnement_statut"       = ref.abonnement_statut,
       "abonnement_actif_jusqua" = ref.abonnement_actif_jusqua,
       "plan_abonnement"         = ref.plan_abonnement,
       "mollie_customer_id"      = ref.mollie_customer_id,
       "mollie_subscription_id"  = ref.mollie_subscription_id,
       "mollie_mandat_id"        = ref.mollie_mandat_id,
       "trial_started_at"        = ref.trial_started_at,
       "dernier_email_alerte_at" = alerte.max_alerte,
       "mode_paiement"           = ref.mode_paiement
  FROM ref
  JOIN alerte ON alerte.organisation_id = ref.organisation_id
 WHERE o.id = ref.organisation_id;
