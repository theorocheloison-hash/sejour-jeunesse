-- ============================================================================
-- Backfill produit_catalogue_id sur lignes_devis — Centre Le Sauvageon
-- ============================================================================
-- ⚠️  EXÉCUTION : scalingo --app liavo-backend --region osc-fr1 pgsql-console
-- ⚠️  Copier-coller le script EN ENTIER dans la console.
-- ⚠️  Le COMMIT est commenté — vérifier les résultats avant de décommenter.
-- ============================================================================
-- STRATÉGIE :
-- 1. Matching prioritaire par longueur (le nom de produit le plus long gagne)
-- 2. Normalisation des accents avec translate() (è→e, é→e, ê→e, etc.)
--    pour que "Pension complète" matche "PENSION COMPLETE 5 jours Jr"
-- ============================================================================

-- Helper : normalise accents + minuscules
-- Usage : norm(text) retourne du texte sans accents en minuscules
-- On ne crée PAS de fonction SQL (pas de droit CREATE FUNCTION sur Scalingo).
-- On inline la normalisation dans chaque requête.
-- Pattern : translate(LOWER(x), 'àâäéèêëïîôùûüçñ', 'aaaeeeeiioouucn')

BEGIN;

-- ── Étape 1 : aperçu des produits + nombre de lignes qui matchent ────────────
SELECT
  pc.id,
  pc.nom,
  pc.type,
  LENGTH(pc.nom) AS len,
  (SELECT COUNT(*)
   FROM lignes_devis ld
   JOIN devis d ON d.id = ld.devis_id
   WHERE d.centre_id = pc.centre_id
     AND ld.produit_catalogue_id IS NULL
     AND translate(LOWER(ld.description), 'àâäéèêëïîôùûüçñ', 'aaaeeeeiioouucn')
         LIKE '%' || translate(LOWER(pc.nom), 'àâäéèêëïîôùûüçñ', 'aaaeeeeiioouucn') || '%'
  ) AS lignes_matchees
FROM produits_catalogue pc
JOIN centres_hebergement ch ON ch.id = pc.centre_id
WHERE ch.nom ILIKE '%sauvageon%'
ORDER BY LENGTH(pc.nom) DESC;

-- ── Étape 2 : preview du matching (le plus long gagne) ──────────────────────
-- Cette requête montre EXACTEMENT ce que l'UPDATE fera.
WITH matches AS (
  SELECT
    ld.id AS ligne_id,
    ld.description,
    pc.id AS produit_id,
    pc.nom AS produit_nom,
    LENGTH(pc.nom) AS match_longueur,
    ROW_NUMBER() OVER (
      PARTITION BY ld.id
      ORDER BY LENGTH(pc.nom) DESC
    ) AS rang
  FROM lignes_devis ld
  JOIN devis d ON d.id = ld.devis_id
  JOIN centres_hebergement ch ON ch.id = d.centre_id
  JOIN produits_catalogue pc ON pc.centre_id = ch.id
  WHERE ch.nom ILIKE '%sauvageon%'
    AND ld.produit_catalogue_id IS NULL
    AND translate(LOWER(ld.description), 'àâäéèêëïîôùûüçñ', 'aaaeeeeiioouucn')
        LIKE '%' || translate(LOWER(pc.nom), 'àâäéèêëïîôùûüçñ', 'aaaeeeeiioouucn') || '%'
)
SELECT ligne_id, description, produit_nom, match_longueur
FROM matches
WHERE rang = 1
ORDER BY produit_nom, description;

-- ── Étape 3 : UPDATE avec matching prioritaire + accents normalisés ─────────
WITH best_match AS (
  SELECT
    ld.id AS ligne_id,
    pc.id AS produit_id,
    ROW_NUMBER() OVER (
      PARTITION BY ld.id
      ORDER BY LENGTH(pc.nom) DESC
    ) AS rang
  FROM lignes_devis ld
  JOIN devis d ON d.id = ld.devis_id
  JOIN centres_hebergement ch ON ch.id = d.centre_id
  JOIN produits_catalogue pc ON pc.centre_id = ch.id
  WHERE ch.nom ILIKE '%sauvageon%'
    AND ld.produit_catalogue_id IS NULL
    AND translate(LOWER(ld.description), 'àâäéèêëïîôùûüçñ', 'aaaeeeeiioouucn')
        LIKE '%' || translate(LOWER(pc.nom), 'àâäéèêëïîôùûüçñ', 'aaaeeeeiioouucn') || '%'
)
UPDATE lignes_devis ld
SET produit_catalogue_id = bm.produit_id
FROM best_match bm
WHERE ld.id = bm.ligne_id
  AND bm.rang = 1;

-- ── Étape 4 : contrôle global ───────────────────────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE ld.produit_catalogue_id IS NOT NULL) AS rattachees,
  COUNT(*) FILTER (WHERE ld.produit_catalogue_id IS NULL) AS sans_produit,
  COUNT(*) AS total
FROM lignes_devis ld
JOIN devis d ON d.id = ld.devis_id
JOIN centres_hebergement ch ON ch.id = d.centre_id
WHERE ch.nom ILIKE '%sauvageon%';

-- ── Étape 5 : lignes NON rattachées (diagnostic) ───────────────────────────
SELECT ld.description, d.numero_devis
FROM lignes_devis ld
JOIN devis d ON d.id = ld.devis_id
JOIN centres_hebergement ch ON ch.id = d.centre_id
WHERE ch.nom ILIKE '%sauvageon%'
  AND ld.produit_catalogue_id IS NULL
ORDER BY ld.description
LIMIT 30;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFIER :
-- 1. Étape 1 — les compteurs "lignes_matchees" font sens ?
-- 2. Étape 2 — chaque ligne est rattachée au BON produit ?
-- 3. Étape 4 — le ratio rattachées/sans_produit est cohérent ?
-- 4. Étape 5 — rien d'important dans les orphelines ?
--
-- Si OK, décommenter COMMIT et relancer :
-- COMMIT;
-- Sinon :
ROLLBACK;
