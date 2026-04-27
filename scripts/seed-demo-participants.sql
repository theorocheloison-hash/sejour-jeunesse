-- ============================================================
-- SEED PARTICIPANTS DÉMO — 48 élèves + 5 accompagnateurs
-- ============================================================
-- INSTRUCTIONS :
-- 1. Créer le séjour via l'interface LIAVO (enseignant@test.fr)
-- 2. Récupérer le sejour_id depuis l'URL du séjour
-- 3. Remplacer XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX ci-dessous
-- 4. Exécuter dans Railway > onglet Query
-- ============================================================

DO $$
DECLARE
  v_sejour_id UUID := '1e932c79-8409-4ebe-83a3-0c20eccea38b';
  v_venue_user_id UUID;
BEGIN

-- Vérification
IF NOT EXISTS (SELECT 1 FROM sejours WHERE id = v_sejour_id) THEN
  RAISE EXCEPTION 'Séjour % introuvable — vérifier le sejour_id', v_sejour_id;
END IF;

SELECT id INTO v_venue_user_id FROM utilisateurs WHERE email = 'resa@lesauvageon.com';
IF v_venue_user_id IS NULL THEN
  RAISE EXCEPTION 'Utilisateur resa@lesauvageon.com introuvable';
END IF;

-- ============================================================
-- ACCOMPAGNATEURS (5) — 3 signés, 2 en attente
-- ============================================================
INSERT INTO accompagnateurs_missions (id, sejour_id, prenom, nom, email, telephone, contact_urgence_nom, contact_urgence_tel, token_acces, signee_at, signature_nom, moyen_transport, created_at) VALUES
  (gen_random_uuid(), v_sejour_id, 'Marie', 'DUBOIS', 'marie.dubois@college-hugo.fr', '06 12 34 56 78', 'Pierre Dubois', '06 98 76 54 32', gen_random_uuid(), NOW() - INTERVAL '5 days', 'Marie DUBOIS', 'CARS', NOW()),
  (gen_random_uuid(), v_sejour_id, 'Thomas', 'MARTIN', 'thomas.martin@college-hugo.fr', '06 23 45 67 89', 'Claire Martin', '06 87 65 43 21', gen_random_uuid(), NOW() - INTERVAL '4 days', 'Thomas MARTIN', 'CARS', NOW()),
  (gen_random_uuid(), v_sejour_id, 'Nathalie', 'GIRARD', 'nathalie.girard@college-hugo.fr', '06 34 56 78 90', 'Marc Girard', '06 76 54 32 10', gen_random_uuid(), NOW() - INTERVAL '3 days', 'Nathalie GIRARD', 'CARS', NOW()),
  (gen_random_uuid(), v_sejour_id, 'Philippe', 'LEFEVRE', 'philippe.lefevre@college-hugo.fr', '06 45 67 89 01', NULL, NULL, gen_random_uuid(), NULL, NULL, NULL, NOW()),
  (gen_random_uuid(), v_sejour_id, 'Sophie', 'BERNARD', 'sophie.bernard@college-hugo.fr', '06 56 78 90 12', NULL, NULL, gen_random_uuid(), NULL, NULL, NULL, NOW());

