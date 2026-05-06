# LIAVO — Journal d'avancement

> Fichier de référence pour les sessions de développement.
> `ARCHITECTURE_ORGANISATIONS.md` reste le doc de référence architectural.
> Ce fichier documente uniquement **ce qui a été fait, décidé et déployé** session par session.

---

## État global des sous-chantiers (05/05/2026)

| SC | Statut | Détail |
|---|---|---|
| SC0 | ✅ PROD | Scalingo Paris (liavo-backend + liavo-frontend), OVH Object Storage Gravelines, Brevo FR, DNS OVH |
| SC1 | ✅ PROD | Schéma Prisma Organisations+Memberships+RelationCommerciale, backfill BDD, doublons nettoyés |
| SC1bis | ✅ PROD | findOrCreateOrganisation(), helpers centralisés |
| SC2 | ✅ PROD | GET /organisations/search |
| SC3 | ✅ PROD | StructureSearch.tsx — debounce, clavier, badge source, allowFreeText |
| SC4 | ✅ PROD | Rôles français (ORGANISATEUR/SIGNATAIRE/HEBERGEUR/AUTORITE), routes renommées |
| SC4bis | ✅ PROD | claim.service.ts, upload Kbis, page admin /dashboard/admin/claims |
| SC4ter | ✅ PROD | InvitationDirecteur enrichie (organisationId+typeContexte), registerSignataire() Membership auto, getAllSejoursSignataire() via Membership+email |
| SC5 | ✅ PROD | getProfile() enrichi, dashboards lisent user.organisation, routes françaises 301 |
| SC5bis | ✅ PROD | 6 routes hébergeur corrigées, /centre/[id]/claim, page admin invitations, corrections registerHebergeur()+matching APIDAE+deduplication searchPublic() |
| SC6 | ✅ PROD | /catalogue, /catalogue/[id], /appel-offres, magic link, compte dormant, /auth/callback |
| SC7 | ⏸ SUSPENDU | Widget signalement + notification auto — attente validation commerciale LMDJ/IDDJ |
| SC8 | ✅ PROD | Suppression 7 colonnes etablissement* sur User, migration SQL appliquée, JWT_SECRET changé |
| SC9 | ✅ PROD | StatutDevis étendu (FACTURE_ACOMPTE/SOLDE), backfill SQL appliqué manuellement, migration 20260505_sc9 créée |
| Landing | ✅ PROD | Refactor complet landing (commit 0010a50) — nouveau design, restructuration hero, actors flow, catalogue enrichi |
| Catalogue public | ✅ PROD | /catalogue refactorisé — même UX que dashboard organisateur, 700+ résultats, filtres multi-champs, vraies photos |

**Prochains chantiers (ordre) :** CRM legacy (Rappel+ContactClient → RelationCommerciale, section 3.7 ARCHITECTURE_ORGANISATIONS.md) → HORS_SCOLAIRE/DECLARE_TAM → SC7 post-validation commerciale

---

## Sessions

### Session 05/05/2026 — Landing page refactor complet (Passe 1 + Passe 2)

**Contexte :** Refactorisation complète de la landing existante. Deux passes successives via Claude Code.

