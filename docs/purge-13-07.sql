/* ✅ EXÉCUTÉ EN PROD LE 13/07/2026 — les 2 transactions ont été committées. Tous les DELETE conformes aux attendus (dont le OR createur_id large : DELETE 1, aucun séjour collatéral). Contrôles post-purge : 0 utilisateur/centre/organisation restants sur les 2 comptes ; Chalet des Nants intact (org 24e4e21e + centre fe8d1222 ACTIVE) ; 7 hébergeurs restants (Sauvageon, Pôle Montagne, Corrotte, Alticlub, T. Massard, Choucas, PULSE). Fichier conservé pour archive. */
/* RESTE À FAIRE À LA MAIN : purger les objets S3 OVH (bucket liavo-uploads, préfixe kbis/ — PDF du claim ZZZ RECETTE). */

/* PURGE 13/07 — comptes recette-exnihilo-13-07@liavo.fr (ZZZ RECETTE 13-07) et trochenrc@gmail.com (centre test SUSPENDED). Préparé par CC le 13/07, diagnostic prod SELECT-only. THEO EXECUTE. */
/* Diagnostic préalable : 0 facture sur les 2 devis ; sequence_numero est par ORGANISATION (les 2 orgs sont dédiées, 1 centre + 1 membership chacune) : aucune séquence comptable partagée n'est trouée. */
/* GARDE-FOU : ne touche PAS à l'organisation Chalet des Nants 24e4e21e-c544-448f-9bb1-98fe6267fc32 ni au centre fe8d1222-7f76-4622-8fbe-76b82cb6ac95 (traités le 13/07 au matin, légitimes). Aucune requête ci-dessous ne les référence ; contrôle explicite en fin de script. */
/* FK à connaître : acceptations_cgv → user/centre = RESTRICT (0 ligne sur les 2 comptes, vérifié) ; factures → devis = RESTRICT (0 ligne, vérifié) ; sejours.hebergement_selectionne_id = SET NULL (d'où DELETE explicite des séjours) ; le reste des tables filles est en CASCADE. */

/* ============ TRANSACTION 1 — ZZZ RECETTE 13-07 ============ */
BEGIN;
DELETE FROM lignes_devis WHERE devis_id = '79c1bea6-2b46-4c06-b93d-01e7af02f4be'; /* attendu : DELETE 1 */
DELETE FROM devis WHERE id = '79c1bea6-2b46-4c06-b93d-01e7af02f4be'; /* attendu : DELETE 1 (DEV-2026-0001, EN_ATTENTE, 0 facture liée) */
DELETE FROM sejours WHERE id = 'f046e73c-fbd7-4cf7-a371-7dccbb3279bd'; /* attendu : DELETE 1 (ZZZ Recette Séjour Test) */
DELETE FROM clients WHERE centre_id = 'a93e03a5-a391-443f-a3ca-ef2c4080c134'; /* attendu : DELETE 1 (client Théo Roche-Loison créé par le séjour) */
DELETE FROM produits_catalogue WHERE centre_id = 'a93e03a5-a391-443f-a3ca-ef2c4080c134'; /* attendu : DELETE 4 (produits par défaut de l'inscription) */
DELETE FROM memberships WHERE id = '1ab699f9-c292-426f-8046-8fe8732916c6'; /* attendu : DELETE 1 (claim VALIDE) */
DELETE FROM sequence_numero WHERE emetteur_id = '2a685224-4110-4a07-a147-1af1e35d2654'; /* attendu : DELETE 1 (compteur DEVIS/2026=1 de l'org ZZZ, org dédiée) */
DELETE FROM consentements_rgpd WHERE user_id = '6b9bc9ef-e46b-4428-be2a-fc636a68df4d'; /* attendu : DELETE 1 */
DELETE FROM centres_hebergement WHERE id = 'a93e03a5-a391-443f-a3ca-ef2c4080c134'; /* attendu : DELETE 1 (ZZZ RECETTE 13-07, ACTIVE ; acceptations_cgv=0 vérifié donc RESTRICT ne bloque pas) */
DELETE FROM organisations WHERE id = '2a685224-4110-4a07-a147-1af1e35d2654'; /* attendu : DELETE 1 (siren 999999999, 0 centre / 0 membership restants) */
DELETE FROM utilisateurs WHERE id = '6b9bc9ef-e46b-4428-be2a-fc636a68df4d'; /* attendu : DELETE 1 (recette-exnihilo-13-07@liavo.fr) */
SELECT count(*) AS reste_zzz FROM utilisateurs WHERE email = 'recette-exnihilo-13-07@liavo.fr'; /* attendu : 0 */
SELECT count(*) AS reste_centre_zzz FROM centres_hebergement WHERE id = 'a93e03a5-a391-443f-a3ca-ef2c4080c134'; /* attendu : 0 */
SELECT count(*) AS reste_org_zzz FROM organisations WHERE siren = '999999999'; /* attendu : 0 */
COMMIT;

