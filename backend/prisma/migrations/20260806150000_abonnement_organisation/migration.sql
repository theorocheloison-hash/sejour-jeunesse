-- Lot 1 « abonnement porté par l'Organisation » (design : docs/census-lot1-schema-backfill.md).
-- Migration ADDITIVE : aucun DROP de colonne, aucun NOT NULL sans DEFAULT. Les colonnes
-- d'abonnement des centres restent en place (double-lecture transitoire — seul le centre
-- fait foi tant que les Lots 2-3 n'ont pas basculé le code).
-- Pas de BEGIN/COMMIT : prisma migrate deploy enveloppe déjà cette migration dans sa
-- propre transaction.

-- ── a) Miroir des 10 colonnes d'abonnement sur organisations ─────────────────
ALTER TABLE "organisations"
  ADD COLUMN "abonnement"              "TypeAbonnement",
  ADD COLUMN "abonnement_statut"       "StatutAbonnement" NOT NULL DEFAULT 'INACTIF',
  ADD COLUMN "abonnement_actif_jusqua" DATE,
  ADD COLUMN "plan_abonnement"         "PlanAbonnement" NOT NULL DEFAULT 'DECOUVERTE',
  ADD COLUMN "mollie_customer_id"      VARCHAR(50),
  ADD COLUMN "mollie_subscription_id"  VARCHAR(50),
  ADD COLUMN "mollie_mandat_id"        VARCHAR(50),
  ADD COLUMN "trial_started_at"        TIMESTAMP(3),
  ADD COLUMN "dernier_email_alerte_at" TIMESTAMP(3),
  ADD COLUMN "mode_paiement"           "ModePaiement";

-- ── b) Unicité Mollie : index uniques PARTIELS (les NULL ne comptent pas) ────
-- Garantit qu'un customer/mandat/subscription Mollie ne peut pointer que vers UNE
-- organisation (résolution du webhook). Non modélisable en Prisma (index partiel) :
-- l'unicité vit ici, PAS de @unique dans schema.prisma (divergerait sur les NULL).
CREATE UNIQUE INDEX "organisations_mollie_customer_id_key"
  ON "organisations" ("mollie_customer_id") WHERE "mollie_customer_id" IS NOT NULL;
CREATE UNIQUE INDEX "organisations_mollie_subscription_id_key"
  ON "organisations" ("mollie_subscription_id") WHERE "mollie_subscription_id" IS NOT NULL;
CREATE UNIQUE INDEX "organisations_mollie_mandat_id_key"
  ON "organisations" ("mollie_mandat_id") WHERE "mollie_mandat_id" IS NOT NULL;

-- ── c) Backfill état d'abonnement centre → organisation ──────────────────────
-- Un centre « référence » par organisation via un classement TOTAL (déterministe,
-- rejouable) : mandat Mollie > paiement VIREMENT > plan le plus avancé > expiration
-- la plus lointaine > non-SUSPENDED > created_at > id. Contrôle pré-backfill exécuté
-- le 06/08/2026 : 0 organisation divergente (les 2 orgs multi-centres sont alignées).
-- Exception : dernier_email_alerte_at = MAX() sur les centres de l'org (tampon
-- anti-spam du cron — le max supprime tout risque de ré-alerte au premier cron).
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

-- ── d) factures_liavo : re-parentage organisation + fin du Cascade destructeur ─
-- Une facture émise est une pièce comptable : elle doit SURVIVRE à la suppression
-- de son centre (l'ancien ON DELETE CASCADE la détruisait). Le débiteur légal
-- devient l'organisation (RESTRICT : une org avec factures n'est pas supprimable).
ALTER TABLE "factures_liavo" ADD COLUMN "organisation_id" UUID;

ALTER TABLE "factures_liavo"
  ADD CONSTRAINT "factures_liavo_organisation_id_fkey"
  FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "factures_liavo_organisation_id_idx" ON "factures_liavo"("organisation_id");

ALTER TABLE "factures_liavo" DROP CONSTRAINT "factures_liavo_centre_id_fkey";
ALTER TABLE "factures_liavo" ALTER COLUMN "centre_id" DROP NOT NULL;
ALTER TABLE "factures_liavo"
  ADD CONSTRAINT "factures_liavo_centre_id_fkey"
  FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (no-op au 06/08/2026 : 0 facture en prod)
UPDATE "factures_liavo" f
   SET "organisation_id" = c."organisation_id"
  FROM "centres_hebergement" c
 WHERE f."centre_id" = c."id"
   AND f."organisation_id" IS NULL;

-- ── e) acceptations_cgv : organisation_id additif (centre_id inchangé) ────────
ALTER TABLE "acceptations_cgv" ADD COLUMN "organisation_id" UUID;

ALTER TABLE "acceptations_cgv"
  ADD CONSTRAINT "acceptations_cgv_organisation_id_fkey"
  FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "acceptations_cgv_organisation_id_idx" ON "acceptations_cgv"("organisation_id");

-- Backfill (no-op au 06/08/2026 : 0 acceptation en prod)
UPDATE "acceptations_cgv" a
   SET "organisation_id" = c."organisation_id"
  FROM "centres_hebergement" c
 WHERE a."centre_id" = c."id"
   AND a."organisation_id" IS NULL;
