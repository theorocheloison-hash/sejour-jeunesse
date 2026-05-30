# LIAVO — État du projet
> Dernière mise à jour : 30/05/2026 (Lot 1 conformité facturation — entité Facture immuable — TERMINÉ)

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

## Chantiers récents livrés

### 29/05/2026

> Détail complet dans LIAVO_SESSION_STATE.md.

- **Refonte page séjour** : extraction TabDevisFacturation, TabNotes, SejourHeader ; page liste séjours `/hebergeur/sejours` ; planning 5 couleurs statut (`planning-statut.ts` partagé) ; CRM dérivé auto (kanban). page.tsx ~5000 → ~3200 lignes. Réf : `ARCHITECTURE_UX_SEJOUR_FINAL.md`.
- **Cohérence planning** : la couleur planning reflète le devis le plus AVANCÉ (plus le plus récent) ; palette partagée mono-centre + global ; `derivePlanningStatut` durci + `statutDevisLePlusAvance()` ; backend `getMesSejoursPlanning` et `getDashboardGlobal` renvoient tous les devis (filtre centre). Consommateurs vérifiés : planning, sejours (liste + filtre), global.
- **JWT_SECRET prod** : confirmé RÉGLÉ (secret aléatoire long). Code lit via `config.getOrThrow('JWT_SECRET')` dans `auth.module.ts` + `jwt.strategy.ts`, aucun fallback faible. Plus une dette de sécurité.

### 30/05/2026 — Lot 0 conformité facturation

- **Compteur séquentiel atomique** : table `SequenceNumero` scopée `[emetteurId, annee, typeDoc]`, incrément transactionnel (upsert + increment + retry P2002). `emetteurId = centre.organisationId ?? centre.id`. Formats : `DEV-{annee}-{NNNN}`, `FA-{annee}-{NNNN}`, `FS-{annee}-{NNNN}`. UNE séquence FACTURE par émetteur (acompte+solde continus). Numéros non overridables. `generateNumeroDevis` (COUNT) supprimée.
- **Fix montantAcompte** : nouveau champ `montantSolde` (Float?) ; `facturerSolde` écrit `montantSolde`, ne touche plus `montantAcompte`. 12 lecteurs recensés et justifiés (corrigés ou safe). getChorusXml, ajouterVersement, supprimerVersement, frontend TabDevisFacturation + 5 mappers PDF corrigés.
- **Champs Devis ajoutés** : `emetteurId` (Uuid), `montantSolde` (Float?) + index unique partiel `[emetteurId, numeroFacture] WHERE NOT NULL`.
- **DevisLibre** : confirmé quasi-mort (pas de controller/service), non touché. Migration 20260528 a basculé les données dans Devis.
- **Diagnostic prod** : 0 FACTURE_SOLDE, 1 FACTURE_ACOMPTE (test). Aucun montant corrompu. Migration DDL seule, pas de backfill.
- **Logo retour dashboard** : vérifié fonctionnel tous rôles (organisateur, signataire, hébergeur via DashboardShell). `ROLE_DASHBOARD_PATH` déjà en place. Point fermé.

### 30/05/2026 — Lot 1 conformité facturation (entité Facture immuable)

> Détail complet dans LIAVO_SESSION_STATE.md.

- **Entité `Facture` immuable** : snapshot émetteur/destinataire/montants/lignes figé à l'émission. Le Devis ne mute plus (statut/typeDocument inchangés, reste modifiable). Migration DDL `20260530140000_lot1_facture` (tables `factures`, `lignes_facture`, `VersementPaiement.factureId`, `Devis.factures[]`).
- **Scission module facturation** : nouveau `facture/` (`FactureService` + `FactureController`) et `sequence/` (`SequenceService` partagé). `DevisService` nettoyé (−411 lignes) : facturation/versements/Chorus retirés ; `getMesDevis`/`getDevisById` incluent les factures ; `updateDevis` déverrouillé (SIGNE_DIRECTION + devis directs). Anciennes routes `PATCH /devis/:id/facturer-*` supprimées, remplacées par `POST /factures/acompte|solde` etc.
- **Solde** = total TTC révisé du devis − acompte déjà facturé ; refusé tant que l'acompte n'est pas validé.
- **Frontend basculé sur les factures liées** : `lib/devis.ts` (types + helpers `getFactureAcompte/Solde/etatFacturation`), `planning-statut.ts`, CRM `deriveClientStatus`, `TabDevisFacturation`, `hebergeur/devis`, `signataire`. Versements ciblés par factureId. Grep legacy frontend = 0. Builds backend + `tsc --noEmit` = 0 erreur.

---

## Chantier conformité facturation (cadrage 30/05/2026)

**Contexte** : Sauvageon organise déjà de vrais séjours → besoin de facturer en conforme (particuliers/mariages ET scolaires/collectivités).

