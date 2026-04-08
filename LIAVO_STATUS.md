# LIAVO — État du projet
> Dernière mise à jour : 07 avril 2026

---

## Entité juridique

**LIAVO SAS** — créée le 26/03/2026 via le Guichet Unique
- Formalité : **J00228864781**
- Forme : SAS (société par actions simplifiée)
- Capital : **1 000 €**
- Siège : 472 Route du Mas Devant, 74440 Morillon, France
- Président : **Théo Roche-Loison** (né le 27/10/1993 à Roanne)
- Activité démarrée : 23/03/2026
- Nature : Libérale non réglementée
- Régime fiscal : IS réel simplifié, franchise en base TVA
- Publication légale : Eco Savoie Mont-Blanc Web, 24/03/2026
- **SIREN : 102 994 910** — RCS Annecy — EUID : FR7401.102994910

**Actions restantes :**
- [ ] Ouvrir compte bancaire pro LIAVO SAS (débloquer capital au Crédit Agricole Samoëns)
- [ ] Céder la marque INPI (personne physique → LIAVO SAS) — formulaire INPI, ~26€
- [ ] Vérifier mentions légales liavo.fr (SIREN à jour ?)
- [ ] RC Professionnelle + Cyber (Hiscox, ~500–700€/an)

---

## Marque

- **LIAVO** déposée à l'INPI en personne physique (Théo Roche-Loison)
- Classes : **35, 38, 42**
- À céder à la SASU (26€, inpi.fr)

---

## Domaine & infrastructure