**Passe 1 — Corrections ponctuelles (commit antérieur à 0010a50) :**
- [A] Hero eyebrow "Nouvelle plateforme" supprimé
- [B] Hero note "30 jours d'essai · sans CB" supprimé
- [C] 3 boutons hero-cta → 2 boutons : "Je suis hébergeur" (primary) + "Découvrir les trois profils ↓" (outline → #profils)
- [D] Hero pills RGPD/Chorus Pro/France supprimés du hero
- [E] Badges profils : "Solution payante" → "30 jours d'essai" / "Gratuit" (×2) → "Offert"
- [F] "Réseaux" ajouté dans nav-links (href="#reseau") + id="reseau" sur section network-section
- [G] h2 pricing : pas de "Pricing" trouvé (déjà supprimé en [J])
- [H] "workflow administratif" → "flux administratif" dans section #enseignants
- [I] "app à installer" → "application à installer" (2 occurrences)
- [J] section-head du #pricing supprimé (eyebrow + h2 + section-lead), pricing-banner + PricingTable conservés
- [K] "Conforme RGPD. " ajouté en tête du <p> de la carte "Données des mineurs protégées"
- [L] Footer "Annecy, France" → "Morillon, Haute-Savoie"
- [M][N] Règles CSS orphelines supprimées : .hero-eyebrow, .hero-note
- [O] .hero-pills/.pill/.pill .dot conservés — réutilisés dans #collaboratif

**Passe 2 — Restructuration + animations (commit 0010a50) :**
- [1] Dashboard mockup déplacé du hero vers section #hebergeurs (entre .features et .ps-cta). Gradient ::after corrigé var(--navy) → var(--bg). Hero padding-bottom 80px.
- [2] Section #collaboratif déplacée après #colonies (avant #catalogue). Tag "Différenciation · Inexistant ailleurs" supprimé. Nav-links réordonnés : Hébergeurs → Enseignants → Colonies → Espace collaboratif → Réseaux → Catalogue → Tarifs.
- [3] Pills 5 acteurs remplacés par .actors-flow avec .actor-node/.actor-connector + SVG animé (ligne ocre strokeDashoffset animée, déclenchée par .actors-flow.in via IntersectionObserver existant, delay --line-index par connecteur).
- [4] CATALOGUE_CARDS enrichi (region, description, slug). JSX cards : cat-card-region, cat-desc, cat-card-cta.
- Section #collaboratif passée en .persona-section.dark (fond navy) — fix contraste actors-flow.

**Fichiers modifiés :**
- `frontend/app/page.tsx`
- `frontend/app/landing.css`

**Ajout antérieur (même journée) :**
- `.hero-catalogue-cta` : bandeau ocre "Parcourir le catalogue de centres" entre hero-note et hero-pills (remplace le lien inline invisible)

**Statut :** déployé en production (commit 0010a50, push origin/main, Scalingo auto-deploy).

**Points restants identifiés (non bloquants pour le déploiement) :**
- Point 3 (bug catalogue en localhost) : à valider en prod — résolu si backend Scalingo répond
- Point 10 (hover features hébergeur → screenshot réel) : assets non disponibles, à faire en Phase A post-validation commerciale
- Point 13 (trait animé acteurs) : implémenté via actors-flow + SVG animé

---

### Session 05/05/2026 — SC9 StatutDevis

**Contexte :** `SELECTIONNE` couvrait 5 états différents. Fix à la source : extension enum + backfill + badges frontend.

**Fichiers modifiés :**
- `backend/prisma/schema.prisma` : ajout `FACTURE_ACOMPTE` + `FACTURE_SOLDE` dans enum `StatutDevis`
- `backend/src/devis/devis.service.ts` : `facturerAcompte()` + `facturerSolde()` écrivent `statut` en plus de `typeDocument`
- `frontend/src/lib/devis.ts` : type `StatutDevis` étendu
- `frontend/app/dashboard/hebergeur/devis/page.tsx` : `STATUT_BADGE` enrichi (indigo/teal), `matchesOnglet` double critère statut+typeDocument, `actionsUrgentes` aligné sur `SIGNE_DIRECTION`
- Cascades CC : `dashboard/organisateur/demandes/page.tsx` + `sejours/[id]/offres/page.tsx` — `STATUT_BADGE` enrichi

**Migration :** appliquée manuellement via psql Scalingo :
```sql
ALTER TYPE "StatutDevis" ADD VALUE IF NOT EXISTS 'FACTURE_ACOMPTE';
ALTER TYPE "StatutDevis" ADD VALUE IF NOT EXISTS 'FACTURE_SOLDE';
```
Fichier `20260505_sc9_statut_devis_facture/migration.sql` créé et pushé.

**Statut :** déployé en production.

---

### Session 05/05/2026 — Catalogue public refactor

**Problème :** `/catalogue` public était une régression vs dashboard organisateur.

**Solution :** GET /hebergements exposé publiquement + /catalogue réécrit.

**Fichiers modifiés :**
- `backend/src/hebergements/hebergement.controller.ts` : guards retirés sur GET /hebergements et GET /hebergements/:id
- `frontend/src/lib/hebergement.ts` : searchHebergementsPublic() + getHebergementPublic()
- `frontend/app/catalogue/page.tsx` : filtres multi-champs, autocomplete geo.api.gouv.fr, vraies photos
- `frontend/app/catalogue/[id]/page.tsx` : migré vers Hebergement public

**Statut :** déployé en production.

---

### Session 28/04/2026 — Démo LMDJ+IDDJ + features livrées

**Démo faite :** visio LMDJ (Anaïtis Mangeon + Isabelle Louat + Marie Charvolin) + IDDJ (Robin Miglioli). LMDJ intéressée, visio de suivi à caler. IDDJ attentiste (CA à consulter).

**Pivot positionnement validé :**
- LIAVO = couche post-mise-en-relation, pas remplacement de la centrale LMDJ
- L'hébergeur invite l'enseignant (pas d'appel d'offres côté enseignant)
- Isabelle/Marie (LMDJ) gardent leur rôle de mise en relation

**Features livrées pour la démo :**
- Planning PDF A4 paysage (export)
- Import CSV élèves Pronote/ONDE (sans email auto + envoi invitations sélectif)
- Journal séjour parents (posts+photos+planning regroupé+réactions placeholder)
- Lien journal depuis page autorisation parentale

**Séjour démo en prod :** "4ème Morillon APPN", statut CONVENTION, 48 élèves, 5 accompagnateurs

---

### Session 29/04/2026 — Migration infra France + ARCHITECTURE_ORGANISATIONS v3

**Migration infra complète (SC0) :**
- Backend + BDD : Scalingo Paris (liavo-backend, PostgreSQL 17.9)
- Frontend : Scalingo Paris (liavo-frontend)
- Stockage : OVH Object Storage Gravelines (liavo-uploads, S3, endpoint s3.gra.io.cloud.ovh.net)
- Emails : Brevo FR — DNS : OVH
- URLs prod : liavo.fr (front), api.liavo.fr (back)
- Railway + Cloudflare R2 : à résilier après 1 semaine de stabilité

**Scalingo CLI :** `C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe`
**Commande SQL prod :** `scalingo --app liavo-backend --region osc-fr1 pgsql-console`

---

### Session 19/04/2026 — Landing prod + séjour démo

- Landing livrée en prod, favicon LIAVO ajouté
- Séjour démo "4ème Morillon APPN" créé en prod : statut CONVENTION, 48 élèves, 5 accompagnateurs
- Base nettoyée, CRM 270 clients Sauvageon conservés
- Admin prod migré sur contact@liavo.fr

---

### Session 08/04/2026 — Nettoyage prod + dashboard réseau

**Dashboard réseau livré (rôle RESEAU) :**
- Route `/dashboard/reseau` avec KPIs, filtres période, invitation centres, slide-over fiche, onboarding score 0-4, export CSV
- Compte démo : demo-lmdj@liavo.fr / LMDJ2026!
- Import IDDJ : 54 centres APIDAE en prod (apiKey=mr8RQgOh, projetId=3217, selectionId=67523)

---

## Infra de référence (état 05/05/2026)

| Composant | Service | Détail |
|---|---|---|
| Backend | Scalingo Paris | liavo-backend, Node 20, NestJS |
| BDD | Scalingo PostgreSQL 17.9 | liavo-backend-db |
| Frontend | Scalingo Paris | liavo-frontend, Next.js 15, standalone |
| Stockage | OVH Object Storage Gravelines | liavo-uploads, S3 compatible |
| Emails | Brevo FR | contact@liavo.fr |
| DNS | OVH | dns14/ns14.ovh.net |
| Repo | GitHub | theorocheloison-hash/sejour-jeunesse |
| CI/CD | Push main → Scalingo auto | Procfile: prisma migrate deploy + start:prod |

**URLs prod :** https://liavo.fr | https://api.liavo.fr
**Admin prod :** contact@liavo.fr
**Compte Sauvageon :** resa@lesauvageon.com ← seule adresse valide (jamais contact@chalet-sauvageon.fr)
**Compte démo réseau :** demo-lmdj@liavo.fr / LMDJ2026!

---

## Points ouverts (05/05/2026)

| Point | Priorité | Détail |
|---|---|---|
| CRM legacy | 🔴 PROCHAIN | Rappel+ContactClient → RelationCommerciale (section 3.7 doc archi). Estimé 1 jour. |
| HORS_SCOLAIRE/DECLARE_TAM | 🟠 Après CRM | typeContexte sur Sejour, flow colo complet |
| Visio LMDJ de suivi | 🟡 À caler | Anaïtis Mangeon — prérequis : CRM legacy + HORS_SCOLAIRE + DECLARE_TAM |
| Railway + R2 résiliation | 🔴 URGENT | Deadline ~06/05 (1 semaine après migration Scalingo) — ne pas oublier |
| SC7 widget signalement | ⏸ SUSPENDU | Attente validation commerciale LMDJ/IDDJ |
| JWT httpOnly cookie | ⏸ DIFFÉRÉ | Post-validation commerciale, risque régression auth |
| DashboardShell unifié | ⏸ DIFFÉRÉ | 4-6 jours, risque moyen — ne pas faire avant stabilité commerciale |
| Mentions légales hébergeur | 🔵 Futur | "Railway Corp." encore mentionné → mettre à jour Scalingo + OVH |
| Landing — hover features hébergeur | 🔵 Post-commercial | Assets (screenshots dashboard) requis. Implémentation technique prête côté CSS. |
| Chorus Pro AIFE inscription | 🔵 Futur | Vérifier getChorusXml() fonctionnel, inscription SIRET 102 994 910 00010 |
| RC Pro insurance | 🔵 Futur | ~500-700€/an, différé post-démo |
| GitHub → Gitea VPS OVH | 🔵 Long terme | Quand recrutement 2e dev ou appel d'offres public |

---

## Roadmap — Fonctionnalités nouvelles identifiées (05/05/2026)

Ces items ont été ajoutés lors de la session du 05/05 et ne sont pas encore spécifiés techniquement. À prioriser après CRM legacy + HORS_SCOLAIRE.

### 1. Menu intelligent IA (Phase B.3)

**Concept :** dans l'espace collaboratif d'un séjour, proposer automatiquement des menus journaliers adaptés aux allergies et régimes déclarés dans les fiches sanitaires des participants.

**Inputs disponibles :** fiches sanitaires (allergies, intolérances, régimes — déjà collectées lors des inscriptions), nombre de participants, durée du séjour.

**Output attendu :** planning de menus par repas sur toute la durée, avec liste de courses agrégée, exportable PDF.

**Questions ouvertes avant de spécifier :**
- Qui voit ce menu ? Hébergeur uniquement (c'est lui qui cuisine) ou partagé avec l'organisateur ?
- Le menu est-il modifiable manuellement après génération IA ?
- Format de l'export : PDF imprimable pour le cuisinier, ou intégré dans le planning collaboratif ?
- Intégration dans l'espace collaboratif existant ou section dédiée dans le dashboard hébergeur ?

**Stack probable :** appel API Claude (claude-sonnet-4) en backend NestJS, prompt structuré avec les contraintes alimentaires, réponse JSON parsée → affichage frontend. Pas de streaming nécessaire (génération one-shot).

**Estimé :** 3-5 jours. **Dépend de la validation commerciale LMDJ/IDDJ** — ne pas coder avant.

---

### 2. Pop-up aide IA contextuelle (Phase B.1)

**Concept :** widget flottant accessible sur toutes les pages et pour tous les rôles utilisateurs. L'utilisateur pose une question en langage naturel, reçoit une réponse immédiate limitée au périmètre LIAVO + séjours scolaires/jeunesse.

**Scope de la réponse IA :** utilisation de l'outil (comment faire X dans LIAVO), questions réglementaires séjours (TAM, DSDEN, Chorus Pro), aide à la rédaction (emails, conventions). Hors scope : questions générales non liées aux séjours.

**Questions ouvertes avant de spécifier :**
- Le widget a-t-il accès au contexte de l'utilisateur (quel séjour est ouvert, quel rôle) pour des réponses personnalisées ?
- Historique de conversation dans la session ou one-shot par question ?
- Apparence : bouton fixe en bas à droite (style Intercom) ou intégré dans la nav ?
- Qui voit le widget ? Tous les rôles, ou uniquement hébergeur + organisateur ?

**Stack probable :** composant React client avec état local, appel backend NestJS → API Claude avec system prompt LIAVO-spécifique, streaming de la réponse. Pas de persistance BDD nécessaire pour la V1.

**Point de vigilance :** le system prompt doit être étanche — l'IA ne doit pas répondre à des questions hors périmètre. Tester des prompts adversariaux avant mise en prod.

**Estimé :** 3-5 jours. **Dépend de la validation commerciale** — ne pas coder avant.

---

### 3. Phase de commercialisation — structure de lancement (Phase A, priorité haute)

**Contexte :** LIAVO est fonctionnel en prod. La démo LMDJ a montré de l'intérêt. Il faut structurer le lancement commercial avant de multiplier les démos.

**Ce qui manque aujourd'hui :**
- Pas de processus d'onboarding guidé pour un hébergeur qui s'inscrit seul
- Pas de suivi des leads (qui a été démo'd, quel statut)
- Pas de page "À propos / Qui sommes-nous" sur liavo.fr
- Pas de contenu SEO (blog, guides séjours scolaires)
- Pas de présence LinkedIn active pour LIAVO SASU
- Pas de kit de présentation (deck PDF) pour les réseaux et fédérations

**Actions immédiates à spécifier et prioriser :**

a) **Onboarding hébergeur guidé** : séjour démo pré-créé au premier login, checklist de complétion profil (5 étapes), email de bienvenue séquencé J+1/J+3/J+7. Estimé : 2-3 jours tech + copywriting.

b) **CRM commercial Théo** : tracker simple (Notion ou Airtable) des prospects contactés, démos planifiées, statuts. Pas dans LIAVO — outil externe. Créer le tableau aujourd'hui.

c) **Deck réseaux** : présentation 10 slides adaptée au pitch LMDJ post-démo (positionnement post-mise-en-relation, pas de remplacement centrale). À faire avant la visio LMDJ de suivi.