-- ============================================================
-- AUTORISATIONS PARENTALES (48 élèves)
-- 35 signés + payés | 8 signés non payés | 5 non signés
-- ============================================================
INSERT INTO autorisations_parentales (id, sejour_id, eleve_nom, eleve_prenom, parent_email, token_acces, signee_at, taille, poids, pointure, regime_alimentaire, niveau_ski, infos_medicales, rgpd_accepte, nombre_mensualites, moyen_paiement, paiement_valide, nom_parent, telephone_urgence, eleve_date_naissance, created_at) VALUES
-- === 35 SIGNÉS ET PAYÉS ===
(gen_random_uuid(), v_sejour_id, 'LEROY', 'Emma', 'isabelle.leroy@gmail.com', gen_random_uuid(), NOW()-INTERVAL '10 days', 162, 52, 37, NULL, NULL, NULL, true, 2, 'virement', true, 'Isabelle LEROY', '06 11 22 33 44', '2012-05-14', NOW()),
(gen_random_uuid(), v_sejour_id, 'PETIT', 'Lucas', 'jean.petit@gmail.com', gen_random_uuid(), NOW()-INTERVAL '9 days', 168, 58, 41, NULL, NULL, 'Allergie arachides sévère — Epipen dans trousse, protocole PAI fourni', true, 1, 'carte', true, 'Jean-Paul PETIT', '06 55 44 33 22', '2012-02-28', NOW()),
(gen_random_uuid(), v_sejour_id, 'MOREAU', 'Chloé', 'anne.moreau@gmail.com', gen_random_uuid(), NOW()-INTERVAL '9 days', 158, 48, 36, 'Végétarienne', NULL, NULL, true, 3, 'virement', true, 'Anne MOREAU', '06 77 88 99 00', '2012-09-10', NOW()),
(gen_random_uuid(), v_sejour_id, 'SIMON', 'Nathan', 'eric.simon@gmail.com', gen_random_uuid(), NOW()-INTERVAL '8 days', 171, 62, 42, NULL, NULL, NULL, true, 1, 'carte', true, 'Éric SIMON', '06 33 44 55 66', '2012-07-22', NOW()),
(gen_random_uuid(), v_sejour_id, 'LAMBERT', 'Inès', 'sophie.lambert@gmail.com', gen_random_uuid(), NOW()-INTERVAL '8 days', 155, 46, 36, NULL, NULL, NULL, true, 2, 'virement', true, 'Sophie LAMBERT', '06 22 11 00 99', '2012-11-03', NOW()),
(gen_random_uuid(), v_sejour_id, 'DUPONT', 'Léa', 'marc.dupont@gmail.com', gen_random_uuid(), NOW()-INTERVAL '8 days', 160, 50, 37, NULL, NULL, NULL, true, 1, 'carte', true, 'Marc DUPONT', '06 99 88 77 66', '2013-01-18', NOW()),
(gen_random_uuid(), v_sejour_id, 'MARTIN', 'Hugo', 'christine.martin@gmail.com', gen_random_uuid(), NOW()-INTERVAL '7 days', 172, 63, 42, NULL, NULL, NULL, true, 2, 'virement', true, 'Christine MARTIN', '06 44 55 66 77', '2012-03-25', NOW()),
(gen_random_uuid(), v_sejour_id, 'BERNARD', 'Alice', 'pascal.bernard@gmail.com', gen_random_uuid(), NOW()-INTERVAL '7 days', 157, 47, 36, 'Sans gluten', NULL, NULL, true, 1, 'carte', true, 'Pascal BERNARD', '06 88 77 66 55', '2012-08-12', NOW()),
(gen_random_uuid(), v_sejour_id, 'ROBERT', 'Jules', 'valerie.robert@gmail.com', gen_random_uuid(), NOW()-INTERVAL '7 days', 174, 65, 43, NULL, NULL, NULL, true, 3, 'virement', true, 'Valérie ROBERT', '06 66 55 44 33', '2012-12-05', NOW()),
(gen_random_uuid(), v_sejour_id, 'RICHARD', 'Manon', 'philippe.richard@gmail.com', gen_random_uuid(), NOW()-INTERVAL '7 days', 161, 51, 37, NULL, NULL, NULL, true, 1, 'carte', true, 'Philippe RICHARD', '06 11 33 55 77', '2013-04-09', NOW()),
(gen_random_uuid(), v_sejour_id, 'DURAND', 'Tom', 'nathalie.durand@gmail.com', gen_random_uuid(), NOW()-INTERVAL '6 days', 169, 59, 41, NULL, NULL, NULL, true, 2, 'virement', true, 'Nathalie DURAND', '06 22 44 66 88', '2012-06-30', NOW()),
(gen_random_uuid(), v_sejour_id, 'DUBOIS', 'Camille', 'laurent.dubois@gmail.com', gen_random_uuid(), NOW()-INTERVAL '6 days', 163, 53, 38, NULL, NULL, NULL, true, 1, 'carte', true, 'Laurent DUBOIS', '06 33 55 77 99', '2012-10-17', NOW()),
(gen_random_uuid(), v_sejour_id, 'GIRARD', 'Raphaël', 'sylvie.girard@gmail.com', gen_random_uuid(), NOW()-INTERVAL '6 days', 170, 61, 42, NULL, NULL, NULL, true, 2, 'virement', true, 'Sylvie GIRARD', '06 44 66 88 00', '2013-02-14', NOW()),
(gen_random_uuid(), v_sejour_id, 'MERCIER', 'Zoé', 'franck.mercier@gmail.com', gen_random_uuid(), NOW()-INTERVAL '6 days', 156, 45, 36, NULL, NULL, 'Diabète type 1 — pompe à insuline, kit glycémie dans sac, protocole PAI fourni', true, 1, 'carte', true, 'Franck MERCIER', '06 55 77 99 11', '2012-04-23', NOW()),
(gen_random_uuid(), v_sejour_id, 'FAURE', 'Théo', 'catherine.faure@gmail.com', gen_random_uuid(), NOW()-INTERVAL '5 days', 175, 66, 43, NULL, NULL, NULL, true, 3, 'virement', true, 'Catherine FAURE', '06 66 88 00 22', '2012-01-07', NOW()),
(gen_random_uuid(), v_sejour_id, 'MOREL', 'Jade', 'olivier.morel@gmail.com', gen_random_uuid(), NOW()-INTERVAL '5 days', 159, 49, 37, NULL, NULL, NULL, true, 1, 'carte', true, 'Olivier MOREL', '06 77 99 11 33', '2013-05-20', NOW()),
(gen_random_uuid(), v_sejour_id, 'FOURNIER', 'Enzo', 'marie.fournier@gmail.com', gen_random_uuid(), NOW()-INTERVAL '5 days', 173, 64, 43, NULL, NULL, NULL, true, 2, 'virement', true, 'Marie FOURNIER', '06 88 00 22 44', '2012-07-15', NOW()),
(gen_random_uuid(), v_sejour_id, 'LEFEVRE', 'Sarah', 'bruno.lefevre@gmail.com', gen_random_uuid(), NOW()-INTERVAL '5 days', 164, 54, 38, NULL, NULL, NULL, true, 1, 'carte', true, 'Bruno LEFÈVRE', '06 99 11 33 55', '2012-11-28', NOW()),
(gen_random_uuid(), v_sejour_id, 'ROUX', 'Maxime', 'sandrine.roux@gmail.com', gen_random_uuid(), NOW()-INTERVAL '4 days', 176, 67, 43, NULL, NULL, 'Asthme effort — Ventoline dans trousse', true, 2, 'virement', true, 'Sandrine ROUX', '06 00 22 44 66', '2012-09-03', NOW()),
(gen_random_uuid(), v_sejour_id, 'DAVID', 'Lola', 'thierry.david@gmail.com', gen_random_uuid(), NOW()-INTERVAL '4 days', 153, 44, 35, NULL, NULL, NULL, true, 1, 'carte', true, 'Thierry DAVID', '06 11 33 55 77', '2013-03-11', NOW()),
(gen_random_uuid(), v_sejour_id, 'BONNET', 'Adam', 'veronique.bonnet@gmail.com', gen_random_uuid(), NOW()-INTERVAL '4 days', 167, 57, 40, NULL, NULL, NULL, true, 3, 'virement', true, 'Véronique BONNET', '06 22 44 66 88', '2012-06-19', NOW()),
(gen_random_uuid(), v_sejour_id, 'MASSON', 'Clara', 'patrick.masson@gmail.com', gen_random_uuid(), NOW()-INTERVAL '4 days', 160, 50, 37, 'Allergie lait de vache', NULL, NULL, true, 1, 'carte', true, 'Patrick MASSON', '06 33 55 77 99', '2012-12-24', NOW()),
(gen_random_uuid(), v_sejour_id, 'GARNIER', 'Léo', 'caroline.garnier@gmail.com', gen_random_uuid(), NOW()-INTERVAL '3 days', 171, 62, 42, NULL, NULL, NULL, true, 2, 'virement', true, 'Caroline GARNIER', '06 44 66 88 00', '2013-01-30', NOW()),
(gen_random_uuid(), v_sejour_id, 'CLEMENT', 'Louise', 'didier.clement@gmail.com', gen_random_uuid(), NOW()-INTERVAL '3 days', 158, 48, 36, NULL, NULL, NULL, true, 1, 'carte', true, 'Didier CLÉMENT', '06 55 77 99 11', '2012-08-06', NOW()),
(gen_random_uuid(), v_sejour_id, 'PERRIN', 'Mathis', 'helene.perrin@gmail.com', gen_random_uuid(), NOW()-INTERVAL '3 days', 174, 65, 43, NULL, NULL, NULL, true, 2, 'virement', true, 'Hélène PERRIN', '06 66 88 00 22', '2012-04-14', NOW()),
(gen_random_uuid(), v_sejour_id, 'ANDRE', 'Margot', 'dominique.andre@gmail.com', gen_random_uuid(), NOW()-INTERVAL '3 days', 162, 52, 37, NULL, NULL, NULL, true, 1, 'carte', true, 'Dominique ANDRÉ', '06 77 99 11 33', '2013-07-27', NOW()),
(gen_random_uuid(), v_sejour_id, 'CARON', 'Arthur', 'isabelle.caron@gmail.com', gen_random_uuid(), NOW()-INTERVAL '3 days', 170, 60, 41, NULL, NULL, NULL, true, 3, 'virement', true, 'Isabelle CARON', '06 88 00 22 44', '2012-10-08', NOW()),
(gen_random_uuid(), v_sejour_id, 'PICARD', 'Eva', 'jean.picard@gmail.com', gen_random_uuid(), NOW()-INTERVAL '2 days', 155, 46, 36, NULL, NULL, NULL, true, 1, 'carte', true, 'Jean PICARD', '06 99 11 33 55', '2012-02-19', NOW()),
(gen_random_uuid(), v_sejour_id, 'HENRY', 'Ethan', 'florence.henry@gmail.com', gen_random_uuid(), NOW()-INTERVAL '2 days', 177, 68, 43, NULL, NULL, NULL, true, 2, 'virement', true, 'Florence HENRY', '06 10 32 54 76', '2012-05-31', NOW()),
(gen_random_uuid(), v_sejour_id, 'BOYER', 'Lilou', 'stephane.boyer@gmail.com', gen_random_uuid(), NOW()-INTERVAL '2 days', 152, 43, 35, 'Allergie fruits à coque', NULL, NULL, true, 1, 'carte', true, 'Stéphane BOYER', '06 21 43 65 87', '2013-09-16', NOW()),
(gen_random_uuid(), v_sejour_id, 'BLANCHARD', 'Louis', 'agnes.blanchard@gmail.com', gen_random_uuid(), NOW()-INTERVAL '2 days', 173, 64, 42, NULL, NULL, NULL, true, 2, 'virement', true, 'Agnès BLANCHARD', '06 32 54 76 98', '2012-11-22', NOW()),
(gen_random_uuid(), v_sejour_id, 'CHEVALIER', 'Romane', 'yves.chevalier@gmail.com', gen_random_uuid(), NOW()-INTERVAL '2 days', 161, 51, 37, NULL, NULL, NULL, true, 1, 'carte', true, 'Yves CHEVALIER', '06 43 65 87 09', '2013-06-04', NOW()),
(gen_random_uuid(), v_sejour_id, 'LEGRAND', 'Paul', 'muriel.legrand@gmail.com', gen_random_uuid(), NOW()-INTERVAL '1 day', 169, 59, 41, NULL, NULL, NULL, true, 3, 'virement', true, 'Muriel LEGRAND', '06 54 76 98 10', '2012-03-13', NOW()),
(gen_random_uuid(), v_sejour_id, 'AUBERT', 'Anaïs', 'claude.aubert@gmail.com', gen_random_uuid(), NOW()-INTERVAL '1 day', 157, 47, 36, NULL, NULL, NULL, true, 1, 'carte', true, 'Claude AUBERT', '06 65 87 09 21', '2012-08-29', NOW()),
(gen_random_uuid(), v_sejour_id, 'GAILLARD', 'Noah', 'martine.gaillard@gmail.com', gen_random_uuid(), NOW()-INTERVAL '1 day', 175, 66, 43, NULL, NULL, NULL, true, 2, 'virement', true, 'Martine GAILLARD', '06 76 98 10 32', '2013-01-15', NOW()),

