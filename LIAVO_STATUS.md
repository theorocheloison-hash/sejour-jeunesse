# LIAVO — État du projet
> Dernière mise à jour : 19 avril 2026

---

## Entité juridique

**LIAVO SASU** — immatriculée 27/03/2026
- SIREN : **102 994 910** — RCS Annecy — EUID : FR7401.102994910
- Capital : **1 000 €**
- Siège : 472 Route du Mas Devant, 74440 Morillon, France
- Président : Théo Roche-Loison
- Publication légale : Eco Savoie Mont-Blanc Web, 24/03/2026

**Actions restantes :**
- [x] Compte bancaire pro LIAVO SASU ouvert (Crédit Agricole Samoëns)
- [ ] Céder la marque INPI (personne physique → SASU) — formulaire INPI, ~26€
- [ ] RC Professionnelle + Cyber (Hiscox, ~500–700€/an) — différé post-démo

---

## Marque & domaine

- **LIAVO** déposée INPI en personne physique — classes 35, 38, 42 — à céder à la SASU
- **liavo.fr** — OVH, 3 ans, renouvellement mars 2029
- Hébergement : **Railway EU West** (production)
- DB : **PostgreSQL 16** (Railway)
- Stockage : **Cloudflare R2** (bucket liavo-uploads)
- Emails : **Brevo** (contact@liavo.fr)
- Railway project : https://railway.com/project/68313907-c9fc-4ddc-9535-3a6a642e6e3c

---

## Comptes production

| Email | Rôle | Mot de passe |
|---|---|---|
| contact@liavo.fr | ADMIN | Admin2026! |
| resa@lesauvageon.com | VENUE (Chalet Le Sauvageon) | Test1234! |
| demo-lmdj@liavo.fr | RESEAU (La Montagne des Juniors) | LMDJ2026! |

---

## Charte graphique

- Primaire : `#1B4060` — Accent : `#C87D2E` — Succès : `#1E5C42` — Fond : `#F5F4F1`
- Typo : Inter 400/500 uniquement
- Baseline : "Du projet pédagogique à la facturation finale."
- Tagline : "Coordonnez vos séjours"

---

## État produit — 19 avril 2026

### Features en production ✅