d) **LinkedIn LIAVO SASU** : créer la page entreprise, publier le premier post (lancement, qui on est, pourquoi). Calendrier éditorial 12 semaines à reprendre depuis le projet LinkedIn Théo.

e) **Page /a-propos sur liavo.fr** : qui est LIAVO, qui est Théo, pourquoi ce produit, références (Sauvageon). Simple, honnête, pas de bullshit marketing.

**Estimé global :** 1 semaine de travail intense (tech + contenu). **À faire avant la prochaine visio LMDJ.**

---

### 4. Flow colonie complet — HORS_SCOLAIRE/DECLARE_TAM (déjà dans roadmap, à préciser)

**Contexte :** `typeContexte=HORS_SCOLAIRE` est en BDD et dans le schéma Prisma depuis SC4ter. Le flow frontend n'est pas encore branché.

**Ce qui manque :**
- Création séjour : choix "scolaire / colonie" dès le formulaire de création, qui alimente `typeContexte`
- Dashboard organisateur : conditionnel sur `typeContexte` (masquer rectorat, afficher TAM)
- Statut `DECLARE_TAM` : ajouter dans le cycle de vie, bouton "Télécharger le dossier de déclaration"
- Génération du dossier TAM : formulaire Cerfa 13605*03 pré-rempli depuis les données du séjour (à valider : peut-on pré-remplir un Cerfa ou faut-il un export données brutes ?)

