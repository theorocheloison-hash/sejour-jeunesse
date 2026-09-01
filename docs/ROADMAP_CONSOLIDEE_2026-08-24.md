# LIAVO — Roadmap consolidée (audit code, 2026-08-24)

> **Nature du document** : liste unique, dédoublonnée, des items « à faire / en cours / dette / décision en attente » extraits **uniquement** des 5 docs d'inventaire ci-dessous, chaque verdict d'état **prouvé sur le code réel** du monorepo (`fichier:ligne` ou recherche vide). Audit **lecture seule** — aucune modification de code, aucune commande git.
>
> **⟳ 2e passe (2026-08-24)** : fiabilisation — 31 verdicts INDÉTERMINÉ tranchés sur code, 3 verdicts « FAIT » re-testés en complétude bout-en-bout, 5 items argent/sécu re-localisés. Détail en fin de doc (« Journal 2e passe »). Verdicts et preuves ci-dessous déjà à jour.
>
> **Sources d'inventaire (QUOI vérifier)** : `docs/ROADMAP_ETE_2026.md` (RE), `docs/ROADMAP_POST_DEMO.md` (RPD), `LIAVO_SESSION_STATE.md` (SS), `docs/TIER1_CHANTIERS.md` (T1), `docs/DETTE_TECHNIQUE.md` (DT).
> **Vérité d'état (fait/pas fait)** : le code lu directement (`backend/`, `frontend/`, `backend/prisma/schema.prisma`).
>
> **Règle appliquée** : aucun « FAIT/PAS FAIT » sans preuve `fichier:ligne` ou recherche vide décrite. À défaut de preuve → **INDÉTERMINÉ**, jamais un pari. Les docs n'ont **jamais** servi de preuve d'état, seulement à établir la liste. Les items **ARGENT / SÉCURITÉ / CONFORMITÉ FACTURATION** sont **localisés** mais leur justesse **non jugée** (verdict « À AUDITER »). Distinguo appliqué en 2e passe : *existence d'un symbole ≠ complétude* — les « FAIT » sensibles sont vérifiés en chaîne de bout en bout.
>
> **Colonne Délégable** — AUTO-ÉCRITURE seulement si les 4 conditions sont vraies : (1) isolé, aucune décision produit ; (2) sûr/réversible, ne touche ni l'argent réel ni la sécurité ni une migration destructive/NOT NULL ; (3) vérifiable par un gate (tsc/build/test) ; (4) périmètre fermé (état final en 1 phrase). Décision produit → THÉO-OBLIGATOIRE. Mécanique mais large/ramifié → COWORK-PALIERS.

---

## Suivi post-audit — livraisons (vivant)

> **Couche VIVANTE de cette roadmap.** La table d'audit ci-dessous reste **figée** (photo du 24/08, preuve `fichier:ligne`) ; seules les corrections de verdicts FAUX y sont admises (ex. #16). Les items **livrés depuis l'audit** se loguent ICI, datés, sans muter la table. But : **une seule roadmap à maintenir**, pas dix.

**01/09/2026 (session sparring — lot invitation / signature / création de séjour en 3 étapes)** — détail complet : `LIAVO_SESSION_STATE.md` entrée 01/09 ; cadrage + suivi des 18 commits + scénario de recette : `docs/CADRAGE_INVITATION_SIGNATURE_2026-09-01.md`. Poussé (`286a9be`→`0823ae0`), déploiement Scalingo à vérifier, recette prod à faire.
- **#41 « rejoindre = signer » — TRANCHÉ ET LIVRÉ** (`05665e0`) : `accepter()` rattache seul (`createurId` + `COLLABORATIF`), plus de `CONVENTION` ni d'auto-`SELECTIONNE`, gardes 400/404/409 avant transaction, branche DRAFT supprimée. Les lecteurs organisateur (`getMesSejours`, `getDossierPedagogique`, `getBudgetData`) lisent désormais `STATUTS_DEVIS_VISIBLES_ORGANISATEUR` (`b991bd9`).
- **#40 signature depuis l'espace connecté — LIVRÉ** (`286a9be` + `c6582e8`→`5cee0ad`) : 3 endpoints JWT `POST /devis/:id/signature/{signer,envoyer-direction,upload}` (ownership R4 + `signataireUserId` tracé), `SignatureDevisPanel` partagé entre la page publique tokenisée et l'espace, panneau 3 états + bandeau global + carte dashboard `OPTION`. Deux niveaux de garantie (token vs JWT), une UI.
- **#2 formulaire d'invitation neutre — CADUC** : la page `/inviter-enseignant` est SUPPRIMÉE (`ba4caf4` + `49de22e`) ; l'unique chemin est l'invitation depuis un séjour existant. Verdict table à lire comme « sans objet ».
- **Bugs préexistants corrigés, hors table** : onglet Devis vide pour l'organisateur (fetch hébergeur-only, 403 avalé — `f31d336`) ; `getBudgetData` filtrait `RETENUS` (`b991bd9`) ; carte dashboard sans aucune action pour `OPTION` (`0f59503`).
- **Création de séjour hébergeur en 3 étapes — LIVRÉ** (`8a5f793` + `994dd5b` + `92c438a`) : Client → Séjour → Détails optionnels (7 champs, niveau/classe/âge texte libre, thématiques laissées à l'enseignant, « / participant »).
- **Items nés du lot (non dans la table)** : T3 = #36 signataire ; T4 `updateStatut` COLLAB sans signature + statut final `CONVENTION` vs `SIGNE_DIRECTION` ; T6 résidu `{error && …}` page publique ; T7 `findByToken` sans vérification d'éligibilité du séjour ; wording PDF « par la direction » faux pour une signature enseignant ; harmoniser « Option » (header) / « À confirmer » (dashboard) ; `DevisEditor` n'affiche pas les détails séjour (pense-bête) ; CTA « créer mon compte » après signature publique ; specs `accepter()` / signatures (0 test aujourd'hui). **Prochain chantier acté : #38 big picture dashboard organisateur** (matrice parcours × stade × écran).

**31/08/2026 (sessions sparring)** — détail complet : `LIAVO_SESSION_STATE.md` entrées 31/08 (2) et (3). Nés d'un incident (spam de rappels reçu par l'hébergeur), pas du backlog audité — aucune ligne de la table à muter.
- **Cron relance HÉBERGEUR (9h) → digest par centre** (`aeb9cbc` + `6bc2481`). 1 mail/centre au lieu d'1/devis, référentiel `dateEnvoi` (exclut les jamais-envoyés), exclusion complémentaires/supprimés, wording « vos clients », garde `ENABLE_CRON` ajoutée sur les **3** crons de `notifications.service.ts`.
- **Cron relance ORGANISATEUR (8h30) → borné + escalade** (`0e47cd7`, migration `20260831160000_escalade_relance_organisateur`). Relance CLIENT mensuelle J+30→6 mois (direct ET collab, reply-to = centre) puis STOP + escalade hébergeur (digest, 1×) à 6 mois. Corrige un angle mort : les clients de devis DIRECTS n'étaient jamais relancés pour signer.
- **Anti-rafale** : backfill `relance_envoyee_at`/tampons dans les migrations → zéro envoi au déploiement (vérifié : aucun devis >6 mois, plus ancien 04/06).
- **Recoupe #85** (routage réponses emails From/Reply-To) : le reply-to hébergeur est désormais implémenté sur la relance client ; #85 reste OUVERT pour le volet conception global (List-Unsubscribe, routage entrant).

