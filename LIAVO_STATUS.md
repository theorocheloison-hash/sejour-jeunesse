# LIAVO — État du projet
> Dernière mise à jour : 04/05/2026 (post-SC8, post-démo LMDJ+IDDJ)

---

## Entité juridique

**LIAVO SASU** — immatriculée 27/03/2026
- SIREN : **102 994 910** — RCS Annecy — EUID : FR7401.102994910
- Capital : **1 000 €**
- Siège : 472 Route du Mas Devant, 74440 Morillon, France
- Président : Théo Roche-Loison
- Publication légale : Eco Savoie Mont-Blanc Web, 24/03/2026

**Holding :** SAS Roche-Loison (SIREN 913 016 200) — même adresse siège

**Actions restantes :**
- [x] Compte bancaire pro LIAVO SASU ouvert (Crédit Agricole Samoëns)
- [x] Acte cession PI signé (marque INPI holding → SASU)
- [ ] RC Professionnelle + Cyber (Hiscox, ~500–700€/an) — différé post-démo
- [ ] Résiliation Railway + Cloudflare R2 (après 1 semaine de stabilité Scalingo, soit autour du 06/05)

---

## Marque & domaine

- **LIAVO** déposée INPI — classes 35, 38, 42 — cession holding → SASU effectuée
- **liavo.fr** — OVH, 3 ans, renouvellement mars 2029
- Email : contact@liavo.fr (Zimbra OVH / Gmail)

---

## Infrastructure — ÉTAT ACTUEL (post-migration 29/04/2026)

| Composant | Solution | Détail |
|---|---|---|
| Frontend | Scalingo Paris | liavo.fr |
| Backend | Scalingo Paris | api.liavo.fr |
| Base de données | PostgreSQL 17.9 Scalingo | managé, Paris |
| Stockage | OVH Object Storage Gravelines | bucket liavo-uploads, s3.gra.io.cloud.ovh.net |
| Emails | Brevo FR | contact@liavo.fr |
| DNS | OVH | dns14/ns14.ovh.net |

> ⚠️ Railway (sejour-jeunesse-production.up.railway.app) = OBSOLÈTE
> ⚠️ Cloudflare R2 = OBSOLÈTE
> À résilier tous les deux dès confirmation stabilité Scalingo (06/05 au plus tôt)

**Scalingo CLI :** `C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe`
**API token Scalingo :** tk-us-N7-mDO-KCwTf_kRhQpO09-NT_-2rXhVqMuq1Z0JEbMWLC-sf
**Clé SSH :** id_ed25519

---

## Comptes production

| Email | Rôle | Mot de passe |
|---|---|---|
| contact@liavo.fr | ADMIN | Admin2026! |
| resa@lesauvageon.com | HEBERGEUR (Chalet Le Sauvageon) | Test1234! |
| demo-lmdj@liavo.fr | RESEAU (La Montagne des Juniors) | LMDJ2026! |

---

## Charte graphique

- Primaire : `#1B4060` — Accent : `#C87D2E` — Succès : `#1E5C42` — Fond : `#F5F4F1`
- Typo : Inter 400/500 uniquement (jamais DM Sans/DM Serif Display)
- Baseline : "Du projet pédagogique à la facturation finale."
- Tagline : "Coordonnez vos séjours"

---

## Positionnement validé (post-démo 28/04)

**LIAVO = couche post-mise-en-relation.**
L'hébergeur invite l'enseignant. LIAVO n'est pas un remplacement de la centrale LMDJ — c'est la plateforme de coordination une fois la mise en relation faite par l'équipe LMDJ.
- Isabelle/Marie (LMDJ) conservent leur rôle de mise en relation
- Dashboard réseau = visibilité post-dispatch pour LMDJ/IDDJ
- Pitch hébergeurs : "La plateforme développée par les hébergeurs, pour les hébergeurs."

---

## État produit — 04/05/2026

### Features en production ✅