**Fonctionnalités spécifiques colos vs scolaire à vérifier vs marché :**
- Gestion des animateurs BAFA/BAFD (qualification + ratio encadrement) — absent de LIAVO
- Déclaration sanitaire (liste médicaments, infirmier) — partiellement couvert par fiches sanitaires
- Assurance RC / assurance annulation — absent, à couvrir a minima par un lien vers prestataires
- Inscription directe familles sans passer par un organisateur — absent (Phase C)
- Ratio encadrement automatique — absent

**À faire avant de coder :** benchmark 2-3 concurrents (Odoo Nonprofit, Anim'action, logiciel colo du marché) pour identifier les fonctionnalités manquantes différenciantes.

---

### 5. Intégration APIDAE — données publiques vs partenariat réseau

**Question posée :** peut-on intégrer des centres via APIDAE sans être partenaire réseau (LMDJ, IDDJ) ? Les données APIDAE sont-elles publiques ?

**Réponse factuelle (à vérifier avant de coder) :**

APIDAE (ex-Sitra) est un système d'information touristique collaboratif géré par une SAS coopérative basée à Lyon. Les données sont organisées par projets et sélections. L'accès aux données d'un projet nécessite une clé API propre à ce projet.

**Ce qu'on sait avec certitude :**
- Les credentials IDDJ (apiKey=mr8RQgOh, projetId=3217, selectionId=67523) donnent accès aux 54 centres IDDJ — déjà intégré en prod.
- Les credentials LMDJ ne sont pas encore reçus d'Anaïtis.
- Il existe une API APIDAE publique limitée (`api.apidae-tourisme.com`) avec des projets ouverts, mais les données accessibles sans authentification sont restreintes (pas les catalogues de réseaux privés comme LMDJ/IDDJ).

**Interprétation (incertain) :** pour accéder aux centres d'un réseau spécifique (LMDJ 109 centres, IDDJ 70 centres), il faut les credentials de ce réseau. On ne peut pas contourner ça — les données sont dans des projets privés. Par contre, il existe des datasets APIDAE publics (hébergements touristiques génériques) accessibles sans credential — mais ce ne sont pas les centres jeunesse labellisés.

**Action à mener avant de coder :** contacter APIDAE directement (support@apidae-tourisme.com) pour demander si un accès générique aux établissements d'hébergement collectif pour mineurs existe sans partenariat réseau. **Ne pas supposer que c'est possible.**

---

### 6. Récupération emails centres catalogue EN — notification push géographique

**Concept :** utiliser le catalogue EN (data.education.gouv.fr) pour récupérer les emails des hébergeurs labellisés et leur envoyer une notification quand une demande de séjour correspond à leur zone géographique.

**Problème identifié (factuel) :** l'API EN n'expose pas les emails directement — uniquement nom, adresse, département, site web. Les emails ne sont pas dans le dataset.

**Options pour récupérer les emails :**

a) **Scraping des sites web** : visiter chaque site web référencé dans le dataset, extraire l'email de contact. Fragile (formats hétérogènes, CAPTCHAs, sites morts), mais scalable si bien fait. Estimé : 1 semaine dev + maintenance.