**25/08/2026 (session sparring)** — détail complet : `LIAVO_SESSION_STATE.md` entrée 25/08 (2).
- **#66 CI GitHub Actions — LIVRÉ** (`c8c5a48`, 1er run vert). `.github/workflows/ci.yml` : build backend + frontend sur push `main` / PR, Node 24, `npm ci`. Détection post-push (pas de branch protection ; Scalingo déploie indépendamment).
- **#14 sous-ventilation — Option B « avertir sans bloquer » CODÉ + gaté, à pousser.** `frontend/app/dashboard/hebergeur/rentabilite/page.tsx` `handleSave()` : `confirm()` sur le reste non ventilé (calcul sur `ventilationsValides`, seuil 0,01 € aligné backend), AUCUN blocage. `validateMontantEtVentilations` inchangé.
- **#78 httpOnly — CONFIRMÉ FAIT COMPLET (front inclus).** Le front ne persiste jamais le token (`AuthContext` → profil seul ; `api.ts` same-origin sans `Authorization` ; `js-cookie` hors dépendances). ⇒ dette « LOT 4a Phase 2/3 httpOnly » à retirer du backlog.
- **#16 IBAN — endpoint public = FAUX POSITIF vérifié** (verdict de la table corrigé). `getPublic`/`searchPublic` : select explicite sans `iban`. Reste : chiffrement **at-rest** seul (durcissement défensif).
- **#82 — déjà FAIT** (faux négatif de l'audit) : `build-error*.txt` EST présent dans `frontend/.gitignore`. Verdict table « PAS FAIT » à lire comme « FAIT ».

---

## Tableau consolidé

