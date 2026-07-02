# LIAVO — État session dev
> Dernière mise à jour : 02/07/2026 — Facturation admin LIAVO + fix contrat événement.

---

## SESSION 02/07/2026 — Facturation admin LIAVO + contrat événement phase 2

### Premier client payant — Les Choucas (Nora Da Cruz)

Nora demande un devis LIAVO pour le plan Pilotage annuel (690€ HT). Entité de facturation : Ville de Neuilly-Plaisance (SIRET 219 300 498 00017, 6 rue du Général de Gaulle, 93360 Neuilly-Plaisance). Collectivité → paiement par mandat administratif via Trésor Public, pas Mollie. Flux : devis LIAVO → BDC mairie → facture LIAVO via Chorus Pro.

**Devis DL-2026-001 envoyé à Nora le 02/07/2026.**

### Facturation admin LIAVO — LIVRÉE

**Problème** : l'endpoint `POST /admin/facturer-centre` existait mais : (1) pas de devis LIAVO (seulement facture), (2) destinataire hardcodé sur le centre (pas sur l'entité de facturation), (3) SIRET émetteur incomplet (SIREN seul), (4) pas d'IBAN émetteur sur le PDF, (5) pas de bouton dans l'admin UI.

**Livré** (3 commits : backend PDF + backend admin + frontend admin) :

- **FacturePDF.tsx** : `typeFacture: 'DEVIS'` ajouté au union type. Titre "DEVIS", mentions validité 30j, versements/conditions masqués pour devis.
- **sequence.service.ts** : `'DEVIS_LIAVO'` ajouté au union type `typeDoc`.
- **facture-liavo.service.ts** : constantes `LIAVO_SIRET` / `LIAVO_IBAN` (env vars Scalingo), param `destinataire` optionnel sur `emettre()` (Mollie non impacté — 6e param optionnel), nouvelle méthode `genererDevisLiavo()` (numéro `DL-YYYY-NNN`, PDF folder `devis-liavo`).
- **admin.controller.ts** : `POST /admin/devis-liavo` + `facturer-centre` étendu avec champs destinataire.
- **admin.service.ts** : `genererDevisLiavo()` + `facturerCentre()` accepte objet body avec destinataire.
- **Frontend admin** : formulaire dans onglet "Factures LIAVO" — sélection centre, plan, fréquence, champs destinataire (pré-remplis depuis le centre, modifiables), boutons "Générer le devis" / "Émettre la facture". PDF via `SecureFileLink` (folder OVH privé).
- **Variables Scalingo** : `LIAVO_SIRET=102 994 910 00010`, `LIAVO_IBAN=FR76 1810 6000 2796 7985 1267 389`.

### Contrat événement — phase 2 — LIVRÉ

**Bug signalé** : client événement Sauvageon (Jean-Baptiste Perrin, DEV-2026-0037) ne peut pas ouvrir le lien contrat dans l'email (URL OVH privée → 403).

**Livré** (4 commits backend + frontend) :

- **devis.service.ts** : extraction `buildContratEvenementPdf()`, `getContratPdfByToken()`. Lien contrat supprimé du HTML email.
- **devis.controller.ts** : `GET /devis/:id/contrat/preview`.
- **devis-public.controller.ts** : `GET /devis/public/:token/contrat` (endpoint public, token = auth implicite).
- **contrat-sauvageon.pdf.tsx** : fix formatage montants (fmtMontant custom au lieu de toLocaleString), 22h→21h, BIC AGRIFRPP881 + banque Crédit Agricole des Savoie + titulaire SAS LE SAUVAGEON.
- **TabDevisFacturation.tsx** : bouton "Prévisualiser le contrat" (événements), `<a href>` contratUrl remplacés par `SecureFileLink`.
- **Page signature** : `contratUrl` via endpoint public `/api/devis/public/${token}/contrat`, state `contratOuvert`, checkbox disabled.

### Fix bouton "Annuler ce devis" — LIVRÉ

Bouton masqué quand facture active sans avoir. Condition ajoutée : `(!factureAcompte || avoirSurAcompte) && (!factureSolde || avoirSurSolde)`.

