-- Bascule des statuts des événements importés — Chalet Le Sauvageon
-- Généré par scripts/import-mariages.ts. Appliquer via Bash (UTF-8) :
--   scalingo --app <APP> pg-console < scripts/import-mariages-statuts.sql
BEGIN;

-- Devis créés EN_ATTENTE → SELECTIONNE (déjà signés dans la vraie vie)
UPDATE devis AS d SET
  statut = 'SELECTIONNE',
  nom_signataire_directeur = v.nom,
  signature_directeur = 'Signé (import événements Sauvageon) — ' || to_char(now(), 'DD/MM/YYYY'),
  date_signature_directeur = now()
FROM (VALUES
  ('a8dde493-3079-46d6-9f3e-25209267ef0e'::uuid, 'Pauline et Raphael VUAGNAT'),
  ('116de3a8-7c62-4994-b4e0-da722a1f106c'::uuid, 'Lucie et Florian VERNINE & ELWOOD'),
  ('89d36ef4-4485-4694-9c89-75df650a3d47'::uuid, 'Quentin et Marlène KRAHENBUHL'),
  ('9819bb33-83d3-4677-b2e6-56a73b610007'::uuid, 'Juliette PAGET'),
  ('84f0e04d-862d-4d50-92f1-fa6952c0095e'::uuid, 'Laurine et Anthony VALIN / MARTINET'),
  ('b8ff1f92-5a4d-43dd-a9e7-348385dee53e'::uuid, 'Heide GEORGE'),
  ('a202f890-66e4-4e3e-bd5b-e63679bff441'::uuid, 'Eric DERHILLE'),
  ('bad4b76d-20a7-4c67-a2c4-b9fbd1cd8bf8'::uuid, 'Catherine PINEL'),
  ('1ec4e5cb-eea2-43bf-84a9-211a4580251c'::uuid, 'M Yannael GIRERD'),
  ('bdb487e6-b415-4fcb-81bc-c12ca1873792'::uuid, 'Hortense & Viktor DELAME ET MALOVRY'),
  ('18412c43-ea9c-4e36-b161-2db89bdd6649'::uuid, 'Alice DOMERC et Maxime LEPRINCE'),
  ('d9cf9bc3-3bef-42ec-bf2f-3c53264cfba8'::uuid, 'Camilla MURRAY'),
  ('be854f4f-08ff-4569-9aa6-783cf29cf3a4'::uuid, 'Anne-Lise et Sylvain BERGER'),
  ('9c8c7126-3e57-450f-96bf-53f813756dc3'::uuid, 'Laure et Guillaume PREMET / JULIEN'),
  ('65845757-5dc1-4d98-885c-5a0329767d67'::uuid, 'Coraline DESMITT ET REMI RIGAL'),
  ('4090e515-8cd6-4e5c-a631-8cc87b835c0c'::uuid, 'Pascal EUDES'),
  ('261e8754-75a5-4d97-a167-cebb8e96e331'::uuid, 'Cécile et Etienne MANTOVANI ET BAJOR'),
  ('4561b8cb-67f5-434f-a3eb-4aee9c2d66a5'::uuid, 'Chloé MARTIN GUERRE'),
  ('fba9bbb9-5781-43a6-b3d9-4086969559a6'::uuid, 'Mme Jessica PETTROCCHI et Clément'),
  ('60158598-b4f2-43e8-b943-49c0545f481d'::uuid, 'Déborah et Gaëtan HABEGGER ET MARRA'),
  ('d83cad88-859a-4582-aa53-621a44f4519e'::uuid, 'Alice et François ROLLIN ET TREGOUET'),
  ('92457b5f-919b-475a-86aa-63f1a18a087a'::uuid, 'Myriam GROSSETJANIN'),
  ('752dd30d-1f5d-47e6-b3d5-61f93604e5ec'::uuid, 'Marie RECH et Nico HASER'),
  ('63cd8772-1313-4431-89a8-863efab15e67'::uuid, 'Mme Julie CURTET'),
  ('c7facc54-2833-4579-b564-fee685e342f5'::uuid, 'Heide GEORGE'),
  ('777dd37e-be4c-4390-904e-bbc1ce942a1d'::uuid, 'Amandine & Maxime DUMAINE ET BARIN'),
  ('208915bd-0d27-4062-b617-76e8fe56f4f3'::uuid, 'Marie BRIENNE'),
  ('b3488ba0-2930-4929-a5d4-5c3a2228eb04'::uuid, 'Yeohana FONDEVILLA et Alexandre TONNERIEUX'),
  ('0b89b573-aa2a-4335-92a9-443764ff85d6'::uuid, 'Manon REVUZ'),
  ('aab20aac-9614-42f2-828e-fbb3b102b300'::uuid, 'Lisa HOMMEL'),
  ('63925e3f-49ad-48aa-8984-f5343809e802'::uuid, 'M Benoit GARRIGUES'),
  ('27f91443-fc8c-4c0d-95ff-51351799dccf'::uuid, 'Coline FERNEZ et Colin'),
  ('ee411900-88e1-4be1-8dcc-f22d58cb3f4f'::uuid, 'Léa et Antoine STEINBACH & FLEURET'),
  ('6a4493de-5e16-48c5-8f84-d5a30c01f205'::uuid, 'Mme Aurélie HOUILLON'),
  ('b4ecd058-6990-463b-b844-4a69af953883'::uuid, 'Lise CHEVALIER'),
  ('19be4c86-5f83-408e-9abf-b551346b014d'::uuid, 'Mme Elodie et Alexandre NYS ET MOTTEAU'),
  ('150aed89-2392-407e-a7dd-9d471ffaa15f'::uuid, 'Margot BRUN et Paulin TROGON')
) AS v(id, nom)
WHERE d.id = v.id AND d.statut = 'EN_ATTENTE';

