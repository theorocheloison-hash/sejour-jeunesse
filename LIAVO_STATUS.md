# LIAVO — État du projet
> Dernière mise à jour : 04/05/2026 (session complète — SC8, SC5bis, audit bugs)

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
- [ ] Résiliation Railway + Cloudflare R2 — délai 1 semaine post-migration (29/04), soit ~06/05

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

> ⚠️ Railway et Cloudflare R2 = OBSOLÈTES. À résilier ~06/05.

**Scalingo CLI :** dans PATH Windows — taper `scalingo` directement
**Git/déploiement :** via CC (git add/commit/push). PowerShell = SQL uniquement.

---

## Comptes production

| Email | Rôle | Mot de passe |
|---|---|---|
| contact@liavo.fr | ADMIN | Admin2026! |
| resa@lesauvageon.com | HEBERGEUR (Chalet Le Sauvageon) | Test1234! |
| demo-lmdj@liavo.fr | RESEAU (La Montagne des Juniors) | LMDJ2026! |
| enseignant@test.fr | ORGANISATEUR | Test1234! |
| directeur@test.fr | SIGNATAIRE | Test1234! |

---

## Charte graphique

- Primaire : `#1B4060` — Accent : `#C87D2E` — Succès : `#1E5C42` — Fond : `#F5F4F1`
- Typo : Inter 400/500 uniquement (jamais DM Sans/DM Serif Display)
- Baseline : "Du projet pédagogique à la facturation finale."
- Tagline : "Coordonnez vos séjours"

---

## Positionnement validé (post-démo 28/04)

**LIAVO = couche post-mise-en-relation.**
L'hébergeur invite l'enseignant. LIAVO n'est pas un remplacement de la centrale LMDJ.
- Isabelle/Marie (LMDJ) conservent leur rôle de mise en relation
- Dashboard réseau = visibilité post-dispatch pour LMDJ/IDDJ
- Pitch hébergeurs : "La plateforme développée par les hébergeurs, pour les hébergeurs."

**Règle absolue :** aucune visio LMDJ, aucun onboarding tant que le refactor complet (doc ARCHITECTURE_ORGANISATIONS.md) n'est pas finalisé.

---

## État produit — 04/05/2026

### Ce qui est en production ✅

**Flows organisateur :**
- Inscription avec recherche établissement (API Éducation Nationale)
- Création séjour + appel d'offres géographique
- Flow invitation hébergeur → organisateur (compte dormant + magic link)
- Sélection devis → statut SELECTIONNE
- Soumission signataire (recherche UAI + invitation si non trouvé)

**Flows signataire :**
- Inscription via token avec pré-remplissage établissement
- Dashboard : liste séjours, signature électronique, soumission rectorat, Chorus Pro XML

**Flows hébergeur :**
- Inscription via invitation (3 cas : centre existant / pré-créé admin / nouveau)
- Dashboard : demandes reçues, constructeur devis, planning collaboratif, CRM
- Invitation organisateur avec recherche établissement

**Dashboard réseau :**
- 54 centres IDDJ en prod, KPIs, export CSV

**Infrastructure :**
- Vérification email, magic link, reset password
- Pages légales complètes, mandat Chorus Pro v1.1
- CORS, rate limiting, JWT_SECRET sécurisé (changé 04/05)
- Planning IA, import CSV élèves, journal séjour parents, planning PDF

**Modèle de données :**
- Organisation + Membership : tous les users hébergeurs/organisateurs rattachés
- Colonnes `etablissement*` supprimées de `utilisateurs` (SC8)
- `InvitationHebergement` enrichie (10 nouveaux champs SC5bis)
- Routes admin : invitations, claims, hébergeurs, utilisateurs, centres

### Ce qui manque encore ❌

**Avant visio LMDJ (dans l'ordre) :**
1. Page `/centre/[id]/claim` — flow "C'est mon centre" depuis le catalogue (fin SC5bis)
2. SC4ter : `getAllSejoursSignataire()` via Membership, `InvitationCollaboration.organisationCibleId`
3. SC9 : `StatutDevis` étendu + backfill (badges cohérents sur devis)
4. Migration `Client` → `RelationCommerciale` (CRM legacy)
5. `typeContexte HORS_SCOLAIRE` dans `soumettreDemandePublique()`
6. `DECLARE_TAM` dans `StatutSejour` (flow colo)

**Suspendus à validation commerciale :**
- SC7 : notifications APIDAE (prompt CC prêt)
- Freemium hébergeur (infrastructure en place, TODO à décommenter)
- Chorus Pro production (habilitation AIFE à finaliser)
- Intégration APIDAE LMDJ (1 ligne dès réception credentials)

---

## PISTE / Chorus Pro

- Compte PISTE : contact@liavo.fr — validé
- App SANDBOX validée, Client ID : `13b4b067-aab9-4bd9-b3f4-c2cd737c96f5`
- Export XML PEPPOL UBL 2.1 fonctionnel (`devis.service.ts → getChorusXml()`)
- **Pending :** habilitation tiers mandaté AIFE

---

## Démo LMDJ + IDDJ — Résultats (28/04/2026)

- **LMDJ (Anaïtis Mangeon)** : intéressée — visio de suivi à caler APRÈS fin refactor
- **IDDJ (Robin Baladi)** : attentiste — CA à consulter

---

## Roadmap post-démo (suspendus)

- SC7 : notifications APIDAE non inscrits
- Freemium hébergeur
- Refactoring DashboardShell
- JWT httpOnly cookie migration
- Chorus Pro production
- Intégration APIDAE LMDJ
- RC Pro Hiscox
- Éditeur devis colonnes configurables

---

## Financement

1. Initiative Faucigny Mont-Blanc (prêt taux zéro) → immédiat
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
| Stockage | OVH Object Storage Gravelines |
| Emails | Brevo |
| Hébergement | Scalingo Paris |
| DNS/Domaine | OVH |

---

## Règles de développement

- **Fix at source, never patch**
- **Lire les fichiers avant toute proposition** — via filesystem-liavo
- **Anticiper les bugs cascade + grep vérification** — obligatoires dans chaque prompt CC
- **git via CC, SQL via PowerShell**
- **Ne jamais push sans confirmation explicite**
