-- ============================================================================
-- Backfill produit_catalogue_id sur lignes_devis — centre "Le Sauvageon"
-- ============================================================================
-- ⚠️  EXÉCUTION MANUELLE UNIQUEMENT via : scalingo --app liavo-backend --region osc-fr1 pgsql-console
-- ⚠️  Le matching par LIKE est APPROXIMATIF. Vérifier chaque UPDATE avant de le lancer.
-- ⚠️  Lancer dans une TRANSACTION et contrôler le nombre de lignes touchées avant COMMIT.
--
-- Contexte : avant l'ajout de la colonne produit_catalogue_id, les lignes de devis
-- copiaient le nom du produit catalogue en texte libre. Ce script tente de retrouver
-- l'origine catalogue par correspondance de nom (description LIKE %nom_produit%).
-- ============================================================================

-- ── Étape 0 : résoudre l'id du centre Sauvageon ──────────────────────────────
-- Exécuter d'abord et noter l'id :
SELECT id, nom FROM centres_hebergement WHERE nom ILIKE '%sauvageon%';

-- ── Étape 1 : lister les produits catalogue du Sauvageon ─────────────────────
-- Remplacer '<SAUVAGEON_CENTRE_ID>' par l'id obtenu à l'étape 0.
SELECT id, nom, type, prix_unitaire_ht
FROM produits_catalogue
WHERE centre_id = '<SAUVAGEON_CENTRE_ID>'
ORDER BY nom;

-- ── Étape 2 : aperçu AVANT modification (à exécuter pour CHAQUE produit) ──────
-- Pour chaque produit, vérifier quelles lignes seraient touchées AVANT l'UPDATE.
-- Remplacer <PRODUIT_ID> et <PRODUIT_NOM> par les valeurs de l'étape 1.
SELECT ld.id, ld.description, d.numero_devis
FROM lignes_devis ld
JOIN devis d ON d.id = ld.devis_id
WHERE d.centre_id = '<SAUVAGEON_CENTRE_ID>'
  AND ld.produit_catalogue_id IS NULL
  AND LOWER(ld.description) LIKE LOWER('%<PRODUIT_NOM>%');

-- ── Étape 3 : UPDATE par produit ─────────────────────────────────────────────
-- Lancer dans une transaction. Adapter une ligne par produit catalogue.
-- VERIFIER le nombre de lignes touchées (doit correspondre à l'aperçu étape 2).

BEGIN;

-- VERIFIER : produit « <PRODUIT_NOM_1> »
UPDATE lignes_devis ld
SET produit_catalogue_id = '<PRODUIT_ID_1>'
FROM devis d
WHERE ld.devis_id = d.id
  AND d.centre_id = '<SAUVAGEON_CENTRE_ID>'
  AND ld.produit_catalogue_id IS NULL
  AND LOWER(ld.description) LIKE LOWER('%<PRODUIT_NOM_1>%');

-- VERIFIER : produit « <PRODUIT_NOM_2> »
UPDATE lignes_devis ld
SET produit_catalogue_id = '<PRODUIT_ID_2>'
FROM devis d
WHERE ld.devis_id = d.id
  AND d.centre_id = '<SAUVAGEON_CENTRE_ID>'
  AND ld.produit_catalogue_id IS NULL
  AND LOWER(ld.description) LIKE LOWER('%<PRODUIT_NOM_2>%');

-- … dupliquer le bloc UPDATE ci-dessus pour chaque produit listé à l'étape 1 …

-- ── Contrôle final avant COMMIT ──────────────────────────────────────────────
-- Vérifier le total de lignes rattachées vs restées NULL :
SELECT
  COUNT(*) FILTER (WHERE ld.produit_catalogue_id IS NOT NULL) AS rattachees,
  COUNT(*) FILTER (WHERE ld.produit_catalogue_id IS NULL)     AS sans_produit
FROM lignes_devis ld
JOIN devis d ON d.id = ld.devis_id
WHERE d.centre_id = '<SAUVAGEON_CENTRE_ID>';

-- Si le résultat est cohérent :
-- COMMIT;
-- Sinon :
-- ROLLBACK;