**Flows enseignant :**
- Inscription enseignant avec recherche établissement (API Éducation Nationale)
- Création séjour via formulaire 3 étapes (appel d'offres ouvert)
- Flow invitation hébergeur → enseignant :
  - Hébergeur invite avec pré-remplissage établissement scolaire
  - Enseignant crée son compte → email vérification → redirect invitation → confirmation explicite
  - Séjour DRAFT créé + DemandeDevis OUVERTE vers l'hébergeur automatiquement
  - Bouton "Modifier" sur séjour DRAFT (niveauClasse, activités, budget, horaires, transport)
  - Badge "X devis reçu(s)" + bouton "Voir les offres" visible sur carte DRAFT si demande existante
  - Bouton "Lancer l'appel d'offres" masqué si demande déjà existante (flow invitation)
- Sélection devis → statut SELECTIONNE
- Soumission au directeur :
  - Recherche automatique directeur par UAI
  - Si trouvé : email direct
  - Si non trouvé : modale saisie email → invitation à créer compte directeur avec établissement pré-rempli + contexte séjour
  - Anti-spam 24h

**Flows directeur :**
- Inscription directeur avec établissement obligatoire (auto-déclaration, vérification LIAVO mentionnée)
- Page `/register/director?token=UUID` : pré-remplissage établissement depuis invitation + bandeau contexte
- Dashboard directeur : liste séjours par UAI, filtres, signature électronique devis, refus, soumission rectorat, paramètres email DSDEN, Chorus Pro XML
- Persistance : une fois inscrit avec son UAI, trouvé automatiquement pour tous les futurs séjours du même établissement

**Flows hébergeur :**
- Dashboard venue : demandes reçues, création devis HT/TTC, gestion planning, CRM clients
- Invitation enseignant avec recherche établissement scolaire
- Envoi devis → enseignant notifié

**Infrastructure :**
- Flow vérification email complet (sessionStorage redirect préservé)
- Pages légales : CGU, CGV hébergeurs, mentions légales, confidentialité, mandat facturation Chorus Pro v1.1
- Footer légal injecté via layout.tsx sur toutes les routes /dashboard/*
- CORS whitelist, rate limiting, logs R2 supprimés

**Landing :**
- Bloc réseau LAMDJ/IDDJ supprimé (prématuré) — code conservé dans PricingTable.tsx commenté
- "649 centres référencés" conservé dans bandeau hero et CTA final (chiffre base officielle EN)

**Dashboard réseau :**
- Rôle RESEAU, compte demo-lmdj@liavo.fr / LMDJ2026!
- 54 centres IDDJ importés via APIDAE en prod, onboarding 25%
- KPIs, filtres période, invitation centres, slide-over fiche, export CSV

### PISTE / Chorus Pro

- Compte PISTE créé : contact@liavo.fr — validé
- App SANDBOX : APP_SANDBOX_contact@liavo.fr — validée
- Client ID OAuth : `13b4b067-aab9-4bd9-b3f4-c2cd737c96f5`
- API Key : `ea844f57-0b6d-41d0-b1a9-1268fc383f84`
- CGU Factures SANDBOX + PROD acceptées ✅
- API Factures SANDBOX souscrite ✅
- Export XML PEPPOL UBL 2.1 fonctionnel dans `devis.service.ts → getChorusXml()`
- Bouton téléchargement XML dans `/dashboard/venue/devis/page.tsx`
- **Pending :** habilitation tiers mandaté AIFE (LIAVO dépose pour hébergeurs) → https://communaute.chorus-pro.gouv.fr

---

## Démo LMDJ + IDDJ

- Date : fin avril 2026 (28 ou 30 avril, visio)
- Contacts : Anaïtis Mangeon (LMDJ), Robin Baladi (IDDJ)
- Credentials LMDJ : non encore reçus d'Anaïtis
- Credentials IDDJ : apiKey=mr8RQgOh, projetId=3217, selectionId=67523 — intégration prod OK
- Dashboard démo : demo-lmdj@liavo.fr / LMDJ2026!

---

## Roadmap post-démo (ne pas construire avant validation commerciale)

- **Notification centres APIDAE non inscrits** : modifier demande.service.ts create() → fire-and-forget notifierCentresApidae(), rate limit 7j. Prompt CC préparé.
- **Freemium hébergeur** : infrastructure abonnementStatut en place, TODO dans findOpen() à décommenter
- **Refactoring DashboardShell** : teacher/page.tsx, director/page.tsx, venue/page.tsx → composant unique. Estimé 4-6 jours, risque moyen — après démo.
- **JWT httpOnly cookie** : migration délibérément différée post-démo (risque régression auth)
- **Chorus Pro production** : finaliser habilitation AIFE, créer ChorusProService NestJS, variables Railway PISTE_CLIENT_ID + PISTE_CLIENT_SECRET
- **Intégration APIDAE LMDJ** : une ligne dans syncApidae() une fois credentials reçus
- **RC Pro** : ~500-700€/an Hiscox, différé post-démo

---

## Financement

Séquence validée :
1. Initiative Faucigny Mont-Blanc (membre CA, prêt taux zéro) → immédiat
2. Start-up & Go Emergence post-SIREN → en cours
3. Réseau Entreprendre Haute-Savoie → 6 mois
4. BPI → 12-18 mois avec pilote rectorat

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
**Déploiement :** automatique sur push main

---

## Règles de développement

- **Fix at source, never patch** — règle absolue
- **Lire les fichiers avant toute proposition** — via filesystem-liavo
- **Anticiper les bugs cascade** avant d'écrire le moindre code
- **Ne jamais push sans confirmation explicite de Théo**
- `str_replace` non fiable sur Windows → utiliser `write_file` ou `edit_file`
- Migration sans .env local → créer SQL manuellement (même pattern que invitation_etablissement)
- Railway démarrage backend : 2-3 min (start.sh migration loop)