### Leçons retenues
1. **Folders OVH privés** : ne jamais mettre de lien direct dans un email. Utiliser SecureFileLink (authé) ou endpoint public par token.
2. **toLocaleString + react-pdf** : les narrow no-break spaces (U+202F) se rendent comme "/". Utiliser un formatter custom.
3. **Extraction avant expansion** : extraire une méthode pure (buildX) avant d'ajouter des features (preview).

---

## SESSION 01/07/2026 (nuit) — Contrat événement DIRECT

### Problème
Le contrat événement PDF (contrat-sauvageon.pdf.tsx) était généré dans `envoyerDevisDirect()` mais `contratUrl` n'était jamais persisté sur le devis. Le client ne voyait le contrat que dans l'email initial — pas sur la page de signature. Côté hébergeur, aucun moyen de le retrouver. De plus, le contrat Sauvageon hardcodé était généré pour TOUS les centres (bug : un client des Choucas recevrait un contrat au nom du Sauvageon).

### Livré (3 commits : SQL + backend + frontend)

**SQL** : `ALTER TABLE devis ADD COLUMN contrat_url VARCHAR(500);` — appliqué manuellement via pgsql-console avant le déploiement backend. Fichier `docs/migrations/2026-07-01-contrat-url.sql` créé pour traçabilité.

**Backend** (schema.prisma + devis.service.ts) :
- `contratUrl` ajouté au model Devis (après `conventionUrl`)
- Guard Sauvageon : `const isSauvageon = centre.email === 'resa@lesauvageon.com'` — seul le Sauvageon génère le contrat événement. Condition `if (isEvenement && isSauvageon && centre.iban)`.
- Persistance : `prisma.devis.update({ data: { contratUrl } })` après upload OVH, dans le try.
- Exposition publique : `contratUrl` ajouté au return de `getDevisPublicByToken()`.