**Décisions de cadrage :**
- **D1** — Quick-fix à la source (Lot 0) ✅ TERMINÉ 30/05/2026.
- **D2** — Entité **Facture séparée et immuable** (snapshot figé à l'émission). Plus de mutation du devis en facture.
- **D3** — Format **Factur-X profil EN 16931** (PDF/A-3 lisible + XML CII embarqué). Couvre B2B, B2G et sert de facture lisible B2C.
- **Émetteur** = l'entité juridique au SIRET (numérotation séquentielle UNIQUE par émetteur). L'adresse affichée = celle de l'établissement (le centre) concerné. LIAVO = tiers via mandat de facturation.
- **Transmission** : LIAVO ne devient PAS PDP. Dépôt sur **Chorus Pro via PISTE** (compte à créer / habilitation AIFE) pour le **B2G** (collèges publics, mairies/colos). B2B (PDP) = hors scope pour l'instant. B2C (mariages) = facture conforme + e-reporting, pas de plateforme.

**Calendrier légal (sourcé) :** réception e-invoice obligatoire pour tous le 01/09/2026 ; émission PME/TPE/micro le 01/09/2027 ; **Chorus Pro B2G déjà obligatoire depuis le 01/01/2020 sans seuil**. Cadre : art. 91 LF 2024 + décret 25/03/2024.

**Lots :**
- **Lot 0** ✅ TERMINÉ 30/05/2026 — compteur séquentiel + fix montantAcompte.
- **Lot 1** ✅ TERMINÉ 30/05/2026 — Entité `Facture` immuable (snapshot lignes/montants/émetteur/destinataire) + scission module `facture/` + bascule frontend.
- **Lot 2** — Génération PDF facture avec mentions légales (produit directement en PDF/A-3).
- **Lot 3** — Annulation par avoir (jamais de suppression).
- **Lot 4** — Factur-X EN 16931 (CII embarqué dans PDF/A-3) + dépôt Chorus Pro via PISTE.

**À garder en tête :** `getChorusXml` actuel génère de l'UBL EN 16931 (réutilisable comme base) mais Factur-X exige du **CII** embarqué dans un **PDF/A-3** ; React-PDF ne produit pas du PDF/A-3 nativement → lib dédiée à trancher au Lot 4.

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
- CORS, rate limiting, JWT_SECRET sécurisé
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
- **Décision 30/05** : transmission Chorus Pro via PISTE = le canal retenu pour le B2G (pas de PDP). À finaliser au Lot 4 du chantier conformité.

---

## Démo LMDJ + IDDJ — Résultats (28/04/2026)

- **LMDJ (Anaïtis Mangeon)** : intéressée — visio de suivi à caler APRÈS fin refactor
- **IDDJ (Robin Baladi)** : attentiste — CA à consulter

---

## Roadmap

### Conformité facturation (Lots 1-4)
- Lot 1 : entité Facture immuable ✅ TERMINÉ 30/05/2026
- Lot 2 : PDF facture mentions légales (~1-2j)
- Lot 3 : annulation par avoir (~1j)
- Lot 4 : Factur-X EN16931 + dépôt Chorus Pro via PISTE (~2-3j)

### UX restant
- Invitations parents : 2 parents/tuteurs par enfant (modèle actuel = 1)
- Flux direction : page publique de signature + boutons dans TabDevisFacturation
- SejourHeader : adapter lien retour au rôle de l'utilisateur (mineur)

### Commercial
- Visio LMDJ à caler (Anaïtis/Isabelle/Marie) — adapter pitch au positionnement post-mise-en-relation
- IDDJ : attendre retour CA avant relance Robin
- Credentials APIDAE LMDJ non encore reçus d'Anaïtis

### Suspendus (validation commerciale)
- SC7 : notifications APIDAE non inscrits
- Freemium hébergeur
- Intégration APIDAE LMDJ
- Chorus Pro production (habilitation AIFE)

### Facturation abonnements LIAVO → hébergeur (~août-sept 2026)
Abonnements payants prévus ~dans 3 mois, AUCUNE facture émise à ce jour. Réutilise le socle Facture du chantier conformité (entité immuable, compteur séquentiel, Factur-X). Mécanique propre : récurrence mensuelle/annuelle, Stripe, TVA SaaS 20%, relances. NON URGENT.

### Multi-centre (après conformité)
Onboarding /centre/[id]/claim + facturation multi-centre. Levier commercial fort (Yves Massard 3 centres, Quentin Dervaux/UFCV national).

### Dette technique
- DashboardShell : migrer toutes les pages (teacher, director, sejour) — estimé 4-6j, risque régression
- DevisLibre : supprimer le modèle/table (quasi-mort, confirmé)
- DTO cleanup : retirer `numeroDevis` du front (envoyé mais ignoré)
- Résiliation Railway + Cloudflare R2
- Migration GitHub → forge française (non prioritaire tant que solo)
- JWT httpOnly cookie migration

### Financement
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
