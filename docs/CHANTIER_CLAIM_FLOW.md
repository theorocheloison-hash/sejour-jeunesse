# LIAVO — Chantier claim flow hébergeur : fix complet de A à Z

## Contexte

LIAVO est une plateforme B2B SaaS de coordination de séjours jeunesse. Le catalogue public affiche des centres d'hébergement issus de l'API Éducation Nationale. Un hébergeur doit pouvoir revendiquer son centre depuis le catalogue pour créer son compte et gérer ses séjours.

## État actuel (03/06/2026) — CE QUI NE MARCHE PAS

Le flow claim a été codé (backend + frontend) mais n'a jamais été testé end-to-end en prod. Chaque tentative de fix a révélé un nouveau bug. Voici l'état réel :

### Flow 1 — Catalogue → "Je gère ce centre" (non connecté)
- Page `/catalogue/[id]` affiche le bouton "Je gère ce centre" ✅
- Au clic → redirige vers `/register/hebergeur?claimCatalogueId=...&claimCentreNom=...` ✅
- L'inscription crée le user sans centre vierge quand claimCatalogueId est fourni ✅
- Le claim inline pendant l'inscription est censé créer le centre + org → NON VÉRIFIÉ en prod, potentiellement cassé
- Le message post-inscription dit "email de vérification envoyé" → TROMPEUR (pas de vérif email, c'est une validation admin)

### Flow 2 — Catalogue → "Je gère ce centre" (connecté hébergeur)
- Le bouton appelle POST /centres/claim-from-catalogue → INTERNAL SERVER ERROR (500)
- Bug non identifié dans claimFromCatalogue() côté backend

### Flow 3 — Dashboard hébergeur → "Ajouter un centre"
- Page /dashboard/hebergeur/centres/nouveau affiche une recherche catalogue ✅
- Trouve le centre ✅
- Au submit → "centreId must be a UUID" car l'ID externe EN n'est pas un UUID
- Ce flow utilise un endpoint DIFFÉRENT de claim-from-catalogue → pas fixé

### Flow 4 — Données du centre après claim
- Le centre est créé dans centres_hebergement mais avec des champs vides
- Le centre Florimont (premier claim de test) a toujours des données vides en base

### Flow 5 — Email admin
- Le claim devrait envoyer un email à contact@liavo.fr → JAMAIS REÇU

### Flow 6 — Vérification email
- L'inscription envoie un "email de vérification" mais le user peut se connecter sans cliquer le lien → PROBLÈME DE SÉCURITÉ

## Ce qui doit fonctionner (spec complète)

### Parcours A — Nouvel hébergeur découvre son centre
1. /catalogue/[id] → "Je gère ce centre" → /register/hebergeur?claimCatalogueId={id}&claimCentreNom={nom}
2. Remplit prénom, nom, email, téléphone, mot de passe
3. Backend crée le user (SANS centre vierge) + claimFromCatalogue inline
4. claimFromCatalogue : fetch API EN → crée centre AVEC TOUTES LES DONNÉES → crée/retrouve Org → Membership EN_ATTENTE_VALIDATION
5. Email admin contact@liavo.fr
6. Hébergeur voit "Demande transmise, en attente de validation"
7. Admin valide → compteValide=true + centre activé + email hébergeur
8. Hébergeur se connecte → dashboard avec centre complet

### Parcours B — Hébergeur connecté ajoute un 2e/3e centre
1. /catalogue/[id] → "Je gère ce centre" (connecté) → POST /centres/claim-from-catalogue direct
2. OU Dashboard → "Ajouter un centre" → recherche catalogue → revendiquer
3. Les deux chemins doivent fonctionner avec le même endpoint backend
4. Le guard multi-centre ne bloque PAS le même user

### Parcours C — Admin valide
1. /dashboard/admin/claims → liste claims → Valider/Refuser
2. Affiche lien justificatif si uploadé

## Données de test en prod
- Yves Massard : info@pole-montagne.com (HEBERGEUR, compteValide=true)
- Florimont claimé mais données vides (API EN ID 95378860)
- Chalet YAKA pas claimé (API EN ID 54871720)
- Chalet des Nants pas claimé (API EN ID 92599834)
- Pôle Montagne SIREN 440246106

## Stack
Backend : NestJS 11 / Prisma / PostgreSQL 17 / Scalingo Paris
Frontend : Next.js 15 / React 19 / TypeScript / Tailwind
Repo : C:\Users\Roche-Loison\Desktop\sejour-jeunesse
API EN : https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-catalogue-structures-accueil-hebergement/records

## Règles
- Lire les fichiers via MCP filesystem-liavo AVANT toute proposition
- Fix à la source, jamais de patch
- 0 erreur TypeScript
- Tester chaque flow avant push
- Validation explicite de Théo avant modification
- Anticiper les bugs en cascade
