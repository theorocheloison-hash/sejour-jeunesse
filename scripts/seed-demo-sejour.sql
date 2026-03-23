DO $$
DECLARE
  v_enseignant_id UUID := '7cd313b3-9e30-4f75-9efa-09e6b568140f';
  v_centre_id     UUID := '3a710674-d580-4ffd-9d9a-f739bae82154';
  v_venue_user_id UUID := '8de32b15-a659-4742-916d-74f41a294cf1';
  v_sejour_id     UUID := gen_random_uuid();
  v_demande_id    UUID := gen_random_uuid();
  v_devis_id      UUID := gen_random_uuid();
BEGIN

INSERT INTO sejours (id, titre, description, lieu, date_debut, date_fin, places_totales, places_restantes, prix, statut, niveau_classe, thematiques_pedagogiques, appel_offre_statut, createur_id, hebergement_selectionne_id, nombre_accompagnateurs, heure_arrivee, heure_depart, transport_aller, transport_sur_place, activites_souhaitees, budget_max_par_eleve, created_at, updated_at) VALUES (v_sejour_id, 'Classe de montagne — 5ème B — Morillon 2026', 'Séjour montagne 5 jours en Haute-Savoie. Activités outdoor encadrées : rafting, escalade, via ferrata, VTT, randonnée. Pension complète au Chalet Le Sauvageon.', 'Morillon', '2026-03-24', '2026-03-28', 45, 45, 380.00, 'CONVENTION', '5ème', ARRAY['Montagne', 'Activités sportives', 'Développement personnel'], 'FERME', v_enseignant_id, v_centre_id, 5, '10:00', '14:00', 'CARS', false, 'Rafting, escalade, via ferrata, VTT, randonnée', 400.00, NOW(), NOW());

