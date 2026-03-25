# LIAVO — État session dev (25 mars 2026)

## DÉPLOYÉ LE 25 MARS 2026

### Fix migration reset_password (critique)
- Bug : migration 20260325_add_reset_password_token ciblait TABLE "users" au lieu de "utilisateurs"
- Conséquence : colonnes reset_password_token et reset_password_expires jamais créées en prod
- Fix : colonnes ajoutées manuellement en SQL sur "utilisateurs" + UPDATE _prisma_migrations finished_at
- Fichier corrigé à la source : backend/prisma/migrations/20260325_add_reset_password_token/migration.sql
- Résultat : POST /auth/register/teacher opérationnel

### Leçon retenue
- Migrations manuelles : toujours vérifier le @@map() dans schema.prisma avant d'écrire le SQL
- model User → table "utilisateurs", pas "users"

## DÉPLOYÉ LE 23 MARS 2026

### CRM Hébergeur
- Import clients CSV (270 clients Sauvageon importés) — fix BOM + parseCSVLine + COL_MAP normalisation
- Import contacts CSV (268 contacts) — CONTACT_COL_MAP avec Etablissement/Prenom/Nom/Email/Telephone/Role
- Type PARTICULIER ajouté (mariages/events privés)
- Pagination API EN supprimée limite 100 — récupère tout par pages de 100
- Fix type École API EN : type_etablissement="Ecole" (sans accent)
- Fix écoles frontend : mapping checkbox → ['Ecole élémentaire', 'Ecole maternelle', 'Ecole primaire']
- Boutons CSV regroupés : Établissements (Modèle/Importer) + Contacts (Modèle/Importer)
- Index PostgreSQL ajoutés sur Client, ContactClient, Rappel, Devis, Sejour, DemandeDevis

### Dashboard hébergeur
- Rappels CRM du jour : badge sur carte Clients + section dédiée sous Actions prioritaires
- getMesClients() chargé au montage du dashboard

## FORMAT CSV IMPORT QUI FONCTIONNE
- UTF-8 sans BOM, sans guillemets, virgule séparateur, \n simple
- Clients : Nom,Type,Statut,Ville,CodePostal,Telephone,Email,UAI,Notes
- Contacts : Etablissement,Prenom,Nom,Email,Telephone,Role

## BACKLOG IMMÉDIAT

### Notifications CRM (prochaine session)
- Emails automatiques Brevo la veille d'un rappel
- Email de relance auto si devis sans réponse après X jours
- Badge rappels en retard déjà sur le dashboard ✅ — manque la notification push/email

### Idées à approfondir
- Boîte email connectée au CRM (Gmail/Outlook OAuth → log emails dans historique client)
- Rapprochement bancaire (import relevé → matcher avec factures LIAVO)
- Facture électronique Chorus Pro : API PISTE directe post-premier client signé
- Aspect juridique LIAVO (Théo apporte des infos à la prochaine session)

## DONNÉES TEST EN BASE
- resa@lesauvageon.com (Test1234!) — 270 clients + 268 contacts importés
- enseignant@test.fr / directeur@test.fr (Test1234!)
- Séjour ID : 32842d6a-24d5-44b4-ab36-aae594e8fe00