-- === 8 SIGNÉS MAIS PAIEMENT EN ATTENTE ===
(gen_random_uuid(), v_sejour_id, 'RENAUD', 'Charlotte', 'alain.renaud@gmail.com', gen_random_uuid(), NOW()-INTERVAL '4 days', 163, 53, 38, NULL, NULL, NULL, true, 2, 'virement', false, 'Alain RENAUD', '06 87 09 21 43', '2012-04-07', NOW()),
(gen_random_uuid(), v_sejour_id, 'GAUTIER', 'Gabriel', 'beatrice.gautier@gmail.com', gen_random_uuid(), NOW()-INTERVAL '3 days', 172, 63, 42, NULL, NULL, NULL, true, 1, 'carte', false, 'Béatrice GAUTIER', '06 98 10 32 54', '2012-12-01', NOW()),
(gen_random_uuid(), v_sejour_id, 'OLIVIER', 'Noémie', 'remi.olivier@gmail.com', gen_random_uuid(), NOW()-INTERVAL '3 days', 156, 45, 36, NULL, NULL, NULL, true, 3, 'virement', false, 'Rémi OLIVIER', '06 09 21 43 65', '2013-06-18', NOW()),
(gen_random_uuid(), v_sejour_id, 'BARBIER', 'Axel', 'corinne.barbier@gmail.com', gen_random_uuid(), NOW()-INTERVAL '2 days', 170, 61, 41, NULL, NULL, NULL, true, 1, 'carte', false, 'Corinne BARBIER', '06 10 22 44 66', '2012-09-25', NOW()),
(gen_random_uuid(), v_sejour_id, 'BRUN', 'Juliette', 'nicolas.brun@gmail.com', gen_random_uuid(), NOW()-INTERVAL '2 days', 159, 49, 37, NULL, NULL, NULL, true, 2, 'virement', false, 'Nicolas BRUN', '06 21 33 55 77', '2013-03-02', NOW()),
(gen_random_uuid(), v_sejour_id, 'MULLER', 'Antoine', 'fabienne.muller@gmail.com', gen_random_uuid(), NOW()-INTERVAL '1 day', 176, 67, 43, NULL, NULL, NULL, true, 1, 'carte', false, 'Fabienne MULLER', '06 32 44 66 88', '2012-07-11', NOW()),
(gen_random_uuid(), v_sejour_id, 'COLIN', 'Lisa', 'xavier.colin@gmail.com', gen_random_uuid(), NOW()-INTERVAL '1 day', 154, 44, 35, NULL, NULL, NULL, true, 3, 'virement', false, 'Xavier COLIN', '06 43 55 77 99', '2012-11-08', NOW()),
(gen_random_uuid(), v_sejour_id, 'GUERIN', 'Sacha', 'monique.guerin@gmail.com', gen_random_uuid(), NOW()-INTERVAL '1 day', 167, 57, 40, NULL, NULL, NULL, true, 2, 'virement', false, 'Monique GUÉRIN', '06 54 66 88 00', '2013-05-26', NOW()),

