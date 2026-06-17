# LIAVO — État du projet
> Dernière mise à jour : 16/06/2026 (découplage émission/envoi factures + routage versements)

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

### 16/06/2026 — Découplage émission/envoi factures + routage versements

**Découplage émission / envoi des factures (commits 564a85a + 6f9f648)**
- **Problème** : les 3 méthodes d'émission (`emettreAcompte`, `emettreFactureSolde`,
  `emettreFactureTotal`) envoyaient un email automatique au destinataire → l'hébergeur
  n'avait aucun contrôle. Émission = silencieuse désormais ; envoi = action manuelle.
- **Émission** : plus d'email auto en mode DIRECT. En COLLAB, notification enseignant
  conservée (conditionnée par `devis.demandeId`, texte « disponible — consultez votre
  espace LIAVO »). `void → await generateAndStorePdf` (×3) : le PDF est garanti prêt
  pour un envoi ultérieur.
- **Nouvel endpoint** `POST /factures/:id/envoyer { email, message }` (HEBERGEUR +
  permission facturation) : récupère le PDF Factur-X depuis OVH, l'envoie en pièce
  jointe avec `replyTo` = email du centre (le destinataire répond à l'hébergeur, pas
  à LIAVO). Log CRM `ENVOI_FACTURE`.
- **email.service** : `send()` accepte un `attachment?` optionnel (PJ Brevo base64) ;
  nouvelle méthode `sendFactureParEmail()`.
- **Frontend** : bouton « Envoyer par email » à côté de chaque facture émise (acompte,
  solde, avoir, complémentaires) + modale de saisie email/message (pré-remplie). Pas de
  fermeture au clic backdrop (cohérent avec les autres modales).

**Routage auto des versements + re-balance (commit 13156f0)**
- **Problème** : « Ajouter un versement » ciblait toujours `factureActive` (dernière
  facture émise) → les versements saisis avant l'émission du solde restaient sur
  l'acompte (overflow), PDFs incohérents.
- **Endpoint remplacé** : `POST /factures/:id/versements` → `POST /factures/versements
  { devisId }`. ⚠️ Backend + frontend à déployer ensemble.