b) **Enrichissement manuel** : pour les 200-300 centres les plus pertinents (Alpes, Pyrénées, Bretagne), recherche manuelle. Fastidieux mais fiable. Estimé : 2-3 jours de travail.

c) **Prestataire data B2B** : Kaspr, Dropcontact, Clearbit — enrichissement automatisé à partir du nom + site web. Coût : 50-200€ pour quelques centaines de contacts. Probablement le meilleur rapport qualité/temps.

d) **Inscription volontaire via la landing** : CTA "Vous êtes un centre labellisé EN ? Inscrivez-vous pour recevoir les demandes dans votre zone". Pas de scraping, opt-in légal, mais croissance lente.

**Cadre légal (important avant toute action) :** l'envoi d'emails prospectifs B2B en France est soumis à l'opt-out (LCEN) — pas d'opt-in requis pour les professionnels, mais mention de désinscription obligatoire et intérêt légitime à démontrer. **À valider avec juriste avant envoi de masse.**

**Mécanique technique (déjà spécifiée en SC6bis dans ARCHITECTURE_ORGANISATIONS.md) :** rate limit 7j via `dernierEmailDemandeAt` sur CentreHebergement, filtre géographique par département, email fire-and-forget depuis `demande.service.ts`.

**Recommandation :** option d + option c en parallèle. Ne rien coder avant d'avoir :
1. Estimé le volume de centres EN (télécharger le CSV et compter)
2. Validé le cadre légal opt-out
3. Validé commercialement que cette feature a de la valeur (post-LMDJ)

---

## Règles de développement (rappel permanent)

1. **Fix at source, never patch** — règle absolue
2. **Lire les fichiers avant toute proposition** — via filesystem MCP, jamais depuis hypothèses
3. **Anticiper les bugs cascade** avant d'écrire le moindre code
4. **Ne jamais push sans confirmation explicite** de Théo
5. **Pattern** : lire → proposer → valider → CC exécute → vérifier build → Théo confirme → push
6. **PostgreSQL Scalingo** : noms de tables snake_case, modèles Prisma PascalCase entre guillemets dans SQL
7. **`str_replace` non fiable sur chemins Windows** → utiliser `write_file`
8. **`search_files` filesystem** = matching sur noms de fichiers uniquement (jamais sur le contenu)
9. **Migrations Prisma** : vérifier que CC a bien créé le fichier migration dans `backend/prisma/migrations/` — sinon `ALTER TYPE` manuel sur Scalingo + créer le fichier à la main
10. **Scalingo CLI** : `C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe`
11. **Railway + Cloudflare R2 à résilier** — deadline ~06/05/2026, ne pas oublier