**Frontend** :
- Types : `contratUrl` ajouté à `Devis` (devis.ts) et `DevisPublic` (collaboration.ts).
- Page signature `/devis/signer/[token]` : bloc "Contrat" avec lien PDF (conditionné `contratUrl`), checkbox mise à jour ("J'ai lu et j'accepte **le contrat**, les conditions du devis et les conditions d'annulation").
- Dashboard hébergeur `TabDevisFacturation.tsx` : bouton "Contrat événement (PDF)" ajouté dans les 2 zones de rendu (DIRECT + COLLAB), conditionné `contratUrl`, en sibling du bloc convention (pas à l'intérieur — le bloc convention est gardé par `natureSejour === 'SEJOUR'`, le contrat par `contratUrl`).

### Flux actuel contrat événement (post-fix)
1. Hébergeur envoie devis sur événement Sauvageon → contrat PDF généré, uploadé OVH, `contratUrl` persisté sur le devis, lien dans l'email client
2. Client ouvre page signature → voit le contrat en téléchargement + checkbox mentionne le contrat
3. Hébergeur ouvre le séjour → voit le bouton "Contrat événement (PDF)" dans l'onglet Devis & Facturation
4. Autres centres (Choucas, Alticlub, Pôle Montagne) : guard → pas de contrat généré, `contratUrl` reste null, aucun bouton affiché

### Leçons retenues
1. **Ordre de déploiement SQL → backend → frontend** : si le backend avec le nouveau schema Prisma déploie AVANT le SQL, Prisma fait un `SELECT contrat_url` → 500 sur toute page chargeant un devis. Le frontend peut déployer dans n'importe quel ordre (le `{contratUrl && ...}` protège).
2. **Guard par email du centre** (`resa@lesauvageon.com`) : temporaire. Si le Sauvageon change d'email, le guard casse. À remplacer par un flag ou un champ dédié quand on généralisera le contrat événement.
3. **Devis existants** : les événements déjà envoyés ont `contrat_url = NULL`. Le PDF existe sur OVH mais le lien est perdu. Ré-envoyer le devis régénère et persiste.

---

## SESSION 01/07/2026 (soir) — Refonte dashboard hébergeur + jauge occupation

### Refonte dashboard hébergeur (5 commits, 2 fichiers principaux)

**Problème** : le dashboard empilait 7 sections sans hiérarchie (KPIs financiers, tuiles actions prioritaires, rappels, séjours par période, configuration, profil centre, rentabilité). Trois bugs identifiés : KPI Impayés comptait les devis complémentaires + pointait vers le mauvais onglet, KPI "À facturer" utilisait dateDebut au lieu de dateFin, planning n'affichait que les séjours collaboratifs (DIRECT absents).

**Livré** : dashboard refondu en 3 zones.
1. **KPI CA confirmé** — carte Link → /pilotage (teaser pour plan PILOTAGE, paywall pour les autres). Sélecteur période DDA/DDM/T1-T4.
2. **3 cartes alertes** — Devis en attente, À facturer, Impayés. `title` HTML natif au hover. Lien intelligent Impayés : suivi-soldes si au moins un solde impayé, sinon suivi-acomptes.
3. **Planning compact 3 semaines** (S-1/S/S+1) — grille 7×3 identique visuellement à la vue mois du planning. Source `getMesSejoursPlanning` (DIRECT+COLLAB). Cellules cliquables → /planning?date=X&view=semaine. CTA "Voir le planning complet" en bouton bordé. Légende couleurs.

**Sections supprimées** : Actions prioritaires, Rappels du jour, Séjours par période, Configuration, Mon établissement, Rentabilité.

**Fixes bugs** :
- KPI Impayés : filtre `isComplementaire` ajouté (était absent contrairement aux KPIs 1-3)
- KPI À facturer : `resolveSejourDateFin` au lieu de `resolveSejourDateDebut` — aligné avec l'onglet a-facturer de la page devis
- Planning : source `getMesSejoursPlanning` (DIRECT+COLLAB) au lieu de `getMesSejoursConvention` (COLLAB only)
- Tooltips : remplacés par `title` HTML natif (l'ancien `absolute bottom-full` était clippé au viewport)
- Double chargement API : suppression de getMonProfil, getRappelsToday, getTableauRentabilite du dashboard (8→5 appels)

### Sidebar hébergeur (3 modifications)

1. **"Inviter"** ajouté dans le groupe Activité (icône `userPlus`). La page `/inviter-enseignant` n'était accessible que depuis la section Configuration du dashboard, qui est supprimée.
2. **"Disponibilités"** retiré du groupe Paramètres. Page orpheline en doublon avec le planning (clic indispo). La page reste sur le disque mais n'est plus navigable.
3. **Paramètres collapsible** : label cliquable avec chevron ▾/▸, fermé par défaut, auto-expand si l'utilisateur est sur une page Paramètres. Fix scroll `h-screen` au lieu de `min-h-screen` pour scroll indépendant de la sidebar.

### Jauge occupation planning vue mois

**Backend** : `nombreAccompagnateurs: true` ajouté au select de `getMesSejoursPlanning` (1 ligne).

**Frontend** : en vue mois, chaque cellule affiche `X/capacité` (ex: "50/120") quand au moins un séjour chevauche le jour. Rouge gras si surbooking (`occ > capaciteCentre`). Gris discret sinon. Masqué si aucun séjour ou capacité non renseignée.

**Cascade évitée** : `occupationForDay` opère sur `sejours` (non filtré), pas sur `sejoursForDay` (filtré par combobox). L'occupation est un indicateur de sécurité global, indépendant du filtre de recherche.

### Leçons retenues
1. **Marché PMS** : les dashboards hôteliers (Cloudbeds, Amenitiz, OPERA Cloud) convergent vers "aujourd'hui d'abord" + calendrier comme centre + KPIs drill-down. LIAVO n'est pas un PMS (unité = séjour, pas chambre) mais les principes s'appliquent. Venue360 est le concurrent le plus direct (hébergement de groupes, France+international).
2. **KPIs dashboard vs page devis** : les compteurs doivent utiliser exactement la même logique que les onglets de destination. Sinon perte de confiance ("5 impayés ici, 4 là-bas").
3. **`sejoursForDay` vs `sejours`** : toute fonction de calcul global (occupation, CA, alertes) doit opérer sur les données non filtrées. Les fonctions d'affichage (barres planning) peuvent utiliser les données filtrées.

---

## SESSION 01/07/2026 (après-midi) — Refonte hub /dashboard/hebergeur/devis + fix contact séjour direct

### Fix backend : contact séjour direct absent (commit `5ceb11e`)
Sur la page `/dashboard/hebergeur/devis`, les devis liés à un séjour direct (mariages Sauvageon, événements) affichaient "Contact non renseigné" alors que `sejours.client_nom` / `client_email` / `client_organisation` étaient bien remplis en base. Cause : `devis.service.ts::getMesDevis()` ne sélectionnait pas ces champs dans son `include.sejourDirect.select`. Le frontend (`DevisCard.tsx::resolveContact`) lisait bien `sd?.clientNom` mais recevait `undefined`.

**Fix (1 ligne)** : ajout de `clientNom, clientEmail, clientOrganisation` au select `sejourDirect` de `getMesDevis`. `getDevisForSejour` (lignes ~269) n'était pas touché, pas de cascade nécessaire.

### Refonte hub /dashboard/hebergeur/devis (commit `e793672`, 5 fichiers)
Ancienne page = 7 filtres statut non hiérarchisés, aucune notion d'urgence. Refonte en **hub d'alerte 5 onglets** :
- `En attente de réponse` — EN_ATTENTE / EN_ATTENTE_VALIDATION
- `À facturer` — sous-groupes "Soldes à créer" + "Acomptes à créer"
- `Suivi acomptes` — FA émises non validées
- `Suivi soldes` — FS émises non intégralement payées
- `Historique` — soldés + non retenus

**Bandeau alertes non-dismissible** en haut de page avec 5 chips (rouge/orange) selon seuil 30j : soldes à relancer, acomptes à relancer, acomptes à valider, devis à relancer, à facturer. Clic sur chip = navigation vers l'onglet cible. Compteur global "N actions en attente".

**Nouveau composant** `DevisCard.tsx` extrait : bordure/pastille colorées selon sévérité alerte, contact séjour direct (nom + email + tel cliquables), signature structurée (`nomSignataireDirecteur` + `dateSignatureDirecteur` prioritaires sur fallback string composite), badge dérivé des factures (Acompte facturé / Soldé) prime sur statut devis.

**Nouveau helper** `src/lib/devisAlertes.ts` : catégories `CategorieAlerte`, fonctions `estAlerte`/`computeAlertes`/`resolveSejourDateDebut`/`resolveSejourDateFin`. Fallbacks en cascade sur les dates jusqu'à `createdAt` (jamais null), `joursDepasses` no-crash sur NaN.

**Tri** : par défaut "alertes en tête puis ancienneté croissante". Tri custom Date/Montant/Client possible.

### Leçons retenues
1. **Frontend local sans `.env.local` = teste contre l'API prod.** `api.ts::baseURL = '/api'` + `next.config.ts` rewrites `/api/:path*` → `${NEXT_PUBLIC_API_URL || 'https://api.liavo.fr'}/:path*`. Sans `frontend/.env.local` définissant `NEXT_PUBLIC_API_URL=http://localhost:3001`, un `npm run dev` frontend tape vers la prod. Symptôme : "je viens de fixer un bug backend, je relance le frontend, le fix ne prend pas". À créer une fois pour toutes.
2. **Vérifier que les données sont en base AVANT de tester un fix backend d'affichage.** Si `sejours.client_nom` avait été NULL pour tous les imports Sauvageon, le fix `getMesDevis` aurait été techniquement correct mais visuellement invisible. Un `SELECT ... WHERE nature_sejour = 'EVENEMENT' AND client_nom IS NOT NULL LIMIT 5` en 30 secondes évite un tour en rond.
3. **Push atomique = un commit à la fois.** Cette session a poussé 3 commits en un seul push (fix backend + refonte 5 fichiers + docs). Ça a fonctionné cette fois. Ne pas prendre l'habitude : la prochaine fois, si un des 3 casse la prod, le revert n'est plus chirurgical.

---

## SESSION 01/07/2026 — Fix envoi facture par email (PDF via S3 authentifié)

### Bug
« Impossible de récupérer le PDF de la facture » quand l'hébergeur envoie une facture par email. `envoyerFactureParEmail` faisait un `fetch()` **non authentifié** sur l'URL OVH du PDF. Le folder `factures` n'est **pas** dans `PUBLIC_FOLDERS` (seuls `logos`/`centres` le sont) → OVH renvoie 403, traduit en `ForbiddenException('Impossible de récupérer le PDF de la facture')`.

### Fix à la source (2 fichiers, commit `f62cbcf`)
- **`storage/storage.service.ts`** : nouvelle méthode publique `fetchAsBuffer(url): Promise<Buffer>`. Réutilise `getKeyFromUrl` pour valider l'appartenance au bucket, puis `GetObjectCommand` S3 **authentifié** via `this.client` (credentials internes) → renvoie un `Buffer`. Réutilisable pour tout folder privé (devis, signatures, contrats, conventions, brochures, uploads).
- **`facture/facture.service.ts`** : dans `envoyerFactureParEmail`, remplace le `fetch()` par `this.storage.fetchAsBuffer(facture.pdfUrl)` (try/catch conservant le même `ForbiddenException`).

### Leçon retenue
Tout accès en lecture à un fichier d'un **folder privé** (hors `logos`/`centres`) doit passer par `StorageService.fetchAsBuffer()` — jamais un `fetch()` direct sur l'URL publique OVH (403). Idem `generateSignedUrl()` pour exposer un lien temporaire côté client.

---

## SESSION 01/07/2026 (matinée) — Convention configurable par centre (livrée)

### Contexte
`backend/src/devis/convention-scolaire-sauvageon.pdf.tsx` : 250 lignes JSX react-pdf avec prose juridique **hardcodée Sauvageon** — inutilisable pour Choucas / Pôle Montagne. Trois options architecturales analysées ; **Option C retenue** : couverture LIAVO dynamique (page 1) + PDF statique uploadé par le centre (pages 2+) fusionnés via `pdf-lib`.

### Livré (commit `fd2db59`, déployé en prod)
- **Migration Prisma** : champ `conventionPdfUrl String? @map("convention_pdf_url") @db.VarChar(500)` sur `CentreHebergement`. Auto-appliquée en prod par `prisma migrate deploy` du Procfile Scalingo au boot.
- **`backend/src/devis/convention-couverture.pdf.tsx`** : nouvelle page react-pdf **générique** (parties, dates, effectifs, tableau financier, signatures) sans texte spécifique centre.
- **`devis.service.ts`** : branching dans `buildConventionScolairePdf()` — si `centre.conventionPdfUrl` renseigné → couverture LIAVO + fetch PDF centre + merge via `pdf-lib`. Sinon → legacy Sauvageon inchangé.
- **`centre.controller.ts` + `centre.service.ts`** : endpoints `POST /centres/convention-pdf` + `POST /centres/convention-pdf/supprimer` (pattern brochure mirroré, avec suppression de l'ancien fichier avant nouveau upload — mieux que brochure).
- **Frontend** : type + fonctions API dans `frontend/src/lib/centre.ts`, section « Convention / Conditions générales » dans page profil hébergeur après brochure.
- **Folder S3** : `centres/{centreId}/conventions-centre` (dans `PUBLIC_FOLDERS` → fetch backend fonctionne sans auth pour la fusion `pdf-lib`).

### Flux utilisateur
Après signature devis (statuts SELECTIONNE/SIGNE_DIRECTION/FACTURE_ACOMPTE/FACTURE_SOLDE), dans l'onglet Devis & Facturation du séjour, deux boutons apparaissent :
- **Prévisualiser** → ouvre le PDF dans un nouvel onglet, sans effet de bord
- **Générer et envoyer la convention** → upload OVH + email au contact enseignant/organisateur + log CRM. Idempotent, chaque clic recrée le PDF avec l'état courant.

### Statut clients
- **Sauvageon** : reste sur legacy (pas de PDF uploadé, template hardcodé continue de marcher).
- **Choucas & Pôle Montagne** : messages WhatsApp envoyés à Nora et Yves pour uploader leur PDF conditions générales. Basculement auto sur nouveau flux dès qu'ils l'ont uploadé.

### Leçons retenues
1. **Procfile `prisma migrate deploy` au boot** applique automatiquement les migrations committées. La règle « SQL manuel uniquement » vaut pour `prisma migrate dev` (interdit), pas pour les migrations SQL committées. À noter pour éviter le stress inutile de « la colonne n'existe pas en prod » — elle existe déjà via le Procfile.
2. **Folder S3 public vs privé** = décision architecturale à conscientiser : si le backend doit `fetch()` le fichier (ex. merge pdf-lib), le folder doit être public OU utiliser `StorageService.fetchAsBuffer()`. Ici, `centres/` public choisi car conditions générales n'ont rien de confidentiel.

---

## SESSION 01/07/2026 (matinée) — Upgrades Pilotage + SearchableSelect

### Upgrades Pilotage (SQL prod)
Yves Massard (Pôle Montagne) confirmé au téléphone → upgrade PILOTAGE sur ses 2 centres actifs. Puis même upgrade sur Choucas à la demande de Théo.

```sql
UPDATE centres_hebergement SET plan_abonnement = 'PILOTAGE' 
WHERE nom IN ('Chalet Le Florimont', 'Chalet YAKA') AND abonnement_statut = 'ACTIF';

UPDATE centres_hebergement SET plan_abonnement = 'PILOTAGE' 
WHERE nom ILIKE '%choucas%' AND abonnement_statut = 'ACTIF';
```

**À noter pour les prochains scripts SQL** : nom de table `centres_hebergement` (avec S), colonne `abonnement_actif_jusqua` (pas `jusqu_au`). Le nom du Florimont a été importé plusieurs fois via APIDAE (DECOUVERTE/INACTIF, ne pas toucher).

### Composant `SearchableSelect<T>` (livré)
Remplace les `<select>` natifs devenus inutilisables avec 20+ items (page Rentabilité pour liaison factures↔séjours : titre tronqué après sélection, pas de dédoublonnage).

**Livré** : composant générique `frontend/src/components/SearchableSelect.tsx` (props : items, valueFn, labelFn, subLabelFn, value, onChange, placeholder, excludeValues, className, disabled). Filtrage insensible accents/casse via `normalize('NFD')`, keyboard nav ↓/↑/Enter/Escape, click-outside via ref+mousedown listener, `excludeValues` calculé sur les autres lignes de ventilation.

Intégré dans `rentabilite/page.tsx`. Réutilisable ailleurs (CRM, DevisBuilder). Les 3 composants API-based existants (CatalogueSuggestionInput, EtablissementSearch, OrganisationSearch) restent tels quels — périmètre différent (recherche API-driven, pas filtrage local).

---

## SESSION 30/06/2026 — Sécurité + Pilotage + UX sidebar + Traçabilité catalogue

### Résumé

Session complète en une journée : **LOT 6 sécurité code finalisé** (6g/6k/6a/6j/6b/6l), **checklist hors-code H1-H9 fermée**, **politique confidentialité corrigée** (Mollie + IBAN + redirect), **sidebar hébergeur restructurée** (Activité/Gestion/Pilotage/Paramètres + cadenas plan + tri séjours non-lus), **Module Pilotage complet** (PlanGuard strict, 4 endpoints backend, page CA & Remplissage avec recharts, Comptabilité export CSV, Rentabilité migrée, Équipe placeholder), **UI polish** (vrai logo, tooltip ?, Prévisionnel ambre), **produitCatalogueId** sur LigneDevis (traçabilité catalogue → ventilation CA par produit).

### Lots livrés

| Lot | Description |
|---|---|
| LOT 6g | AllExceptionsFilter — stack traces masquées en prod |
| LOT 6k | searchPublic + getPublic filtrent statut ACTIVE |
| LOT 6a | Logs sensibles → Logger NestJS, tokenAcces supprimé |
| LOT 6j | Ownership check getOrdreMissionHtml — IDOR fermé |
| LOT 6b | escapeHtml() 49 occurrences (19 méthodes email) |
| LOT 6l | DTO class-validator 38 champs POST /public/demande |
| H1-H9 | Bucket OVH, npm audit, Helmet, SSL DB, DNS email, DPA ×3, politique confidentialité, logs |
| H8 corrections | Mollie sous-traitant + correction claim IBAN + redirect /politique-confidentialite |
| Sidebar restructurée | 5 sections (Activité/Gestion/Pilotage/Paramètres), cadenas plan, highlight sous-routes |
| Séjours tri non-lus | Non-lus remontés en tête de la page séjours |
| Type PILOTAGE frontend | Ajouté dans Centre + CentreResume |
| PlanGuard strict | Mode strict bloque les GET (analytics/exports) |
| Pilotage backend A | Endpoints remplissage + CA (nuitées, ventilation type/source, N-1) |
| Pilotage backend B | Export CSV factures + versements (StreamableFile, BOM UTF-8) |
| Pilotage frontend | Layout tabs + CA & Remplissage (4 KPIs + recharts) + Comptabilité + Équipe placeholder + Rentabilité migrée |
| UI polish | Vrai logo sidebar, tooltip ?, Pipeline→Prévisionnel, couleur ambre #F59E0B |
| produitCatalogueId | FK nullable sur LigneDevis + DTO + 3 builders frontend + script backfill Sauvageon |
| CA par produit | Ventilation CA par produit catalogue dans endpoint + carte frontend |

---

## ÉTAT PROD AU 30/06/2026

### Sécurité — VERROUILLAGE COMPLET
LOT 6 code : 6g/6k/6a/6j/6b/6l/6m/6n/6i — tous livrés.
Checklist infra : H1-H9 — tous vérifiés et fermés.
Reste LOT 6 maintenance (au fil de l'eau, non bloquant) : 6c/6d/6e/6f/6h/6o.

### Module Pilotage — LIVRÉ
- CA & Remplissage : 4 KPIs (réalisé/prévisionnel/encaissé/reste dû), graphique mensuel recharts (réalisé bleu/prévisionnel ambre/encaissé vert), ventilation type/source/produit, comparaison N-1 (masquée si pas de données), tooltips explicatifs, taux remplissage mensuel avec seuils couleur
- Rentabilité : page existante migrée dans les onglets Pilotage
- Comptabilité : export CSV factures + versements (format Excel FR, BOM UTF-8, sélecteur période)
- Équipe : placeholder "Bientôt disponible"
- PlanGuard strict sur analytics (PILOTAGE), export sur COMPLET

### Sidebar — RESTRUCTURÉE
5 sections : vide (Tableau de bord) / Activité (Séjours, Planning, Demandes) / Gestion (Devis & Facturation, CRM clients 🔒) / Pilotage (Pilotage 🔒) / Paramètres. Cadenas affiché quand plan insuffisant, PlanInsufficientModal au clic sur feature bloquée.

### Traçabilité catalogue — LIVRÉE
produitCatalogueId FK nullable sur LigneDevis. Les 3 builders de devis (nouveau, modifier, TabDevisFacturation) sauvent l'ID du produit catalogue. Ventilation CA par produit dans Pilotage. Script backfill Sauvageon prêt (docs/scripts/).

### Clients
- **Sauvageon** : PILOTAGE gratuit permanent (2099-12-31)
- **Les Choucas** : trial Complet actif. **Deadline ~17/07 — premier paiement.**
- **Alticlub** : trial Complet actif jusqu'au 10/09/2026
- **Pôle Montagne** : trial Complet actif jusqu'au 01/12/2026

---

## PROCHAINS CHANTIERS (par priorité)

### 1. Démarchage commercial (immédiat)
- [ ] Facturer Les Choucas via POST /admin/facturer-centre
- [ ] Vidéo motion design landing page
- [ ] Pitch Alticlub conversion trial → payant
- [ ] Démarcher centres IDDJ (54 importés)

### 2. Cron alertes expiration
- [ ] NestJS @Cron ou Scalingo scheduler — filet de sécurité

### 3. Module Pilotage itérations
- [ ] Conversion funnel (demandes → devis → signés)
- [ ] Export PDF rapport mensuel
- [ ] Planning équipe (modèle de données à créer)

### 4. Dette technique
- [ ] Fusionner 3 DevisBuilder dupliqués (42KB + 37KB + 113KB)
- [ ] Découper sejour/[id]/page.tsx
- [ ] DMARC p=none → p=quarantine
- [ ] Chiffrement IBAN en base
- [ ] Créer `frontend/.env.local` avec `NEXT_PUBLIC_API_URL=http://localhost:3001` (une bonne fois pour toutes)

---

## STACK & COMMANDES
- **Backend** : NestJS 11, Prisma, PostgreSQL 17, Scalingo Paris
- **Frontend** : Next.js 16.1.6, React 19, TypeScript 5, Tailwind 4, recharts, Scalingo Paris
- **Stockage** : OVH Object Storage Gravelines
- **Emails** : Brevo FR | **PSP** : Mollie (SEPA, clé live)
- **Repo** : `C:\Users\Roche-Loison\Desktop\sejour-jeunesse`
- **CC** : `cd C:\Users\Roche-Loison\Desktop\sejour-jeunesse && claude`
- **SQL prod** : `scalingo --app liavo-backend --region osc-fr1 pgsql-console`
- **Déploiement** : auto sur push main
