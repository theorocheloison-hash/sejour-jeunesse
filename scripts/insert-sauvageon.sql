-- ============================================================
-- Script : Fiche Centre "Chalet Le Sauvageon" en BDD Railway
-- À exécuter après la migration Prisma (add-centre-fields)
-- ============================================================

-- 1. Insérer la fiche CentreHebergement
INSERT INTO centres_hebergement (
  id, nom, adresse, ville, code_postal, telephone, email,
  capacite, description, user_id, statut, abonnement_statut,
  siret, departement, agrement_education_nationale, type_sejours,
  created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Chalet Le Sauvageon',
  '472 route du Mas Devant',
  'Morillon',
  '74440',
  '+33 6 74 94 81 82',
  'resa@lesauvageon.com',
  120,
  'Chalet montagnard authentique en vallée du Giffre, idéal pour séjours scolaires, classes de neige et colonies de vacances. Capacité de 120 personnes, cadre naturel exceptionnel.',
  (SELECT id FROM utilisateurs WHERE email = 'contact@chalet-sauvageon.fr'),
  'ACTIVE',
  'ACTIF',
  '953632031',
  'Haute-Savoie',
  'N°40519003',
  ARRAY['scolaire', 'colo', 'classe_neige', 'classe_decouverte'],
  NOW(), NOW()
);

-- 2. Vérification
SELECT id, nom, ville, statut, abonnement_statut, siret, departement, agrement_education_nationale
FROM centres_hebergement
WHERE user_id = (SELECT id FROM utilisateurs WHERE email = 'contact@chalet-sauvageon.fr');