-- === 5 NON SIGNÉS (en attente) ===
(gen_random_uuid(), v_sejour_id, 'FONTAINE', 'Apolline', 'daniel.fontaine@gmail.com', gen_random_uuid(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 1, NULL, false, NULL, NULL, '2012-10-30', NOW()),
(gen_random_uuid(), v_sejour_id, 'VIDAL', 'Oscar', 'celine.vidal@gmail.com', gen_random_uuid(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 1, NULL, false, NULL, NULL, '2013-02-06', NOW()),
(gen_random_uuid(), v_sejour_id, 'MAILLARD', 'Célia', 'gerard.maillard@gmail.com', gen_random_uuid(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 1, NULL, false, NULL, NULL, '2012-06-13', NOW()),
(gen_random_uuid(), v_sejour_id, 'LEMAIRE', 'Baptiste', 'sylviane.lemaire@gmail.com', gen_random_uuid(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 1, NULL, false, NULL, NULL, '2013-08-21', NOW()),
(gen_random_uuid(), v_sejour_id, 'ROYER', 'Mathilde', 'christophe.royer@gmail.com', gen_random_uuid(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 1, NULL, false, NULL, NULL, '2012-12-17', NOW());

-- ============================================================
-- MESSAGES (5 échanges réalistes)
-- ============================================================
INSERT INTO messages (id, sejour_id, auteur_id, contenu, created_at) VALUES
  (gen_random_uuid(), v_sejour_id, (SELECT id FROM utilisateurs WHERE email = 'enseignant@test.fr'), 'Bonjour ! Nous sommes ravis de venir au Sauvageon avec nos 48 élèves de 4ème. Quelques questions pratiques : à quelle heure pouvons-nous arriver le lundi ? Et y a-t-il un local bagages pour les élèves avant l''installation en chambres ?', NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), v_sejour_id, v_venue_user_id, 'Bonjour ! Nous serons prêts pour vous accueillir dès 11h30, le repas du midi est prévu à 12h15. Un grand local bagages est à disposition à l''entrée du chalet. Nous préparerons un accueil jus de fruits pour les élèves. Les chambres seront accessibles à partir de 14h.', NOW() - INTERVAL '9 days'),
  (gen_random_uuid(), v_sejour_id, (SELECT id FROM utilisateurs WHERE email = 'enseignant@test.fr'), 'Parfait merci ! Point important : Lucas PETIT a une allergie sévère aux arachides (Epipen dans sa trousse, protocole PAI transmis). Zoé MERCIER est diabétique type 1 avec pompe à insuline. Pouvez-vous confirmer que votre cuisine peut gérer ces deux cas ?', NOW() - INTERVAL '8 days'),
  (gen_random_uuid(), v_sejour_id, v_venue_user_id, 'Bien noté et transmis au chef. Nous avons l''habitude de gérer les PAI. Menus 100% sans arachides confirmés pour toute la semaine, et nous préparerons des repas adaptés pour Lucas. Pour Zoé, notre équipe sera informée et un réfrigérateur sera mis à disposition pour son matériel médical. On vous envoie les menus de la semaine d''ici vendredi.', NOW() - INTERVAL '7 days'),
  (gen_random_uuid(), v_sejour_id, (SELECT id FROM utilisateurs WHERE email = 'enseignant@test.fr'), 'Super, merci pour votre réactivité ! On a aussi 1 végétarienne (Chloé MOREAU), 1 sans gluten (Alice BERNARD) et 1 allergie fruits à coque (Lilou BOYER). Je vous transmets la liste complète des régimes par email. Hâte d''y être !', NOW() - INTERVAL '5 days');

RAISE NOTICE 'Seed participants OK — 48 autorisations + 5 accompagnateurs + 5 messages créés pour séjour %', v_sejour_id;
END $;