/* ============ TRANSACTION 2 — trochenrc@gmail.com / centre « test » ============ */
BEGIN;
DELETE FROM lignes_devis WHERE devis_id IN (SELECT id FROM devis WHERE centre_id = '7882bda3-8086-4c09-b592-61e173a3e51f'); /* attendu : DELETE 1 */
DELETE FROM devis WHERE centre_id = '7882bda3-8086-4c09-b592-61e173a3e51f'; /* attendu : DELETE 1 (0 facture liée, vérifié) */
DELETE FROM sejours WHERE hebergement_selectionne_id = '7882bda3-8086-4c09-b592-61e173a3e51f' OR createur_id = 'fecd14d0-07ae-4f1d-a87d-81b752111758'; /* attendu : DELETE 1 */
DELETE FROM clients WHERE centre_id = '7882bda3-8086-4c09-b592-61e173a3e51f'; /* attendu : DELETE 1 */
DELETE FROM produits_catalogue WHERE centre_id = '7882bda3-8086-4c09-b592-61e173a3e51f'; /* attendu : DELETE 4 */
DELETE FROM memberships WHERE id = 'c8291b81-dc0c-4acc-bdda-e73877625857'; /* attendu : DELETE 1 (claim EN_ATTENTE_DOCUMENT) */
DELETE FROM sequence_numero WHERE emetteur_id = '0e0a0350-7f16-46cd-8515-2489fb137fd2'; /* attendu : DELETE 1 (compteur DEVIS/2026=1 de l'org test, org dédiée) */
DELETE FROM consentements_rgpd WHERE user_id = 'fecd14d0-07ae-4f1d-a87d-81b752111758'; /* attendu : DELETE 1 */
DELETE FROM centres_hebergement WHERE id = '7882bda3-8086-4c09-b592-61e173a3e51f'; /* attendu : DELETE 1 (centre « test », SUSPENDED) */
DELETE FROM organisations WHERE id = '0e0a0350-7f16-46cd-8515-2489fb137fd2'; /* attendu : DELETE 1 (org « test », 0 centre / 0 membership restants) */
DELETE FROM utilisateurs WHERE id = 'fecd14d0-07ae-4f1d-a87d-81b752111758'; /* attendu : DELETE 1 (trochenrc@gmail.com) */
SELECT count(*) AS reste_test FROM utilisateurs WHERE email = 'trochenrc@gmail.com'; /* attendu : 0 */
SELECT count(*) AS reste_centre_test FROM centres_hebergement WHERE id = '7882bda3-8086-4c09-b592-61e173a3e51f'; /* attendu : 0 */
COMMIT;

/* ============ CONTRÔLE FINAL — les intouchables sont intacts ============ */
SELECT count(*) AS chalet_des_nants_org_intacte FROM organisations WHERE id = '24e4e21e-c544-448f-9bb1-98fe6267fc32'; /* attendu : 1 */
SELECT count(*) AS chalet_des_nants_centre_intact FROM centres_hebergement WHERE id = 'fe8d1222-7f76-4622-8fbe-76b82cb6ac95' AND statut = 'ACTIVE'; /* attendu : 1 */

/* Hors SQL, à purger à la main sur OVH S3 : le PDF du claim ZZZ (dossier kbis/) et le PDF du devis DEV-2026-0001 s'il a été stocké ; idem pour le justificatif éventuel du compte test (dossier kbis/ ou claims/). */