- **Routage auto** : le versement va sur la première facture non soldée (acompte
  d'abord, puis solde), fallback dernière facture si trop-perçu.
- **Re-balance à l'émission du solde** : les versements en overflow sur l'acompte sont
  déplacés vers le solde, `montantVerseTotal`/`acompteVerse` recalculés sur les deux
  factures, PDFs des deux factures régénérés. `emettreFactureTotal` non concerné.
- **Frontend** : `handleAjouterVersement` passe `activeDevisId` ; hint « montant
  attendu » pointe sur la facture cible réelle (reste dû) ; bouton conditionné par
  `factures.length > 0`. `factureActive` ne sert plus qu'au fallback de suppression.

### 01/06/2026 — TAM Phase 1 + qualifications encadrants

**Qualification encadrant (AccompagnateurMission)**
- Migration : diplome VARCHAR(50) + qualification_autre VARCHAR(255) +
  index partiel WHERE diplome IS NOT NULL
- Backend : create() persiste les 2 champs, getByToken() projection enrichie
- Frontend : select dans formulaire invitation (BAFA/BAFD/BPJEPS/DEJEPS/
  DESJEPS/CPJEPS/PSC1/AUTRE) + champ libre conditionnel si AUTRE

**PDF Préparation TAM (Phase 1)**
- getDossierPedagogique() : select accompagnateurs enrichi diplome +
  qualificationAutre
- DossierPedagogiqueData : 6 champs ACM + diplome/qualificationAutre
  accompagnateurs
- PreparationTamPDFButton.tsx : PDF 5 sections, même design system que
  ProjetPedagogiquePDFButton, bouton conditionnel HORS_SCOLAIRE uniquement
- Vision Phase 2 : intégration automatique TAM via convention DJEPVA
  (6-12 mois, conditionné au volume hébergeurs)

### 01/06/2026 — SC4ter + Lot 4A Factur-X
- SC4ter : organisationId transmis dans InvitationDirecteur (creer() +
  envoyerADirection()). Le signataire qui s'inscrit est désormais rattaché
  au bon Membership → getAllSejoursSignataire() source 1 fonctionnelle.
- Lot 4A : Factur-X EN 16931 livré (voir bloc dédié ci-dessous).

### 01/06/2026 — Lot 4A conformité facturation (Factur-X EN 16931)
- **Factur-X EN 16931** : les PDFs factures sont désormais des PDF/A-3b
  avec XML CII D22B embarqué (profil EN 16931). Validé invoiceverify.eu.
- **pdf-lib** ajouté aux dépendances backend. Zéro migration DDL,
  zéro nouvelle route API, zéro champ en base.
- **buildCiiXml()** : génération CII D22B depuis snapshot Facture LIAVO.
  TypeCode 380 (solde) / 386 (acompte) / 381 (avoir).
- **embedFacturX()** : embedding XML dans buffer react-pdf →
  PDF/A-3b avec XMP pdfaid:part=3/conformance=B, EmbeddedFiles,
  AF/AFRelationship=Alternative. useObjectStreams:false.
- **Adresse structurée** : sérialisation adresse||CP||ville dans
  emetteurAdresse/destinataireAdresse. parseAdresse() côté CII,
  formatAdressePdf() côté mapper PDF.
- **Limites connues** (non bloquantes) : OutputIntent/ICC sRGB absent,
  fonts Helvetica non embarquées (veraPDF partiel). adresseEntreprise
  libre sans CP/ville = PostCode/City vides dans CII.
- **TODO Lot 4B** : dépôt Chorus Pro via PISTE (habilitation AIFE requise).
  getChorusXml() reste en UBL en attente.
- Commits : b79f5da (embedding) · 7a6fc86 (adresse CII)

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

### 01/06/2026 — Lot 3 conformité facturation (avoir)
- **Annulation par avoir** : 4 cas couverts (A : NON_RETENU sans FA ;
  B : avoir obligatoire si FA émise non versée ; C : avoir après acompte versé ;
  D : avoir partiel → FS à 0 € débloquée).
- **Séquence AVOIR** : numérotation indépendante AV-{annee}-{NNNN} via SequenceService.
- **Entité Facture** : 2 nouveaux champs (facture_annulee_id @unique, motif_avoir).
  Relation 1-1 auto-référencée FactureAvoir. Index unique partiel en base.
- **Backend** : emettreAvoir() dans FactureService, annulerDevis() dans DevisService,
  routes POST /factures/avoir + POST /devis/:id/annuler (HEBERGEUR).
  emettreFactureSolde() débloqué après avoir (acompteNet = acompte + avoir.montantFacture).
  getChorusXml() : guard AVOIR + TODO Lot 4 (code UBL 381).
- **PDF avoir** : template dédié (montants négatifs, "Net à déduire", sans IBAN,
  mention légale adaptée, "Annule et remplace [numero] du [date]").
- **Frontend** : modale avoir avec lignes pré-remplies éditables (A+),
  boutons contextuels dans TabDevisFacturation, affichage pipeline rouge.
  Types Facture étendus (AVOIR), helpers getFactureAvoir(), emettreAvoir(),
  annulerDevis() dans devis.ts. clients.ts mis à jour.
- Commits : 98fea6a (SP1 DDL) · 6242209 (SP2 service+PDF) · 9bda24c (SP3 frontend)

### 31/05/2026 — Lot 2 conformité facturation (PDF serveur + OVH)

- **FacturePDF.tsx** côté backend (NestJS/react-pdf) : template complet (mentions légales art. L441-10, pénalités 3× taux légal, escompte néant, dateEcheance +30j, IBAN/SIRET/TVA conditionnels).
- **generateAndStorePdf()** : fire-and-forget non bloquant après chaque émission. `StorageService.uploadBuffer()` → OVH → `Facture.pdfUrl`.
- **Routes** : `GET /factures/:id/pdf` (redirect 302 OVH) + `POST /factures/:id/regenerer-pdf`.
- **Frontend** : lien direct OVH dans `TabDevisFacturation`. `getFacturePdfUrl()` + `regenererFacturePdf()` disponibles pour Lot 4.
- **Fix édition infos client inline** : `PATCH /collaboration/:id/infos` étendu (clientNom/Prenom/Email/Telephone), sync CRM non bloquante via SejourClient. `SejourHeader` formulaire étendu (mode DIRECT uniquement).
- **Validé en prod** : FA-2026-0001 généré, PDF accessible OVH, mentions conformes.

### 31/05/2026 — Fixes produit

- **Mode paiement versements** : enum `MethodePaiement` standardisé MAJUSCULES + `CHEQUES_VACANCES`. Champ `modePaiement` nullable sur `VersementPaiement`. Migration DDL (rename/recreate enum + ADD COLUMN). `ajouterVersement()` accepte `modePaiement?`. Section "Règlements reçus" dans PDF facture (rendue si versements présents au moment de la régénération). Select mode de règlement dans `TabDevisFacturation` (grille 2×2). (bc430be)
- **Fix planning DIRECT** : `getActivitesCatalogue()` et `genererPlanningIA()` cherchaient les lignes de devis via `DemandeDevis` uniquement — silencieusement vides pour les séjours DIRECT. Fix : requête `OR [demande.sejourId, sejourDirectId]` + couvre `SELECTIONNE` et `SIGNE_DIRECTION`.
- **Fix route notifier-planning** : route `POST /collaboration/:sejourId/notifier-planning` existait déjà dans le controller (section Planning IA) — non dupliquée, fonctionnelle.

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
- **Lot 2** ✅ TERMINÉ 31/05/2026 — Génération PDF facture côté serveur (NestJS/react-pdf), stockage OVH, URL permanente `Facture.pdfUrl`. Fire-and-forget non bloquant. Routes `GET /factures/:id/pdf` + `POST /factures/:id/regenerer-pdf`. Validé en prod (FA-2026-0001). Point ouvert : SIRET Sauvageon = 9 chiffres (SIREN) → vérifier champ `siret` centre.
- **Lot 3** ✅ TERMINÉ 01/06/2026 — Annulation par avoir (jamais de suppression).
  - Cas A/B/C/D couverts. Séquence AV- indépendante. PDF avoir conforme.
  - Frontend : modale lignes éditables (Option A+). Boutons contextuels pipeline.
  - TODO Lot 4 tracé dans getChorusXml() : InvoiceTypeCode 381 pour avoirs.
- **Lot 4A** ✅ TERMINÉ 01/06/2026 — Factur-X EN 16931 (PDF/A-3 + CII XML embarqué).
- **Lot 4B** — Dépôt Chorus Pro via PISTE (habilitation AIFE requise).

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
- `StatutSejour` : DRAFT | OPTION | SUBMITTED | CONVENTION | SIGNE_DIRECTION | SOUMIS_RECTORAT | DECLARE_TAM (APPROVED/REJECTED supprimés 01/06/2026)
- Organisation + Membership : tous les users hébergeurs/organisateurs rattachés
- Colonnes `etablissement*` supprimées de `utilisateurs` (SC8)
- `InvitationHebergement` enrichie (10 nouveaux champs SC5bis)
- Routes admin : invitations, claims, hébergeurs, utilisateurs, centres

### Ce qui manque encore ❌

**Avant visio LMDJ (dans l'ordre) :**
1. SC9 : `StatutDevis` étendu + backfill (badges cohérents sur devis)
2. Migration `Client` → `RelationCommerciale` (CRM legacy)
3. `typeContexte HORS_SCOLAIRE` dans `soumettreDemandePublique()`
4. `DECLARE_TAM` dans `StatutSejour` (flow colo)

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

### Conformité facturation (Lots 0-4)
- Lot 0 : compteur séquentiel + fix montantAcompte ✅ TERMINÉ 30/05/2026
- Lot 1 : entité Facture immuable ✅ TERMINÉ 30/05/2026
- Lot 2 : PDF facture serveur + OVH ✅ TERMINÉ 31/05/2026
- Lot 3 : annulation par avoir ✅ TERMINÉ 01/06/2026
- Lot 4A : Factur-X EN16931 (PDF/A-3 + CII XML embarqué) ✅ TERMINÉ 01/06/2026
- Lot 4B : dépôt Chorus Pro via PISTE — habilitation AIFE requise (~1-2j)

### UX restant
- Invitations parents : 2 parents/tuteurs par enfant (modèle actuel = 1)
- [x] Flux direction ✅ — page publique /invitation-direction/[token] complète, 3 chemins signature (directe/direction/upload), SC4ter Membership signataire (01/06/2026)
- [x] PDF préparation TAM ✅ — bouton conditionnel HORS_SCOLAIRE dans onglet Projet pédagogique, 5 sections (organisateur, accueil ACM, encadrants + qualifications, projet éducatif, checklist délais FI J-60 / FC J-8) (01/06/2026)
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

### Intégration TAM — Déclaration accueils de mineurs

**Phase 1 ✅ TERMINÉ 01/06/2026 — PDF de préparation TAM**
Génération d'un PDF récapitulatif depuis les données LIAVO (séjour, encadrants,
hébergement, projet éducatif, tranches d'âge) que l'organisateur utilise comme
support pour remplir manuellement la téléprocédure TAM.
Prérequis livré : champ `diplome` + `qualificationAutre` sur AccompagnateurMission.

**Phase 2 (6-12 mois) — Intégration automatique TAM**
Convention avec la DJEPVA (Direction de la Jeunesse et de la Vie Associative)
pour transmission automatique des déclarations ACM depuis LIAVO vers TAM.
Condition : volume d'hébergeurs actifs suffisant pour justifier la démarche
administrative côté ministère. Pas d'API publique TAM → convention obligatoire.
Différenciateur fort sur le marché ACM une fois obtenu.

### Multi-centre (après conformité)
Onboarding /centre/[id]/claim + facturation multi-centre. Levier commercial fort (Yves Massard 3 centres, Quentin Dervaux/UFCV national).

### Dette technique
- [x] StatutSejour nettoyé ✅ — APPROVED et REJECTED supprimés (enum DDL + 13 fichiers, 0 ligne affectée en prod, 01/06/2026)
- DashboardShell : migrer toutes les pages (teacher, director, sejour) — estimé 4-6j, risque régression
- DevisLibre : DROP tables (devis_libres, lignes_devis_libre, versements_devis_libre) + retirer model Prisma — migration données faite le 28/05, tables vides en prod, code ne les utilise plus. DDL + schema à nettoyer (~0.5j, risque nul)
- DTO cleanup : retirer `numeroDevis` du front (envoyé mais ignoré)
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