- **liavo.fr** — acheté OVH, 3 ans, renouvellement mars 2029
- **www.liavo.fr** — CNAME vers liavo.fr, redirect 301 www → apex
- Hébergement : **Railway EU West** (production)
- Base de données : **PostgreSQL 16** (Railway)
- Stockage fichiers : **Cloudflare R2** (bucket liavo-uploads, URL publique : https://pub-85a20d60440e4c5fa2abff95765a4ed3.r2.dev)
- Emails transactionnels : **Brevo** (BREVO_SENDER_EMAIL = contact@liavo.fr)
- Railway project : https://railway.com/project/68313907-c9fc-4ddc-9535-3a6a642e6e3c

---

## SEO & Search Console

- Propriété **liavo.fr** vérifiée en mode "domaine" dans Google Search Console
- Sitemap `https://liavo.fr/sitemap.xml` soumis — 5 pages indexables
- Balise canonical configurée dans `app/layout.tsx`
- robots.txt en place

---

## Email

- **contact@liavo.fr** opérationnel dans Gmail via Zimbra OVH (IMAP/SMTP)

---

## Comptes de test

| Email | Rôle | Mot de passe |
|---|---|---|
| enseignant@test.fr | TEACHER | Test1234! |
| directeur@test.fr | DIRECTOR | Test1234! |
| resa@lesauvageon.com | VENUE (Chalet Le Sauvageon) | Test1234! |
| admin@sejour-jeunesse.fr | ADMIN | Admin2026! |
| demo-lmdj@liavo.fr | RESEAU (La Montagne des Juniors) | LMDJ2026! |

Comptes enseignant/directeur liés à l'établissement UAI `0750001A` (Collège Victor Hugo Paris)

---

## Charte graphique (validée)

- **Couleur primaire :** `#1B4060` (bleu marine)
- **Couleur accent :** `#C87D2E` (ocre)
- **Couleur succès :** `#1E5C42` (vert)
- **Blanc cassé :** `#F5F4F1`
- **Typographie :** Inter
- **Wordmark :** "Liavo" (L majuscule, iavo minuscule)
- **Tagline logo :** "Coordonnez vos séjours"
- **Baseline communication :** "Du projet pédagogique à la facturation finale."

---

## État du produit (07 avril 2026)

### Flux principal — fonctionnel ✅
- Enseignant crée séjour → soumet appel d'offres → hébergeur reçoit demande → envoie devis → enseignant sélectionne → signature direction → espace collaboratif ouvert
- Autorisations parentales : envoi email, signature électronique, suivi
- Planning collaboratif : génération IA (algo round-robin clusters), drag & drop, parking, vue semaine/jour
- CRM hébergeur : 270 contacts Sauvageon importés, versements, rappels
- Dashboard réseau (LMDJ) : KPIs, invitation centres, onboarding score, export CSV
- Chorus Pro XML (PEPPOL UBL 2.1), facture de solde
- PDF : budget prévisionnel, projet pédagogique, devis

### Prêt pour vrais utilisateurs — 08/04/2026 ✅
- Abonnement Sauvageon : ACTIF ✅
- Onboarding enseignant testé (theo@nunayak) ✅
- Email Brevo vérification testé ✅
- Invitation enseignant depuis dashboard Sauvageon : `/dashboard/venue/inviter-enseignant`
- Base nettoyée : séjours/devis/demandes/invitations supprimés, users et clients CRM conservés ✅
- Compte admin migré vers contact@liavo.fr (role ADMIN, emailVerifie=true, compteValide=true) ✅
- Ancien compte admin@sejour-jeunesse.fr supprimé ✅

---

## Marketing & communication

### LinkedIn
- Post S1 publié : "Ce que j'ai appris en 7 ans d'accueil de classes de neige"
- Post S2 rédigé + visuel prêt
- Post S3 rédigé + visuel prêt
- Calendrier éditorial 12 semaines défini (4 phases)

### Partenaires réseaux
- **La Montagne des Juniors (LMDJ)** : Anaïtis Mangeon (directrice), démo visio confirmée fin avril avec IDDJ
- **IDDJ** : Robin Baladi (directeur), APIDAE credentials validés (54 centres)

---

## Stack technique

| Composant | Technologie |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript 5, Tailwind CSS 4 |
| Backend | NestJS 11, Prisma ORM |
| Base de données | PostgreSQL 16 |
| Auth | JWT |
| Stockage | Cloudflare R2 |
| Emails | Brevo |
| Hébergement | Railway EU West |
| DNS/Domaine | OVH |

**Repo :** `theorocheloison-hash/sejour-jeunesse`
**Local :** `C:\Users\Roche-Loison\Desktop\sejour-jeunesse`
**Déploiement :** automatique sur push `main`

---

## PISTE / Chorus Pro — État au 08/04/2026

**Compte PISTE créé** : `contact@liavo.fr` — validé
**Application SANDBOX** : `APP_SANDBOX_contact@liavo.fr` — statut Validée
**Client ID OAuth** : `13b4b067-aab9-4bd9-b3f4-c2cd737c96f5` (Confidentiel)
**API Key** : `ea844f57-0b6d-41d0-b1a9-1268fc383f84`
**Client Secret** : noté par Théo (ne pas stocker ici)
**CGU acceptées** : Factures SANDBOX + PROD ✅
**API Factures SANDBOX souscrite** ✅
**URL OAuth sandbox** : `https://sandbox-oauth.piste.gouv.fr/api/oauth/token`
**URL API sandbox** : `https://sandbox-api.piste.gouv.fr`

**Ce qui reste avant intégration code :**
- Obtenir habilitation tiers mandaté AIFE (LIAVO dépose pour compte des hébergeurs)
- Contacter support AIFE : `https://communaute.chorus-pro.gouv.fr` ou formulaire PISTE
- Une fois habilité : créer `ChorusProService` dans NestJS (OAuth2 client_credentials + dépôt XML)
- Variables Railway à ajouter : `PISTE_CLIENT_ID`, `PISTE_CLIENT_SECRET`
- L'export XML PEPPOL UBL 2.1 est déjà fonctionnel dans `devis.service.ts` → `getChorusXml()`
- Le bouton téléchargement XML existe déjà dans `/dashboard/venue/devis/page.tsx`

---

## Roadmap post-démo LMDJ (ne pas construire avant validation commerciale)

- Notification centres APIDAE non inscrits sur nouvelle demande (`demande.service.ts`, prompt CC préparé)
- ~~Import backend 54 centres IDDJ~~ **FAIT** — 54 centres en prod dans dashboard réseau, onboarding 25%
- Freemium hébergeur (infrastructure `abonnementStatut` en place, TODO dans `findOpen()`)
- Refactoring dashboards vers DashboardShell (4–6 jours dev, après démo)
- Intégration bancaire SEPA/Open Banking (horizon 18–24 mois)

---

## Modèle économique

- **Établissements scolaires :** gratuit
- **Hébergeurs :** abonnement mensuel ou annuel
- **Objectif terme :** contrats B2G avec les académies (modèle Pronote)