-- Séjours liés → CONVENTION (= "Confirmé" au planning)
UPDATE sejours SET statut = 'CONVENTION'
WHERE id IN ('cdfe4bfc-65f8-4ed3-a405-7a214d3e9a47'::uuid, 'dac3a216-db55-4dfa-910d-633ebed819a7'::uuid, '8b8a1ca4-3074-40e0-ad73-6c172982ca0e'::uuid, '0664ee7a-4b1b-4992-9799-f654949ea8f0'::uuid, '1b00df89-cee0-41a1-baf4-26694247066f'::uuid, 'ef46d461-b7d3-41e1-8996-ea42986880fb'::uuid, '2b5c7928-8f31-46ba-9747-73ac7411a243'::uuid, '22cc73ea-63ab-4ec7-b50f-16d64b553aa8'::uuid, '8d5b1290-4d02-48a0-8309-5e0f6e2d2194'::uuid, '44ba57ee-19cd-483f-a06c-0ced9d0b4d27'::uuid, '71793ea9-5b01-41fe-9910-39c96ce83edf'::uuid, '98c9e071-2754-43ad-90c4-42b7e221c273'::uuid, 'f15741b6-9e10-44e9-8b95-3bf2bb51f8a5'::uuid, 'b4c93214-a8ef-4440-82e9-36cb6cc80dc5'::uuid, '21c607f8-d88c-45fa-ac54-4f6974742cb0'::uuid, 'a70fb19d-7258-44ae-8912-dac09ab6f5c0'::uuid, '6185c0cc-cb59-44f9-bc52-002e3f9623e4'::uuid, '1d07bf58-6fea-496a-bc9c-a50b271627da'::uuid, '74eddc10-08df-449b-93a1-a6e51726686c'::uuid, '8a095b90-8357-42a0-a6d8-326815779fc0'::uuid, '3de76895-8c2d-4418-96e7-2439fc708cfb'::uuid, 'b8132e09-def2-49c6-8614-1d65fd1268ba'::uuid, '710462b0-05cc-43fa-996e-b7ad4416b0f3'::uuid, '7bb9d77a-7f68-4080-8d00-4b44cfa5a32b'::uuid, 'b747853a-5f72-43cc-8dd5-40bf84a2196c'::uuid, 'fa5c24b2-74c1-42f9-b6b5-434e8300bc07'::uuid, '3f3f2065-0901-4b61-8710-73e08573456c'::uuid, '03e7d530-470a-44df-99a9-0267966cd4da'::uuid, '1d261f4c-fb44-441a-ad50-61a573e2c171'::uuid, '08792dd6-8e20-4ebb-9129-efbe1b46e2d8'::uuid, 'e1f90b13-dadb-47f8-8117-c5f2418eff89'::uuid, 'dabaa008-82ac-48e9-869d-1beedac4edcf'::uuid, '3d1d14b9-ec9e-46d3-91af-afe167742ed6'::uuid, 'e49d0221-6a10-4e90-8310-d0915a1084ea'::uuid, '75fdea3a-f4bb-4b20-8196-704ef50afdbf'::uuid, 'f64dffb5-1f96-4c9b-b7d1-398964e9fad4'::uuid, '94c46860-8a27-425e-8aab-176ae0482648'::uuid) AND statut = 'OPTION';

COMMIT;