**Flows organisateur (enseignant) :**
- Inscription avec recherche établissement (API Éducation Nationale)
- Création séjour (formulaire 3 étapes)
- Flow invitation hébergeur → enseignant :
  - Compte dormant + magic link (pas de mot de passe requis à l'inscription)
  - Séjour DRAFT + DemandeDevis créés automatiquement
  - Bouton "Modifier" sur séjour DRAFT
  - Badge "X devis reçu(s)" + bouton "Voir les offres"
- Sélection devis → statut SELECTIONNE
- Soumission au directeur (recherche par UAI + invitation si non trouvé)

**Flows signataire (directeur) :**
- Inscription avec établissement obligatoire
- Page `/register/signataire?token=UUID` : pré-remplissage depuis invitation
- Dashboard signataire : liste séjours par UAI, signature électronique devis, refus, soumission rectorat, paramètres email DSDEN, Chorus Pro XML
- Persistance UAI : trouvé automatiquement pour tous les futurs séjours du même établissement

**Flows hébergeur :**
- Dashboard venue : demandes reçues, création devis HT/TTC, gestion planning, CRM clients
- Invitation organisateur avec recherche établissement scolaire
- Constructeur devis avec catalogue + autocomplétion + PDF inline

**Dashboard réseau :**
- Rôle RESEAU, compte demo-lmdj@liavo.fr / LMDJ2026!
- 54 centres IDDJ importés via APIDAE en prod (intégration prod OK)
- KPIs, filtres période, invitation centres, slide-over fiche, export CSV

**Infrastructure :**
- Flow vérification email + magic link
- Pages légales complètes (CGU, CGV, mentions légales, confidentialité, mandat Chorus Pro v1.1)
- Footer légal injecté via layout.tsx sur toutes les routes /dashboard/*
- CORS whitelist, rate limiting
- Planning IA (Anthropic claude-sonnet-4-5, fire-and-forget)
- Import CSV élèves (Pronote/ONDE), journal séjour parents, lien journal depuis autorisation
- Planning PDF A4 paysage

**SC8 — À déployer (commit + push en attente) :**
- Suppression colonnes `etablissement*` sur User — données migrées vers Organisation/Membership
- Build backend + frontend : exit 0, 0 erreur TypeScript
- Migration SQL prête : `migrations/20260504_sc8_drop_etablissement_columns/migration.sql`

### PISTE / Chorus Pro

- Compte PISTE : contact@liavo.fr — validé
- App SANDBOX : APP_SANDBOX_contact@liavo.fr — validée
- Client ID OAuth : `13b4b067-aab9-4bd9-b3f4-c2cd737c96f5`
- API Key : `ea844f57-0b6d-41d0-b1a9-1268fc383f84`
- Export XML PEPPOL UBL 2.1 fonctionnel (`devis.service.ts → getChorusXml()`)
- **Pending :** habilitation tiers mandaté AIFE

### Sécurité — à corriger

- ⚠️ **JWT_SECRET=dev-secret-2024 encore en prod Scalingo** — changer avant tout déploiement sensible :
  ```bash
  scalingo --app liavo-backend --region osc-fr1 env-set JWT_SECRET=$(openssl rand -hex 32)
  ```

---

## Démo LMDJ + IDDJ — Résultats (28/04/2026)

- **LMDJ (Anaïtis Mangeon)** : intéressée — visio de suivi à caler
- **IDDJ (Robin Baladi)** : attentiste — CA à consulter
- **Prochaine étape :** adapter le pitch au pivot positionnement, caler la visio LMDJ

---

## Roadmap post-démo

### Ne pas construire avant validation commerciale
- **Notification centres APIDAE non inscrits** (SC7) : prompt CC préparé, suspendu à LMDJ/IDDJ
- **Freemium hébergeur** : infrastructure abonnementStatut en place, TODO dans findOpen() à décommenter
- **Refactoring DashboardShell** : 4-6j, risque moyen
- **JWT httpOnly cookie** : migration délibérément différée post-démo (risque régression auth)
- **Chorus Pro production** : finaliser habilitation AIFE, créer ChorusProService NestJS
- **Intégration APIDAE LMDJ** : une ligne dans syncApidae() une fois credentials reçus
- **RC Pro** : ~500-700€/an Hiscox, différé post-démo
- **Éditeur devis colonnes configurables** : 3-4j dev, post-validation commerciale

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
| Base de données | PostgreSQL 17 |
| Auth | JWT |
| Stockage | OVH Object Storage Gravelines |
| Emails | Brevo |
| Hébergement | Scalingo Paris |
| DNS/Domaine | OVH |

**Repo :** `theorocheloison-hash/sejour-jeunesse`
**Local :** `C:\Users\Roche-Loison\Desktop\sejour-jeunesse` (copie UNIQUE)
**Déploiement :** push main → Scalingo auto (backend + frontend)
**GitHub auth :** OAuth via Git Credential Manager (renouvellement auto). Ne JAMAIS hardcoder de token dans .git/config.

---

## Règles de développement

- **Fix at source, never patch** — règle absolue
- **Lire les fichiers avant toute proposition** — via filesystem-liavo
- **Anticiper les bugs cascade** avant d'écrire le moindre code
- **Ne jamais push sans confirmation explicite de Théo**
- `str_replace` non fiable sur Windows → utiliser `write_file` ou `edit_file`
- **Valider le contenu exact avec Théo avant tout write_file** — présenter → attendre "ok" → agir
