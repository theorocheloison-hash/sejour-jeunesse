# LIAVO — État session dev (25 mars 2026)

## DÉPLOYÉ LE 25 MARS 2026

### Fix migration reset_password (critique)
- Bug : migration 20260325_add_reset_password_token ciblait TABLE "users" au lieu de "utilisateurs"
- Fix : colonnes ajoutées manuellement en SQL sur "utilisateurs" + UPDATE _prisma_migrations finished_at + checksum corrigé
- Fichier corrigé à la source : backend/prisma/migrations/20260325_add_reset_password_token/migration.sql
- Résultat : POST /auth/register/teacher opérationnel

### Inscription enseignant — recherche établissement
- 4 champs établissement ajoutés dans RegisterTeacherDto (etablissementUai, Nom, Adresse, Ville)
- auth.service.ts : persistés à la création du compte
- Frontend : 3 boutons toggle École/Collège/Lycée + 3 champs Nom/Ville/CP
- API EN : recherche sur nom_etablissement OR nom_commune, détection code postal 5 chiffres → filtre exact
- Paramètre ?type= ajouté sur GET /etablissements/recherche

### Invitations privées — Scénario A (centreDestinataireId)
- Migration : ajout centreDestinataireId UUID? nullable sur demandes_devis
- DemandeDevis.create() : persiste centreDestinataireId si fourni
- findOpen() : WHERE centreDestinataireId IS NULL OR centreDestinataireId = centre.id
- invitation-collaboration.service.ts → accepter() : passe centreDestinataireId = invitation.centreId
- Résultat : demandes issues d'invitation hébergeur sont privées (visible uniquement par le centre invitant)

### Modale "Travailler avec ce centre" enrichie
- Champs ajoutés : niveauClasse, heureArrivee, heureDepart, transportAller, budgetMaxParEleve
- hebergement.ts : creerSejourDepuisCatalogue() accepte et passe ces champs au backend

### Invitation centre externe (enseignant → hébergeur sans compte)
- Nouveau endpoint POST /invitation-collaboration/centre-externe (TEACHER seulement)
- Envoie un email Brevo avec lien /register/venue?nomCentre=...&ville=...&codePostal=...
- Frontend fiche hébergeur : bloc "Ce centre n'est pas encore sur LIAVO" + modale d'invitation si ID non-UUID
- register/venue/page.tsx : lit les query params, pré-remplit le formulaire, saute l'étape 1.5, affiche bandeau invitation

### DNS et branding
- Cloudflare : CNAME www corrigé → p7metf7f.up.railway.app, proxy activé
- BREVO_SENDER_NAME : "Séjour Jeunesse" → "LIAVO" dans Railway Variables
- Service frontend renommé precious-comfort → liavo-frontend dans Railway dashboard

### Leçon retenue
- Migrations manuelles : toujours vérifier @@map() dans schema.prisma (model User → table "utilisateurs")
- Modifier une migration après deploy casse le checksum Prisma → bloquer migrate deploy en boucle

## BACKLOG IMMÉDIAT (prochaine session)

### Flux invitations — ce qui reste
- Lier invitation externe à une demande de devis en attente (aujourd'hui l'hébergeur crée son compte mais ne voit pas la demande)
- Formulaire hébergeur inviter-enseignant : ajouter thematiquesPedagogiques + transportSurPlace (absents)
- Permettre à l'enseignant de compléter thématiques après acceptation d'une invitation hébergeur

### Notifications CRM
- Emails automatiques Brevo la veille d'un rappel
- Email de relance auto si devis sans réponse après X jours

### Idées à approfondir
- Boîte email connectée au CRM (Gmail/Outlook OAuth → log emails dans historique client)
- Rapprochement bancaire (import relevé → matcher avec factures LIAVO)
- Facture électronique Chorus Pro : API PISTE directe post-premier client signé

## DONNÉES TEST EN BASE
- resa@lesauvageon.com (Test1234!) — 270 clients + 268 contacts importés
- enseignant@test.fr / directeur@test.fr / contact@chalet-sauvageon.fr (Test1234!)
- theo@nunayak.com (Test1234!) — compte enseignant test créé le 25 mars
- admin@sejour-jeunesse.fr (Admin2026!)
- Séjour ID test : 32842d6a-24d5-44b4-ab36-aae594e8fe00
- UAI établissement test : 0750001A (Collège Victor Hugo Paris)