INSERT INTO demandes_devis (id, sejour_id, enseignant_id, titre, description, date_debut, date_fin, nombre_eleves, nombre_accompagnateurs, heure_arrivee, heure_depart, transport_aller, transport_sur_place, activites_souhaitees, budget_max_par_eleve, ville_hebergement, region_cible, statut, created_at, updated_at) VALUES (v_demande_id, v_sejour_id, v_enseignant_id, 'Séjour montagne 5ème B — mars 2026', 'Pension complète 5 jours, activités outdoor encadrées.', '2026-03-24', '2026-03-28', 45, 5, '10:00', '14:00', 'CARS', false, 'Rafting, escalade, via ferrata, VTT, randonnée', 400.00, 'Morillon', 'Haute-Savoie', 'FERMEE', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');

INSERT INTO devis (id, demande_id, centre_id, montant_total, montant_par_eleve, description, conditions_annulation, statut, nom_entreprise, adresse_entreprise, siret_entreprise, email_entreprise, tel_entreprise, taux_tva, montant_ht, montant_tva, montant_ttc, pourcentage_acompte, montant_acompte, numero_devis, type_devis, type_document, created_at, updated_at) VALUES (v_devis_id, v_demande_id, v_centre_id, 17100.00, 380.00, 'Séjour montagne 5 jours pension complète avec activités outdoor encadrées par des professionnels diplômés.', 'Annulation > 60j : 0% — 30-60j : 25% — < 30j : 50% — < 15j : 75%.', 'SELECTIONNE', 'Chalet Le Sauvageon', '472 route du Mas Devant, 74440 Morillon', '953632031', 'resa@lesauvageon.com', '+33 6 74 94 81 82', 10.0, 15545.45, 1554.55, 17100.00, 30, 5130.00, 'DEV-2026-001', 'PLATEFORME', 'DEVIS', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days');

INSERT INTO lignes_devis (id, devis_id, description, quantite, prix_unitaire, tva, total_ht, total_ttc) VALUES
  (gen_random_uuid(), v_devis_id, 'Pension complète — hébergement + petits-déjeuners + déjeuners + dîners (5 jours x 50 personnes)', 50, 55.00, 10.0, 2750.00, 3025.00),
  (gen_random_uuid(), v_devis_id, 'Rafting demi-journée — Gorges du Giffre, moniteur diplômé + équipement', 45, 38.00, 10.0, 1710.00, 1881.00),
  (gen_random_uuid(), v_devis_id, 'Escalade demi-journée — Falaise de Sixt, moniteur diplômé + matériel', 45, 32.00, 10.0, 1440.00, 1584.00),
  (gen_random_uuid(), v_devis_id, 'Via ferrata — Fer à Cheval, guide montagne + équipement sécurité complet', 45, 35.00, 10.0, 1575.00, 1732.50),
  (gen_random_uuid(), v_devis_id, 'VTT demi-journée — plateau de Morillon, location vélo + casque + encadrement', 45, 28.00, 10.0, 1260.00, 1386.00),
  (gen_random_uuid(), v_devis_id, 'Randonnée accompagnée — guide de montagne + pique-nique (2 sorties x 50 pers.)', 100, 11.00, 10.0, 1100.00, 1210.00),
  (gen_random_uuid(), v_devis_id, 'Transport navette aller-retour — cars depuis gare de Cluses', 1, 850.00, 10.0, 850.00, 935.00),
  (gen_random_uuid(), v_devis_id, 'Assurance annulation groupe', 50, 8.00, 10.0, 400.00, 440.00),
  (gen_random_uuid(), v_devis_id, 'Coordinateur pédagogique — 5 jours sur site', 1, 460.45, 10.0, 460.45, 506.50);

INSERT INTO planning_activites (id, sejour_id, date, heure_debut, heure_fin, titre, description, responsable, created_at) VALUES
  (gen_random_uuid(), v_sejour_id, '2026-03-24', '10:00', '11:00', 'Accueil & installation', 'Accueil des élèves, installation en chambres, présentation du chalet et règles de vie.', 'Coordinateur Sauvageon', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-24', '12:00', '13:30', 'Déjeuner', 'Buffet d''accueil — spécialités savoyardes.', 'Cuisine Sauvageon', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-24', '14:00', '17:30', 'Randonnée de découverte', 'Randonnée initiatique autour de Morillon — faune et flore alpines.', 'Guide montagne', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-24', '19:00', '20:00', 'Dîner', 'Fondue savoyarde de bienvenue.', 'Cuisine Sauvageon', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-24', '20:30', '22:00', 'Soirée cohésion', 'Jeux de groupe, présentation du programme.', 'Enseignant référent', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-25', '07:30', '08:30', 'Petit-déjeuner', 'Buffet continental.', 'Cuisine Sauvageon', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-25', '09:00', '12:30', 'Rafting — Gorges du Giffre (Groupe A)', 'Descente en raft — 23 élèves. Équipement fourni, moniteur diplômé.', 'Moniteur rafting', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-25', '12:30', '14:00', 'Pique-nique bord de rivière', 'Repas tiré du sac sur les rives du Giffre.', 'Enseignant référent', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-25', '14:30', '18:00', 'Escalade — Falaise de Sixt (Groupe B)', 'Initiation escalade sur site naturel — 22 élèves. Matériel fourni.', 'Moniteur escalade', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-25', '19:00', '20:00', 'Dîner', 'Tartiflette et dessert maison.', 'Cuisine Sauvageon', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-25', '20:30', '21:30', 'Bilan journée & journal de bord', 'Retour collectif, rédaction du journal de bord.', 'Enseignant référent', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-26', '07:30', '08:30', 'Petit-déjeuner', 'Buffet continental.', 'Cuisine Sauvageon', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-26', '09:00', '12:30', 'Via Ferrata — Fer à Cheval', 'Via ferrata encadrée — équipement sécurité complet. Parcours adapté débutants.', 'Guide montagne', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-26', '12:30', '14:00', 'Déjeuner', 'Repas chaud au chalet.', 'Cuisine Sauvageon', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-26', '14:30', '18:00', 'VTT — Plateau de Morillon', 'Sortie VTT sur chemins balisés — location vélos + casques. Niveau débutant.', 'Moniteur VTT', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-26', '19:00', '20:00', 'Dîner', 'Raclette traditionnelle.', 'Cuisine Sauvageon', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-26', '20:30', '22:00', 'Soirée cinéma montagne', 'Projection documentaire Alpes + débat environnement.', 'Enseignant référent', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-27', '07:30', '08:30', 'Petit-déjeuner', 'Buffet continental.', 'Cuisine Sauvageon', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-27', '09:00', '12:30', 'Rafting — Gorges du Giffre (Groupe B)', 'Descente en raft — 22 élèves (rotation groupes). Équipement fourni.', 'Moniteur rafting', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-27', '12:30', '14:00', 'Pique-nique bord de rivière', 'Repas tiré du sac sur les rives du Giffre.', 'Enseignant référent', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-27', '14:30', '18:00', 'Escalade — Falaise de Sixt (Groupe A)', 'Initiation escalade — 23 élèves (rotation groupes). Matériel fourni.', 'Moniteur escalade', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-27', '19:00', '20:00', 'Dîner', 'Diots et polenta — spécialités savoyardes.', 'Cuisine Sauvageon', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-27', '20:30', '22:00', 'Soirée bilan & préparation retour', 'Évaluation séjour, rangement bagages, remise attestations.', 'Enseignant référent', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-28', '07:30', '08:30', 'Petit-déjeuner', 'Dernier petit-déjeuner au chalet.', 'Cuisine Sauvageon', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-28', '09:00', '11:30', 'Randonnée panoramique d''adieu', 'Vue sur le massif du Mont-Blanc — sortie de clôture.', 'Guide montagne', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-28', '12:00', '13:00', 'Déjeuner de clôture', 'Buffet festif de fin de séjour.', 'Cuisine Sauvageon', NOW()),
  (gen_random_uuid(), v_sejour_id, '2026-03-28', '13:00', '14:00', 'Rangement & départ', 'Nettoyage chambres, chargement cars. Départ 14h00 direction gare de Cluses.', 'Coordinateur Sauvageon', NOW());

INSERT INTO accompagnateurs_missions (id, sejour_id, prenom, nom, email, telephone, contact_urgence_nom, contact_urgence_tel, token_acces, signee_at, signature_nom, moyen_transport, created_at) VALUES
  (gen_random_uuid(), v_sejour_id, 'Marie', 'DUBOIS', 'marie.dubois@college-hugo.fr', '06 12 34 56 78', 'Pierre Dubois', '06 98 76 54 32', gen_random_uuid(), NOW() - INTERVAL '5 days', 'Marie DUBOIS', 'CARS', NOW()),
  (gen_random_uuid(), v_sejour_id, 'Thomas', 'MARTIN', 'thomas.martin@college-hugo.fr', '06 23 45 67 89', 'Claire Martin', '06 87 65 43 21', gen_random_uuid(), NOW() - INTERVAL '3 days', 'Thomas MARTIN', 'CARS', NOW()),
  (gen_random_uuid(), v_sejour_id, 'Sophie', 'BERNARD', 'sophie.bernard@college-hugo.fr', '06 34 56 78 90', NULL, NULL, gen_random_uuid(), NULL, NULL, NULL, NOW());

INSERT INTO autorisations_parentales (id, sejour_id, eleve_nom, eleve_prenom, parent_email, token_acces, signee_at, taille, poids, pointure, regime_alimentaire, niveau_ski, infos_medicales, rgpd_accepte, nombre_mensualites, moyen_paiement, paiement_valide, nom_parent, telephone_urgence, eleve_date_naissance, created_at) VALUES
  (gen_random_uuid(), v_sejour_id, 'LEROY', 'Emma', 'parent.leroy@gmail.com', gen_random_uuid(), NOW() - INTERVAL '6 days', 162, 52, 37, NULL, 'Débutant', NULL, true, 2, 'virement', true, 'Isabelle LEROY', '06 11 22 33 44', '2013-05-14', NOW()),
  (gen_random_uuid(), v_sejour_id, 'PETIT', 'Lucas', 'parent.petit@gmail.com', gen_random_uuid(), NOW() - INTERVAL '4 days', 175, 68, 42, 'Sans gluten', 'Intermédiaire', 'Allergie arachides sévère — Epipen disponible', true, 1, 'carte', true, 'Jean-Paul PETIT', '06 55 44 33 22', '2013-02-28', NOW()),
  (gen_random_uuid(), v_sejour_id, 'MOREAU', 'Chloé', 'parent.moreau@gmail.com', gen_random_uuid(), NOW() - INTERVAL '2 days', 158, 48, 36, 'Végétarien', NULL, NULL, true, 3, 'virement', false, 'Anne MOREAU', '06 77 88 99 00', '2013-09-10', NOW()),
  (gen_random_uuid(), v_sejour_id, 'SIMON', 'Nathan', 'parent.simon@gmail.com', gen_random_uuid(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 1, NULL, false, NULL, NULL, '2013-07-22', NOW()),
  (gen_random_uuid(), v_sejour_id, 'LAMBERT', 'Inès', 'parent.lambert@gmail.com', gen_random_uuid(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 1, NULL, false, NULL, NULL, '2013-11-03', NOW());

INSERT INTO messages (id, sejour_id, auteur_id, contenu, created_at) VALUES
  (gen_random_uuid(), v_sejour_id, v_enseignant_id, 'Bonjour ! Nous sommes ravis de collaborer avec le Sauvageon. Quelques questions : à quelle heure ouvrez-vous lundi matin ? Et y a-t-il un local bagages avant installation ?', NOW() - INTERVAL '7 days'),
  (gen_random_uuid(), v_sejour_id, v_venue_user_id, 'Bonjour ! Nous serons prêts dès 9h30. Un grand local bagages est disponible, et nous prévoyons un accueil café/jus pour les élèves. Les 50 vélos sont réservés et vérifiés pour votre semaine.', NOW() - INTERVAL '6 days'),
  (gen_random_uuid(), v_sejour_id, v_enseignant_id, 'Parfait merci ! Attention : Lucas PETIT a une allergie sévère aux arachides avec Epipen. Pouvez-vous confirmer à votre cuisine qu''aucun plat n''en contiendra ?', NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), v_sejour_id, v_venue_user_id, 'Noté et transmis au chef. Menus 100% sans arachides confirmés pour toute la semaine.', NOW() - INTERVAL '4 days');

INSERT INTO invitations_collaboration (id, token, centre_id, email_enseignant, titre_sejour_suggere, date_debut, date_fin, nb_eleves_estime, message, accepted_at, sejour_id, created_at) VALUES
  (gen_random_uuid(), gen_random_uuid(), v_centre_id, 'enseignant@test.fr', 'Classe de montagne — 5ème B — Morillon 2026', '2026-03-24', '2026-03-28', 45, 'Bonjour, nous serions ravis de vous accueillir pour votre classe de montagne. Notre programme outdoor est particulièrement adapté aux 5ème.', NOW() - INTERVAL '12 days', v_sejour_id, NOW() - INTERVAL '15 days');

RAISE NOTICE 'Seed démo OK — séjour créé : %', v_sejour_id;
END $$;