| # | Item (1 phrase) | Sources (doc:ligne) | Verdict | Preuve (fichier:ligne / recherche vide) | Nature | Délégable | Effort | Dépendances |
|---|---|---|---|---|---|---|---|---|
| 1 | Universaliser les libellés scolaires de la page séjour (« Établissement scolaire », « Enseignant responsable », « Lien avec les programmes scolaires ») | T1:114-140 ; RE:584-586 ; RPD:51-56 | **PAS FAIT** | `frontend/app/dashboard/sejour/[id]/_components/TabProjetPedagogique.tsx:86,95,170` (libellés scolaires présents) | produit | COWORK-PALIERS | M | Décision labels conditionnels `isEvenement`/`natureSejour` (item 44 voisin) |
| 2 | Formulaire d'invitation hébergeur neutre (`/inviter-client`) + sélecteur « Type d'organisateur » | RPD:46-49 | **PAS FAIT** | `frontend/app/dashboard/hebergeur/_components/HebergeurSidebar.tsx:100` (`/inviter-enseignant`, pas de `/inviter-client`) | produit | THÉO-OBLIGATOIRE | M | — |
| 3 | Masquer le bouton « Soumettre au rectorat » + générer un PDF « dossier de déclaration » | RPD:41-44 | **PAS FAIT** | `frontend/app/dashboard/signataire/page.tsx:255` (bouton), `:388` (`soumettreAuRectorat(id)`) | produit | THÉO-OBLIGATOIRE | M | Décision produit (remplacer un flux réglementaire) |
| 4 | FROM des factures = nom du centre au lieu de « Liavo » (`fromName = replyTo.name`) | RE:136-139 | **FAIT (confirmé complet)** | Chaîne complète : `envoyerFactureParEmail` construit replyTo `{name: centreNom}` (`facture.service.ts:883,898`) → `sendFactureParEmail` pose `fromName=replyTo.name` → PDF `emetteurNom`=centre (`facture.service.ts:243`) | fix | — | S | — |
| 5 | Immuabilité facture : `refreshFacturePdf` régénère le PDF d'une facture déjà émise | RE:148,651(4.21) ; DT:73 | **À TRANCHER** (défaut actif confirmé) | `refreshFacturePdf` (`facture.service.ts:88`) appelé depuis `ajouterVersement` (`:1059`) → PDF régénéré à chaque versement | argent/conformité | THÉO-OBLIGATOIRE | M | Chantier conformité facturation (numérotation/verrou/avoir) |
| 6 | Nom de fichier propre au téléchargement PDF facture/devis (`ContentDisposition`) | RE:147 | **PAS FAIT** | recherche vide : `ContentDisposition`/`attachment; filename` dans `backend/src/storage`+`facture` → 0 | fix/produit | THÉO-OBLIGATOIRE | S | Choix parmi 3 options (upload S3 / blob front / proxy) |
| 7 | Angle mort facturation multi-centre : risque de double prélèvement Mollie | RE:209-217 | **À AUDITER** (garde présente, risque probablement mitigé) | `souscrire` annule la subscription existante avant d'en créer une (`abonnement.service.ts:267-269` « jamais 2 mandats »), customer=1/org (`:292`) → garde **org-level** ; justesse fine à auditer | argent/sécurité | THÉO-OBLIGATOIRE | M | Avant Pôle Montagne / Tereva (pricing multi-centre) |
| 8 | Email renouvellement annuel ignore le supplément multi-centre (+39€/centre) | RE:792(10.5) | **FAIT** | montant renouvellement via `calculerMontantAbonnementCents` (`abonnement.service.ts:454`) qui inclut le supplément ; constante extraite « pour le fix 10.5 » (`abonnement.constants.ts:3-4,34`) | argent | — | S | — |
| 9 | TVA sur marge — Lot 2 : frontend saisie (checkbox « revendu » + `categorieMarge`) | RE:258 | **PAS FAIT** | recherche vide : `revenduTiers`/`categorieMarge` dans `frontend/app` + `frontend/src` → 0 | argent | THÉO-OBLIGATOIRE | M | Gelé jusqu'à l'hiver 2026-2027 |
| 10 | TVA sur marge — Lot 3 : export XLSX format expert-comptable | RE:259 | **PAS FAIT** | recherche vide : `tva-marge`/`marge` dans `backend/src/pilotage` → 0 | argent | THÉO-OBLIGATOIRE | M | Lot 2 |
| 11 | TVA sur marge — Lot 4 : onglet restitution + écran d'anomalies | RE:260 | **PAS FAIT** | recherche vide : `mentionTVA`/`tva-marge` côté frontend → 0 | argent | THÉO-OBLIGATOIRE | L | Lots 2-3 |
| 12 | TVA sur marge — Lot 5 : mention légale du régime de la marge sur les PDF | RE:261 | **PAS FAIT** | recherche vide : `mentionTVA` dans `frontend/app`+`src` → 0 (prop non rendue) | argent/conformité | THÉO-OBLIGATOIRE | S | Avant 1ʳᵉ facture d'hiver |
| 13 | TVA sur marge — backfill SQL `revendu_tiers` sur lignes à `tva=0` | RE:264-269 | **INDÉTERMINÉ** (SQL prod, non code-vérifiable) | `UPDATE lignes_devis...` non exécuté par déf. ; état prod non lisible | argent | THÉO-OBLIGATOIRE | S | SELECT de contrôle obligatoire |
| 14 | Bug `validateMontantEtVentilations` : rejette la sur-ventilation, pas la sous-ventilation (charge orpheline) | RE:235 | **À AUDITER — bug confirmé présent** | `validateMontantEtVentilations` (`rentabilite.service.ts:44`) ne teste QUE la borne haute (`totalVentile > montant+0.01`), **aucune borne basse** → sous-ventilation silencieuse | argent | THÉO-OBLIGATOIRE | S | — |
| 15 | Migration Float→Decimal des montants devis/factures | RE:634(4.7),756,767 ; SS | **PAS FAIT** (décision « audit d'abord ») | `docs/AUDIT_FLOAT_DECIMAL.md` (étape 1 prête) ; migration non faite | argent | THÉO-OBLIGATOIRE | L | Audit prod pgsql-console (Théo) |
| 16 | Chiffrement de l'IBAN en base (endpoint public IBAN = décision « ne pas fixer ») | RE:645(4.14),755 ; SS:1189 | **PAS FAIT** (chiffrement at-rest seul ; endpoint public = faux positif vérifié 25/08) | `iban VarChar(34)` (centres_hebergement) + `emetteur_iban VarChar(34)` (factures) en clair, aucun chiffrement. **MAJ 25/08 (Claude, lecture code)** : `getPublic`/`searchPublic` (`centre.service.ts`) ont un select EXPLICITE **sans `iban`** → IBAN JAMAIS exposé sur endpoint public non-auth ; visible seulement sur PDF devis/facture via lien tokenisé (RIB, by design). Le volet « endpoint public IBAN » de l'item est **infondé**. Reste : durcissement at-rest (défensif, pas colmatage de fuite). | sécurité | THÉO-OBLIGATOIRE | M | — |
| 17 | Flow « Transmettre au gestionnaire » facture (token public, page `/facture/[token]`) | RPD:58-71 ; RE:682 | **PAS FAIT** | backlog RE:682 ; pré-requis `emailComptable` non posé | feature | THÉO-OBLIGATOIRE | M | Après 1er séjour COLLAB facturé |
| 18 | Chorus Pro : service NestJS + habilitation AIFE (`PISTE_CLIENT_*`) | RPD:154-158 ; RE:680 | **PAS FAIT** | recherche vide : `Chorus`/`PISTE_CLIENT` dans `backend/src` → 0 | argent/conformité | THÉO-OBLIGATOIRE | L | Inscription AIFE, TVA scolaire, eIDAS |
| 19 | Module Chambres — LOT 4 : vue « plan » lisible + PDF (remplace l'Excel) | RE:163 | **FAIT** | LOT4 PDF plan livré : `frontend/src/components/pdf/RoomingPlanPDF.tsx:38` (`RoomingPlanPDFProps`) + `RoomingPlanPDFButton` ; `RoomingPlanView` en écran | feature | — | L | — |
| 20 | Module Chambres — grille calendaire hébergeur | RE:163 | **PAS FAIT** | recherche vide : `grille calendaire`/`CalendrierChambres` → 0 | feature | THÉO-OBLIGATOIRE | M | Après LOT 4 |
| 21 | Chambres — mise en transaction des 5 blocs signature non atomiques (4b) | RE:163-164 | **PAS FAIT** (atomicité absente) | param `tx` présent mais « aucun site ne le passe encore » (`occupations.service.ts:183`) → blocs signature non atomiques | sécurité/dette | THÉO-OBLIGATOIRE | M | Session à froid |
| 22 | Hygiène Lot 5 : retirer l'injection `OccupationsService` inutilisée dans `SejourService` (M2) | RE:163,172 | **INDÉTERMINÉ** (recherche vide → probablement déjà retirée) | recherche vide : `OccupationsService` dans `backend/src/sejours/sejour.service.ts` → 0 (absence ≠ preuve de refonte) | dette | AUTO-ÉCRITURE | S | Retirer avec l'import `ChambresModule` |
| 23 | Ouvrir le rooming à l'équipe de centre (B4+S1, avant Tereva) | RE:172 | **À TRANCHER** (décision de périmètre) | doc RE:172 (décision « ouvre-t-on ? ») | sécurité/produit | THÉO-OBLIGATOIRE | M | Check permission `sejours` + gate plan |
| 24 | Autorisations parentales côté gestion en propre (B5) | RE:172 | **À TRANCHER** | doc RE:172 (`envoyerInvitations` créateur-strict) | produit | THÉO-OBLIGATOIRE | M | — |
| 25 | Unifier la vue Chambres hébergeur COLLAB↔DIRECT (options A/B/C) | RE:177 | **À TRANCHER** | doc RE:177 (3 options posées) | produit | THÉO-OBLIGATOIRE | M | Recette COLLAB (orga qui roome) |
| 26 | PDF « plan » : liste par étage vs planche 2D (3bis) | RE:178 | **À TRANCHER** | doc RE:178 | produit | THÉO-OBLIGATOIRE | S | Enjeu pagination 60 chambres (Tereva) |
| 27 | Lisibilité du bouton « Gérer les chambres » (3ter) | RE:179 | **PAS FAIT** | bouton toujours discret « ▸ Gérer les chambres » (`TabChambres.tsx:533`), libellé inchangé | produit | COWORK-PALIERS | S | — |
| 28 | Hygiène code mort Chambres M1-M7 (re-export ETIQUETTES, dédup `isPlanInsufficient` ×3, etc.) | RE:172 | **PAS FAIT** (dédup non faite) | `isPlanInsufficient` défini localement (`TabChambres.tsx:63`) → dédup M6/M7 non faite | dette | COWORK-PALIERS | M | Run à froid groupé |
| 29 | B3 : ordre des étages sur le chemin à plat orga (`getRooming` tri alphabétique) | RE:172 | **PAS FAIT** (tri alpha confirmé) | `getRooming` `.sort((a,b)=> (a.chambre.etage ?? '') ...)` (`rooming.service.ts:238`) — tri alphabétique sur `etage` | dette | AUTO-ÉCRITURE | S | — |
| 30 | S2 : `cloturerInscriptions` trop ouvert (hérite `@Roles` de classe) | RE:172 | **À AUDITER** (défaut périmètre confirmé au contrôleur) | `cloturerInscriptions` sans `@Roles` méthode → hérite classe `@Roles(ORGANISATEUR,HEBERGEUR,SIGNATAIRE)` (`collaboration.controller.ts:367` vs classe `:34`) ; garde interne service à auditer | sécurité | THÉO-OBLIGATOIRE | S | — |
| 31 | S3 : `hebergementCategorie` lisible par l'hébergeur de n'importe quel COLLAB (`getRooming`) | RE:172 | **À AUDITER** (champ exposé confirmé) | `hebergementCategorie` retourné par `getRooming` (`rooming.service.ts:223,280`) → glissement à auditer selon modèle d'accès | sécurité | THÉO-OBLIGATOIRE | S | — |
| 32 | S4 : statut séjour jamais vérifié dans `resoudreAccesRooming` (roomer sur ANNULE/TERMINE) | RE:172 | **À AUDITER — défaut confirmé présent** | `resoudreAccesRooming` (`rooming.service.ts:99-140`) ne vérifie que `deletedAt`, jamais `sejour.statut` (ANNULE/TERMINE) | sécurité | THÉO-OBLIGATOIRE | S | — |
| 33 | Séjour sans date = état durable partout (liste séjours, recherche, CRM) | RE:175 ; RE:77(18/08-8) | **PARTIEL** | `frontend/app/dashboard/hebergeur/sejours/page.tsx:157` gère `dateDebut` null ; `planning/page.tsx:256` les exclut volontairement | produit | THÉO-OBLIGATOIRE | M | Découvrabilité liée au chantier F3 (item 45) |
| 34 | Onboarding hébergeur multi-centre — enrichissement par centre | RE:187-195 | **PAS FAIT** (conception, septembre) | doc RE:187-195 ; audit du parcours d'onboarding non fait | produit | THÉO-OBLIGATOIRE | L | Enjeu Tereva 14 centres |
| 35 | Suivi santé client (admin) : signal « setup récent / fiche incomplète » vs actif/inactif | RE:193 | **PAS FAIT** (conception) | doc RE:193 | produit | THÉO-OBLIGATOIRE | M | Corrélé item 34 |
| 36 | Espace organisateur 2a : devis DIRECT signé invisible dans l'espace du signataire à compte (rattacher signataire↔séjour) | RE:202 | **PAS FAIT** | recherche vide : `signataireId`/`SejourSignataire` dans `schema.prisma` → aucune relation signataire↔séjour | produit | THÉO-OBLIGATOIRE | M | Relation/migration probable |
| 37 | Espace organisateur 2b : invitation collab pendante retrouvable depuis le dashboard | RE:203 ; SS(17/08) | **FAIT (confirmé complet)** | endpoint `@Get('pendantes')` (`controller:42`) + front `InvitationsPendantesBanner.tsx:38` fetch `/pendantes`, monté `organisateur/layout.tsx:6`, rend « {centre} vous invite » (`:69`) | produit | — | — | — |
| 38 | Refonte lisibilité espace organisateur + onboarding organisateur (dashboard peu intuitif) | RE:199-205 | **PAS FAIT** (conception, septembre) | doc RE:199-205 | produit | THÉO-OBLIGATOIRE | L | Lire dashboard org réel |
| 39 | Onboarding première connexion (flag `premiereConnexion`) / `FeatureHint` ×4 | RE:618(3.9),798(10.11) | **PAS FAIT** | recherche vide : `FeatureHint` et `premiereConnexion` dans `frontend/app`+`src` → 0 | produit | THÉO-OBLIGATOIRE | M | — |
| 40 | Signature riche dans l'espace connecté organisateur (options A/B/C) | RE:31-51(19/08-3) | **À TRANCHER** | doc RE:46-49 (3 options, NON TRANCHÉ) | produit/sécurité | THÉO-OBLIGATOIRE | L | Cas Jocelyne (urgent) vs chantier Tereva |
| 41 | À l'acceptation d'invitation : router vers une vraie signature vs « marquer signé » | RE:29(19/08-4) | **À TRANCHER** | doc RE:29 (NON TRANCHÉ) | produit | THÉO-OBLIGATOIRE | M | — |
| 42 | Dualité effectif séjour vs demande — solution A (séjour source unique) | RE:11(21/08) | **À TRANCHER** (à rechallenger avant dev) | doc RE:11 (`demande?.X ?? sejour.X`, décision non définitive) | dette/produit | THÉO-OBLIGATOIRE | M | Audit exhaustif lecteurs `demande.nombreEleves` |
| 43 | Suppression de documents (paramètres) : supprimer définitivement vs remplacer | RE:21(19/08-4 #2) | **À TRANCHER** | doc RE:21 | produit | THÉO-OBLIGATOIRE | S | Effets de bord doc↔convention |
| 44 | Planning : couleur par activité (catalogue) vs par groupe | RE:24(19/08-4 #5) | **À TRANCHER** (à border) | doc RE:24 | produit | THÉO-OBLIGATOIRE | S | — |
| 45 | Chantier F3 « anti-doublon » séjours (avertir sans bloquer) | RE:77(18/08-8) | **À TRANCHER / PAS FAIT** (conception) | doc RE:77 ; dépend de la découvrabilité « séjour sans dates » (item 33) | produit | THÉO-OBLIGATOIRE | M | Item 33 (dépendance dure) |
| 46 | Refonte page « Devis envoyés » (tableau filtrable/triable, pagination, export CSV) | RPD:166-176 ; RE:611(3.2) | **PAS FAIT** | page encore en onglets comptés (`matchesOnglet` `hebergeur/devis/page.tsx:37`) ; pas de tri/pagination/filtres | produit | COWORK-PALIERS | M | Trigger 100+ devis |
| 47 | Flux iCal lecture seule (`GET /centres/:id/calendar.ics`) | RPD:112-117 ; RE:612(3.3) | **PAS FAIT** | recherche vide : `calendar.ics` dans `backend/src/centres` → 0 | feature | AUTO-ÉCRITURE | S | Trigger 1er hébergeur demandeur |
| 48 | SC7 — notification des centres APIDAE non inscrits (`notifierCentresApidae`) | RPD:78-83 ; RE:613(3.4) | **PAS FAIT** | recherche vide : `notifierCentresApidae`/`dernierEmailDemandeAt` → 0 | feature | COWORK-PALIERS | S | Suspendu (validation LMDJ) |
| 49 | Intégration APIDAE LMDJ (ajout d'une source dans `syncApidae`) | RPD:85-88 ; RE:616(3.7) | **PAS FAIT** (dépendance credentials externes) | `backend/src/admin/admin.service.ts:520` (`syncApidae` existe) ; source LMDJ non ajoutée | feature | THÉO-OBLIGATOIRE | S | Credentials Anaïtis/Amandine |
| 50 | SSO APIDAE OAuth2 (APIDAE Connect) | RE:617(3.8) | **PAS FAIT** | recherche vide : APIDAE OAuth/SSO dans `backend/src` → 0 | feature | THÉO-OBLIGATOIRE | M | Credentials APIDAE Connect |
| 51 | KPI « CA apporté par le réseau » + fix « dont X€ via réseau » (mauvais fichier global→hébergeur) | RPD:188-199 ; RE:615(3.6) | **PAS FAIT** | données `sourceReseau` présentes (`demande.ts:24`) mais KPI « CA apporté par le réseau » absent côté hébergeur (recherche vide `apporté`/`via réseau`/`CA réseau`) | produit | THÉO-OBLIGATOIRE | M | À valider avec Marie |
| 52 | Concept « Réponse PDF » (adhérents LMDJ Découverte) | RE:614(3.5) | **PAS FAIT** | recherche vide : `Réponse PDF`/`ReponsePDF` → 0 | feature | THÉO-OBLIGATOIRE | M | Si accord CA LMDJ |
| 53 | Webhooks événementiels (`WebhookEndpoint`) | RPD:125-129 ; RE:681 | **PAS FAIT** | recherche vide : `WebhookEndpoint` dans `backend/src` → 0 | feature | THÉO-OBLIGATOIRE | M | 1er client demandeur |
| 54 | Appel d'offres transport (nouveau type de demande, autocaristes) | RPD:136-139 ; RE:691 | **PAS FAIT** (backlog) | doc RE:691 (« impact schéma à évaluer ») | feature | THÉO-OBLIGATOIRE | L | — |
| 55 | Carte interactive du catalogue + coordonnées GPS (`latitude`/`longitude`) | RE:152-154 | **PAS FAIT** | recherche vide : `latitude`/`longitude` dans `backend/prisma/schema.prisma` → 0 | feature | THÉO-OBLIGATOIRE | M | Backfill GPS API Éducation nationale |
| 56 | Landing page — screenshots produit réels (3-4) | RPD:73-76 | **PAS FAIT** (contenu) | doc RPD:73-76 | produit/contenu | THÉO-OBLIGATOIRE | S | Retours 3-5 cibles |
| 57 | Pop-up aide IA contextuelle dans le dashboard | RPD:93-96 | **PAS FAIT** | recherche vide : `aide IA`/`assistant`/`AssistantIA` → 0 | feature | THÉO-OBLIGATOIRE | L | — |
| 58 | Planning IA — génération automatique (valider avec vrais produits Sauvageon) | RPD:98-101 | **PARTIEL** (doc : partiellement implémenté) | `genererPlanningIA` existe (refonte m2m 07/07) ; complétude non re-vérifiée code | feature | THÉO-OBLIGATOIRE | M | Vrais produits Sauvageon |
| 59 | Menu auto-généré IA (régimes/allergies) | RPD:103-106 | **PAS FAIT** | recherche vide : `menu IA`/`genererMenu`/`MenuAuto` → 0 | feature | THÉO-OBLIGATOIRE | L | Catalogue repas Sauvageon |
| 60 | Fusionner les 3 `DevisBuilder` en 1 composant paramétrique | DT:25-33 ; RE:628(4.1) ; SS:1186 | **PARTIEL** | `DevisEditor` partagé importé `hebergeur/devis/nouveau/page.tsx:15` + `.../[id]/modifier/page.tsx:13` ; mais `_components/TabDevisFacturation.tsx` ne l'importe pas | dette | COWORK-PALIERS | M | Prochaine modif devis |
| 61 | Découper `sejour/[id]/page.tsx` — onglets restants + `TabDevisFacturation` ~109KB | DT:41-52 ; RE:630(4.3) | **PARTIEL** | Nombreux `_components/Tab*.tsx` extraits (ex. `TabProjetPedagogique.tsx`, `TabPlanning.tsx`) ; extraction « au fil de l'eau » non terminée | dette | COWORK-PALIERS | M | Quand on touche les onglets |
| 62 | Pré-vol comptabilité avalé silencieusement (afficher `previewErreur`) | DT:69 | **PAS FAIT** | `frontend/app/dashboard/hebergeur/pilotage/comptabilite/page.tsx:63` : `.catch(() => setPreview(null))` (aucun état d'erreur) | dette/fix | AUTO-ÉCRITURE | S | Au prochain passage sur ce fichier |
| 63 | Concurrence `zipFromUrls` 5→10 (quand un client dépasse ~150 factures) | DT:71 | **PAS FAIT** (volontaire, trigger) | `backend/src/storage/storage.service.ts:171` : `concurrence = 5` (défaut) | dette | AUTO-ÉCRITURE | S | Trigger >150 factures/période |
| 64 | LOT 6 maintenance continue (logs, HTML injection emails, `omit` Prisma) | RE:631(4.4) | **PARTIEL** | `escapeHtml` en place dans les emails (`email.service.ts:33,99,119`) ; volets logs/`omit` Prisma « au fil de l'eau », non vérifiés | dette | COWORK-PALIERS | — | Quand on touche les fichiers |
| 65 | Double bandeau sous-pages organisateur/admin | RE:632(4.5) ; SS:1187 | **INDÉTERMINÉ** (non tranché) | défaut visuel non identifiable par grep (recherche vide `bandeau`/`SousPageHeader` sous-pages) | dette | COWORK-PALIERS | S | Suivi DashboardShell |
| 66 | CI minimale GitHub Actions (tsc + build) | RE:635(4.8) | **PAS FAIT** | `.github/workflows` **absent** (dossier inexistant) | dette | AUTO-ÉCRITURE | S | Post-pitch |
| 67 | Tests unitaires code financier frontend (`devis-calculs.ts`, formule acompte) | RE:636(4.9) | **PARTIEL** | `frontend/src/lib/devis-calculs.test.ts` existe (front testé) ; couverture « formule acompte » non vérifiée | dette | THÉO-OBLIGATOIRE | M | Post-pitch |
| 68 | Upgrade `@react-pdf/renderer` → retirer le pin `pako@1.0.11` | RE:647(4.16) | **PAS FAIT** | pin toujours présent : `frontend/package.json:24` `"pako": "1.0.11"` | dette | COWORK-PALIERS | S | Post-pitch |
| 69 | Qté 0 affiche « 0 » dans PDF devis (afficher « — ») | RE:648(4.17) | **FAIT** | « — » affiché quand `quantite===0` : `frontend/src/components/pdf/DevisPDF.tsx:243,247,248` | cosmétique | — | S | — |
| 70 | Refonte `regrouperParCreneau` (badges groupes journal public, schéma m2m) | RE:652(4.18) | **PAS FAIT** (fonction présente, non refondue) | `frontend/app/sejour/[token]/journal/page.tsx:75` (fonction présente) ; refonte m2m non confirmée | dette | COWORK-PALIERS | S | Si plainte client |
| 71 | Cron : 2 mails d'alerte le même jour pour un compte multi-centre aligné | RE:650(4.20) | **FAIT** (résolu par refonte par-org) | `envoyerAlertes` itère par organisation (`cron-alertes.service.ts:62`, `for (const org of orgs)`) et prend `centresExploites[0]` → 1 mail/org ; regroupement 4.20 déclaré « obsolète » (`:68`) | dette | — | S | — |
| 72 | Quirk `accent` hex sur `KpiCard` admin (couleur ignorée) | RE:640(4.22) | **FAIT** (quirk non présent) | `KpiCard` consomme `accent` en className (`KpiCard.tsx:19`) et les appelants admin passent des classes Tailwind (recherche vide `accent="#"`) | cosmétique | — | S | — |
| 73 | Double format de période réseau vs organisateur/hébergeur | RE:641(4.23) | **PAS FAIT** (2 formats coexistent) | `demandePeriode` (`reseau/page.tsx:25`) vs `afficherDatesDemande` (`utils.ts:93`) | cosmétique | AUTO-ÉCRITURE | S | Si incohérence visuelle gêne |
| 74 | Convergence `DEPT_TO_REGION` Corse/DOM (avant réseau national) | RE:643(4.24) | **PAS FAIT** (table incomplète confirmée) | `DEPT_TO_REGION` (`public.service.ts:290-332`) sans Corse (2A/2B) ni DOM (97x) — recherche vide dans la table | dette | THÉO-OBLIGATOIRE | S | Décision métier avant push national |
| 75 | `claimFromCatalogue` : résolution d'organisation par le chemin, pas par la donnée | RE:334,649(4.19) | **À AUDITER** (défaut d'ordre partiellement confirmé) | `claim.service.ts:134` (méthode) ; `findFirst` centre **sans `orderBy`** (`:178`) → ordre arbitraire possible ; justesse à auditer | dette/sécurité | THÉO-OBLIGATOIRE | S | Après recette |
| 76 | Routage cas 2 inscription (invitation admin → PENDING au lieu d'ACTIVE) | RE:299 | **INDÉTERMINÉ** (non tranché) | `registerHebergeur` route en `EN_ATTENTE_DOCUMENT` (`auth.service.ts:402`) ; le câblage « cas 2 → ACTIVE » non tranché (lecture flux approfondie requise) | dette | THÉO-OBLIGATOIRE | M | — |
| 77 | Contre-test multi-centre sur les exports (2e centre de Louise) | RE:511-517 | **INDÉTERMINÉ** (recette manuelle, non-code) | recette manuelle en attente du 2e centre Chambéret | dette/test | THÉO-OBLIGATOIRE | S | Existence 2e centre Louise |
| 78 | Migration cookie httpOnly / JWT (contradiction POST_DEMO « FAIT » vs RE « EN PAUSE ») | RPD:150-152 ; RE:598(2.6) | **FAIT (confirmé complet, front inclus)** | back pose 2 cookies httpOnly (`auth-cookies.ts:6,14,25` → `auth.controller.ts:26`) ET front ne lit jamais le token en JS : aucun `Authorization` (recherche vide), `access_token` non stocké (« On ne stocke que le profil » `AuthContext.tsx:146`), proxy same-origin `/api` (`next.config` rewrites `:14`) → surface XSS fermée. RE §2.6 « EN PAUSE » périmé | sécurité | — | — | — |
| 79 | Backfill CRM des séjours collab existants (T1 Ch.2 sous-chantier B) | T1:33-35,51-65 | **INDÉTERMINÉ** (SQL prod, non code-vérifiable) | code (sous-chantier A) FAIT : `invitation-collaboration.service.ts:25` `linkSejourToCRM`, appelé `:480` ; backfill SQL non lisible | dette | THÉO-OBLIGATOIRE | S | `scalingo pgsql-console` |
| 80 | DMARC `p=none` → `p=quarantine` | SS:1188 | **INDÉTERMINÉ** (DNS/infra, hors code) | Non code-vérifiable (config DNS OVH) | sécurité/infra | THÉO-OBLIGATOIRE | S | — |
| 81 | Extraction `PlanningPDF` — dépiler le stash, retirer le code dupliqué | RE:790(10.3) | **FAIT** (code dédupliqué) | `PlanningPDFButton` extrait importé+utilisé (`TabPlanning.tsx:29,680,716`), pas de duplication inline visible | dette | — | S | — |
| 82 | Ajouter `build-error*.txt` au `.gitignore` frontend | RE:791(10.4) | **PAS FAIT** | `build-error` **absent** de `.gitignore` | dette | AUTO-ÉCRITURE | S | — |
| 83 | Boîte admin `contact@liavo.fr` : relève lente (redirection MX/IMAP) | RE:797(10.10) | **INDÉTERMINÉ** (infra, hors code) | Non code-vérifiable | infra | THÉO-OBLIGATOIRE | S | — |
| 84 | List-Unsubscribe : webhook Brevo « unsubscribed » → alerte admin | RE:140 | **PAS FAIT** | recherche vide : `unsubscrib`/`List-Unsubscribe` dans `backend/src/email` → 0 | dette/fix | COWORK-PALIERS | S | Surveillance manuelle en attendant |
| 85 | Routage des réponses automatiques emails (From plateforme + Reply-To hébergeur) | RE:141 | **À TRANCHER / PAS FAIT** (conception à froid) | doc RE:141 (options à instruire, « ne pas coder à chaud ») | feature/infra | THÉO-OBLIGATOIRE | L | Avant échelle Tereva |
| 86 | Chantiers conditionnels LMDJ 5.1-5.8 (validation réseau, motif refus, multi-classes, split maternelle/PMI, ratio KPIs, capture 73/74, CRM réseau, pricing bundlé) | RE:662-669 | **À TRANCHER** (SI accord CA LMDJ) | doc RE:656-669 (conditionnés à l'accord CA) | feature/produit | THÉO-OBLIGATOIRE | L | Accord CA LMDJ |
| 87 | Module Pilotage — itérations (conversion funnel, export PDF mensuel, planning équipe) | SS:1176-1179 | **PAS FAIT** (backlog) | doc SS:1176-1179 | feature | THÉO-OBLIGATOIRE | L | — |
| 88 | Grille tarifaire dégressive (besoin Yves/Pôle Montagne) | RE:692 | **À TRANCHER** (reporté) | doc RE:692 (requalifier si signal 3+ adhérents) | produit | THÉO-OBLIGATOIRE | M | Signal d'autres adhérents |
| 89 | RC Pro + Cyber insurance (Hiscox ~500-700€/an) | RPD:160-162 | **À TRANCHER** (business, différé) | doc RPD:160-162 | business | THÉO-OBLIGATOIRE | — | Post-démo |
| 90 | Séquence de financement (Initiative Faucigny, Start-up & Go, Réseau Entreprendre, BPI) | RPD:180-186 | **hors dev** (business) | doc RPD:180-186 | business | THÉO-OBLIGATOIRE | — | — |
| 91 | App mobile PWA (manifest + service worker) | RE:689 | **PAS FAIT** | `frontend/app/manifest.json` = placeholder par défaut (`"name":"MyWebSite"`) ; recherche vide `serviceWorker`/`workbox` → 0 | feature | THÉO-OBLIGATOIRE | M | — |
| 92 | Corriger la discordance doc grille tarifaire (0/39/59/79€ vs 29/49/69 page publique) | SS:649,676 | **PAS FAIT** (correction doc) | discordance signalée SS:676, non corrigée dans les docs | dette-doc | AUTO-ÉCRITURE | S | Confirmer prix réels avec Théo |

---

## Journal 2e passe (2026-08-24)

Une ligne par item requalifié (les items inchangés n'y figurent pas). Format : `#N : <ancien> → <nouveau> — <preuve>`.

**Lot A — INDÉTERMINÉ tranchés (29/31) :**
- #6 : INDÉTERMINÉ → PAS FAIT — recherche vide `ContentDisposition` dans `storage/`+`facture/`.
- #8 : INDÉTERMINÉ → FAIT — renouvellement via `calculerMontantAbonnementCents` (abonnement.service.ts:454), supplément inclus (constants:3-4,34).
- #10 : INDÉTERMINÉ → PAS FAIT — recherche vide `tva-marge`/`marge` dans `pilotage/`.
- #19 : INDÉTERMINÉ → FAIT — `RoomingPlanPDF.tsx:38` (LOT4 vue plan + PDF livré).
- #20 : INDÉTERMINÉ → PAS FAIT — recherche vide `grille calendaire`/`CalendrierChambres`.
- #21 : INDÉTERMINÉ → PAS FAIT — `tx` présent mais « aucun site ne le passe encore » (occupations.service.ts:183), blocs signature non atomiques.
- #27 : INDÉTERMINÉ → PAS FAIT — bouton « ▸ Gérer les chambres » discret inchangé (TabChambres.tsx:533).
- #28 : INDÉTERMINÉ → PAS FAIT — `isPlanInsufficient` local (TabChambres.tsx:63), dédup non faite.
- #29 : INDÉTERMINÉ → PAS FAIT — tri alpha `etage` confirmé (rooming.service.ts:238).
- #30 : INDÉTERMINÉ → À AUDITER — `cloturerInscriptions` hérite `@Roles` classe 3 rôles (collaboration.controller.ts:367 vs :34).
- #31 : INDÉTERMINÉ → À AUDITER — `hebergementCategorie` retourné par `getRooming` (rooming.service.ts:280).
- #32 : INDÉTERMINÉ → À AUDITER (défaut confirmé) — `resoudreAccesRooming` ne vérifie que `deletedAt`, pas le statut (rooming.service.ts:99-140).
- #36 : INDÉTERMINÉ → PAS FAIT — recherche vide `signataireId`/`SejourSignataire` dans schema.
- #46 : INDÉTERMINÉ → PAS FAIT — page encore onglets `matchesOnglet` (hebergeur/devis/page.tsx:37).
- #50 : INDÉTERMINÉ → PAS FAIT — recherche vide APIDAE OAuth/SSO.
- #51 : INDÉTERMINÉ → PAS FAIT — `sourceReseau` présent (demande.ts:24), KPI « CA apporté » absent côté hébergeur.
- #52 : INDÉTERMINÉ → PAS FAIT — recherche vide `Réponse PDF`.
- #57 : INDÉTERMINÉ → PAS FAIT — recherche vide `aide IA`/`assistant`.
- #59 : INDÉTERMINÉ → PAS FAIT — recherche vide `menu IA`.
- #64 : INDÉTERMINÉ → PARTIEL — `escapeHtml` en place (email.service.ts:33,99,119) ; logs/`omit` Prisma non vérifiés.
- #67 : INDÉTERMINÉ → PARTIEL — `devis-calculs.test.ts` existe (front testé) ; formule acompte non vérifiée.
- #68 : INDÉTERMINÉ → PAS FAIT — pin `pako@1.0.11` toujours présent (package.json:24).
- #69 : INDÉTERMINÉ → FAIT — `'—'` si `quantite===0` (DevisPDF.tsx:243,247,248).
- #71 : INDÉTERMINÉ → FAIT — `envoyerAlertes` itère par org (cron-alertes.service.ts:62), regroupement 4.20 « obsolète » (:68).
- #72 : INDÉTERMINÉ → FAIT — `KpiCard` consomme `accent` en className (KpiCard.tsx:19), appelants en classes (recherche vide `accent="#"`).
- #73 : INDÉTERMINÉ → PAS FAIT — 2 formats : `demandePeriode` (reseau/page.tsx:25) vs `afficherDatesDemande` (utils.ts:93).
- #74 : INDÉTERMINÉ → PAS FAIT — `DEPT_TO_REGION` sans Corse/DOM (public.service.ts:290-332).
- #75 : INDÉTERMINÉ → À AUDITER — `findFirst` sans `orderBy` (claim.service.ts:178).
- #81 : INDÉTERMINÉ → FAIT — `PlanningPDFButton` extrait utilisé (TabPlanning.tsx:29,680,716), pas de dup inline.

**Lot A — restés INDÉTERMINÉ (2/31, non tranchés faute de signal grep fiable) :**
- #65 : reste INDÉTERMINÉ — défaut visuel « double bandeau » non identifiable par grep.
- #76 : reste INDÉTERMINÉ — `registerHebergeur` → `EN_ATTENTE_DOCUMENT` (auth.service.ts:402), mais câblage « cas 2 ACTIVE » exige une lecture de flux approfondie.

**Lot C — « FAIT » re-testés en complétude bout-en-bout (3/3 tenus) :**
- #4 : FAIT → FAIT confirmé complet — chaîne replyTo `{name: centreNom}` (facture.service.ts:883,898) + PDF `emetteurNom` (:243).
- #37 : FAIT → FAIT confirmé complet — endpoint (controller:42) ET front (InvitationsPendantesBanner.tsx:38, layout.tsx:6).
- #78 : FAIT → FAIT confirmé complet — vérif FRONT ajoutée : aucun `Authorization`, `access_token` non stocké (AuthContext.tsx:146), proxy `/api` same-origin (next.config:14). Le token n'est jamais lisible en JS → migration httpOnly réellement complète, « EN PAUSE » bien périmé.

**Lot D — argent/sécu re-localisés :**
- #5 : À TRANCHER (défaut actif confirmé) — `refreshFacturePdf` appelé par `ajouterVersement` (facture.service.ts:1059).
- #7 : À AUDITER (nuance) — garde anti-double-mandat **org-level** présente (abonnement.service.ts:267-269) → le doc surestime peut-être le risque.
- #14 : À AUDITER → **bug confirmé présent** — aucune borne basse dans `validateMontantEtVentilations` (rentabilite.service.ts:44).
- #16 : PAS FAIT confirmé (at-rest) — IBAN en clair (`centres_hebergement.iban`, `factures.emetteur_iban`), aucun chiffrement. **MAJ 25/08** : volet « endpoint public IBAN » = FAUX POSITIF vérifié (Claude, lecture code) — `getPublic`/`searchPublic` select explicite sans `iban`, IBAN jamais exposé hors PDF tokenisé (RIB, by design). #16 se réduit au chiffrement at-rest.
- #75 : voir Lot A (défaut d'ordre partiellement confirmé).

---

## Contrôle d'intégrité

**Comptage** : **92 items uniques** après dédoublonnage, issus de **~130 mentions brutes** sur les 5 docs. Nombre d'items == nombre de lignes du tableau (92). Aucun item perdu, inventé, ni dupliqué.

**Décompte par verdict (après 2e passe)** :

| Verdict | Nombre | Items |
|---|---|---|
| **FAIT** (dont 3 confirmés complets) | 9 | 4, 8, 19, 37, 69, 71, 72, 78, 81 |
| **PARTIEL** | 6 | 33, 58, 60, 61, 64, 67 |
| **À AUDITER** (argent/sécu — logique présente, justesse non jugée ; #14 = bug confirmé) | 6 | 7, 14, 30, 31, 32, 75 |
| **PAS FAIT** | 47 | 1, 2, 3, 6, 9, 10, 11, 12, 15, 16, 17, 18, 20, 21, 27, 28, 29, 34, 35, 36, 38, 39, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 59, 62, 63, 66, 68, 70, 73, 74, 82, 84, 87, 91, 92 |
| **À TRANCHER** (décision produit/business) | 16 | 5, 23, 24, 25, 26, 40, 41, 42, 43, 44, 45, 85, 86, 88, 89, 90 |
| **INDÉTERMINÉ** | 8 | 13, 22, 65, 76, 77, 79, 80, 83 |

Bilan 2e passe : **31 INDÉTERMINÉ traités → 29 tranchés, 2 restés** ; INDÉTERMINÉ global **28 → 8**.

**INDÉTERMINÉ restants (8) et leur raison** :

- **Non vérifiables par nature (5)** — état hors du code :
  - #13 — backfill SQL prod (état base non lisible en lecture de code).
  - #77 — recette manuelle en attente d'un 2e centre réel.
  - #79 — backfill CRM SQL prod (le code du sous-chantier A est FAIT ; le backfill non).
  - #80 — DMARC = config DNS OVH.
  - #83 — relève boîte mail = config MX/IMAP.
- **Non tranchés (grep insuffisant, exigent une lecture approfondie) (3)** :
  - #22 — `OccupationsService` absente de `sejour.service.ts` (recherche vide) mais absence ≠ preuve de refonte propre.
  - #65 — « double bandeau » = défaut visuel non capturable par grep.
  - #76 — câblage « cas 2 → ACTIVE » du parcours d'inscription (flux `registerHebergeur` à dérouler).

**Items ARGENT / SÉCURITÉ — localisés, justesse NON jugée (à auditer par Théo)** : 5, 7, 14 (**bug confirmé présent**), 16 (**PAS FAIT** at-rest ; endpoint public = faux positif vérifié 25/08), 30, 31, 32, 75. Verdict limité à « logique présente / défaut localisé à `fichier:ligne` » ; aucune correction déclarée sur la seule existence du code.

**Contradiction doc résolue sur code (re-confirmée en 2e passe, front inclus)** : **Cookie httpOnly (item 78)** — `POST_DEMO` « FAIT » vs `ROADMAP_ETE §2.6` « EN PAUSE ». Le code tranche **FAIT complet** : backend pose 2 cookies `httpOnly` (`auth-cookies.ts` → `auth.controller.ts:26`) ET le frontend ne lit jamais le token en JS (aucun `Authorization`, `access_token` non stocké `AuthContext.tsx:146`, proxy same-origin `/api` `next.config:14`). La ligne RE §2.6 « EN PAUSE » est périmée.
