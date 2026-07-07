# LIAVO — État session dev
> Dernière mise à jour : 07/07/2026 (soir) — Chantier onboarding backend (26 commits) mergé et déployé en prod. Recette régression Sauvageon 4/4. Voir roadmap section 10.

---

## SESSION 07/07/2026 (soir) — Onboarding backend : register immédiat, trial auto, gates anti-phishing, cron

### Livré et déployé (branche `feat/onboarding-register-trial`, 26 commits, mergée main)

- **Register hébergeur** : `compteValide=true` dès l'inscription (les deux modes). `compteValide` devient un kill switch admin vérifié à chaque requête (JWT strategy + refresh). Email `sendHebergeurAccountPending` réécrit. Bloc trial COMPLET + `setTimeout` J+25 supprimé (jamais fonctionnel — dyno restart).
- **Trial 30j Pilotage automatique à la première connexion** : hook privé dans `login()`, gardes `trialStartedAt null` + `mollieMandatId null` + **`abonnementStatut INACTIF`** (protège Sauvageon/Choucas/Alticlub/Pôle Montagne, vérifié en prod). Notif admin par centre.
- **Centres PENDING opérables** (`centre.helper.ts`) : seul SUSPENDED bloque (404 partout, propriétaire compris). Tiers sondant un PENDING → 404. `getCentresForUser` + `getCentreIdsForUser` alignés `not: SUSPENDED` (le fix `getCentreIdsForUser` a évité un planning vide pour les nouveaux — appelants : getMesSejoursConvention/Planning, getMesNonLus).
- **Gates anti-phishing** `assertEnvoiExterneAutorise` (centre.helper.ts) : tout envoi hébergeur→tiers bloqué tant que PENDING, exception destinataire = email du compte (parcours test). 10 sites gatés : envoyerDevisDirect, convention, notifierEnseignant, brochure, invitation-collab, inviter collaborateur, 3 émissions facture (post-persistance, email seul bloqué), envoyerFactureParEmail, inviterOrganisateur, devis create/update COLLAB. Exclusion documentée : 5 chemins collaboration.service (destinataire fixe, état inatteignable en PENDING). Code erreur : `CENTRE_EN_VALIDATION|message` (parsing frontend à faire).
- **Cron branché** : `@nestjs/schedule@6.1.3`, `cronQuotidien()` 8h Europe/Paris, garde `ENABLE_CRON==='true'` (posée sur Scalingo 07/07 + restart). 3 étapes : alertes J-21/14/7/3/1 (recentrées essais uniquement : filtres trial ajoutés), essais expirés, renouvellement annuel J-30 (mandat Mollie requis — zéro cible actuelle). Vérif J1 : 10.8 roadmap.
- **Justificatif ex-nihilo** : membership créé `EN_ATTENTE_DOCUMENT` (garde anti-collision dédup : org déjà détenue par un autre → NON_APPLICABLE). Tunnel claim existant réutilisé tel quel (admin/claims, uploadKbis élargi PDF/JPG/PNG, validerClaim). `getMonClaimStatut` renvoie `organisationId`.
- **`Devis.dateEnvoi`** : migration `20260707_add_date_envoi_devis` (ALTER + backfill created_at). Posé post-succès email dans envoyerDevisDirect (déviation CC approuvée : pas de faux "envoyé") et dans le create COLLAB (envoi immédiat via sendDevisRecu).
- **`GET /centres/onboarding-status`** : dérivation 5 étapes (profil, catalogue, conformité justificatif+iban, séjour, devis avec dateEnvoi), `$transaction`, + `centreValide`. Ligne 111 du controller, avant tout paramétré — pas d'avalement de route (vérifié findstr).

### Post-déploiement fait
- `ENABLE_CRON=true` + restart (timeout CLI au restart — état à confirmer via logs cron 08/07 matin, roadmap 10.8).
- SQL memberships→VALIDE : les 5 clients prod à VALIDE (vérifié par SELECT).
- Recette régression Sauvageon : login sans écrasement de plan ✓, planning/séjours/devis visibles ✓, catalogue public ✓. Envoi devis réel non testé (réserve consignée).

### En attente
- **Test flow nouveau compte** : 08/07 (SIRET Roche-Loison ou local). Compte à neutraliser ensuite (roadmap 10.6).
- **Stash `extraction PlanningPDF en cours`** à dépiler + build frontend (roadmap 10.3).
- **Prompt 4 frontend** (checklist gamifiée sobre + welcome modal + fixes 4a) : en cours de rédaction.
- Rapports CC : `docs/cc-reports/RAPPORT_PROMPT_2TER.md`, `RAPPORT_PROMPT_3.md`.
- Discordance relevée : ligne roadmap "Grille tarifaire 0/39/59/79€" (30/06) contredit la page publique 29/49/69 confirmée par Théo le 07/07 — à corriger dans la table des décisions.

---

## SESSION 07/07/2026 — Refonte planning-groupes many-to-many + fix Prisma migrations + refactor PDF

### Contexte

Chantier initial : permettre à Anne (Choucas) et Yves (Pôle Montagne) de construire leurs plannings 6 mois avant les inscriptions élèves pour validation prestataires. Diagnostic exhaustif du code → la génération auto marchait déjà pour les 3 cas (DIRECT pur, DIRECT→COLLAB basculé, COLLAB natif via appel d'offre). Seul trou identifié : impossible de rattacher plusieurs groupes à une même activité manuelle.

Décision produit : refonte many-to-many complète (Option A) et non un patch ni un array Postgres — fix à la source, sémantique pure, pas de dette technique.

### Livré (5 commits + migration SQL prod)

**Commit 9803ba9 — Backend refonte m2m**
- `schema.prisma` : nouveau model `PlanningActiviteGroupe` (table de jointure, unique composite, onDelete Cascade des deux côtés). Suppression de `PlanningActivite.groupeId` + relation `groupe`. Ajout `groupes PlanningActiviteGroupe[]` sur PlanningActivite et `planningActivites PlanningActiviteGroupe[]` sur GroupeSejour.
- `backend/prisma/manual-migrations/planning-groupes-m2m.sql` : migration SQL transactionnelle (CREATE TABLE + backfill des `groupeId` existants + DROP COLUMN + index). Déplacée depuis `migrations/manual/` par le commit 34b302a.
- `create-planning.dto.ts` : ajout `@IsArray() @IsOptional() @IsUUID('4', { each: true }) groupeIds?: string[]`.
- `collaboration.service.ts` :
  - `getPlanning` inclut les groupes via nested include + mapping pour aplatir en `groupes: [{id, nom, couleur}]`.
  - `createPlanning` accepte `groupeIds`, crée les relations via nested Prisma.
  - `deletePlanning` : cascade automatique via onDelete Cascade.
  - `genererPlanningIA` REFONDU : au lieu de créer N × PlanningActivite (une par groupe du cluster), crée 1 seule activité par (cluster × activité) attachée à tous les groupes du cluster. Titre simplifié (plus de suffixe " — G1"). Impact : environ 4× moins d'entrées en base pour un même planning.

**Commit 8728934 — Frontend UI multi-groupes**
- `collaboration.ts` : type `PlanningActivite.groupeNom` supprimé, remplacé par `groupes: Array<{id, nom, couleur}>`. Signature `createPlanning` accepte `groupeIds?: string[]`.
- `TabPlanning.tsx` : ajout d'un multi-select "Groupes concernés" dans la modale (pastilles rondes colorées, toggle sélection, mutuellement exclusif avec `estCollective`). Les 4 chemins de drag (catalogue, parking, calendrier existant, resize) préservent les groupeIds. Rendu `DraggableActivity` affiche les groupes via `labelGroupes` (ex: "G1, G3" ou "Tous les groupes").
- `PlanningPDF.tsx` : type `groupes` remplace `groupeNom`. Rendu bloc reconstruit le label depuis `groupes[]`.

**Commit 34b302a — Fix Prisma migrations manual/**
Root cause : Prisma scanne tout le dossier `prisma/migrations/` et attend un `migration.sql` dans chaque sous-dossier. Le dossier `manual/` créé pour la migration SQL manuelle a été détecté comme la 115ᵉ migration mais son fichier s'appelait `planning-groupes-m2m.sql` (pas `migration.sql`) → erreur P3015 au boot Scalingo → `migrate deploy` planté → app HS pendant ~10 min.

Fix : `git mv backend/prisma/migrations/manual backend/prisma/manual-migrations` — sortie du scan Prisma. Le dossier reste dans le repo pour traçabilité mais n'est plus interprété comme migration.

**Commit d683820 — Refactor PDF extraction (rétroactif chantier 05/07)**
Extraction en 2 fichiers (Button + PDF component) avec dynamic import de `@react-pdf/renderer` sur BudgetPDFButton, PreparationTamPDFButton, ProjetPedagogiquePDFButton (calqué sur DevisPDFButton et PlanningPDFButton). 6 fichiers, 717 insertions, 699 suppressions.

**Commit fe7db8a — Docs**
`docs/audit-planning-cascade.md` (audit CC Phase 1) + `docs/ROADMAP_ETE_2026.md` (mise à jour).

### Migration prod

SQL exécuté avant le push via `scalingo --app liavo-backend --region osc-fr1 pgsql-console` en un seul bloc BEGIN/COMMIT :
```sql
CREATE TABLE planning_activite_groupes (...);
CREATE INDEX idx_pag_groupe ...;
INSERT INTO planning_activite_groupes ... FROM planning_activites WHERE groupe_id IS NOT NULL;
ALTER TABLE planning_activites DROP COLUMN groupe_id;
```
Vérification post-migration : `COUNT(*) FROM planning_activite_groupes = 0` (aucune activité IA n'avait de groupeId en prod), colonne `groupe_id` bien supprimée. Backend redémarré, `Backend running on port 23364`, toutes les routes mappées.

### Audit exhaustif Phase 1 (post-refonte)

CC a scanné tout le repo pour trouver les cascades. Résultat : **0 occurrence à fixer**. Les 8 endroits qui incluent `planningActivites` via Prisma le font en bare include, et le frontend n'accède qu'aux champs scalaires (titre, heureDebut, heureFin, responsable, couleur). Aucun code ne lit l'ancien `groupeId` ou `groupeNom`.

Deux points de dette identifiés dans l'audit (docs/audit-planning-cascade.md section C) :
- **C.1** : titres "Escalade — G1" en base — **non-problème confirmé** (COUNT prod = 0 activité avec ce suffixe sur 25 activités totales).
- **C.2** : `regrouperParCreneau` dans journal public parse les suffixes de titre. Marche pour anciens plannings (aucun en prod), pas pour nouveaux (pas de suffixe). Dégradation cosmétique du journal public. Reporté en dette technique.

### Leçons retenues

1. **Distinction 3 cas de création de séjour** : DIRECT pur (hébergeur seul, createurId=null), DIRECT→COLLAB (invitation acceptée, mute modeGestion + crée demande pont avec `nombreEleves: placesTotales`), COLLAB natif (appel d'offre, `demande.nombreEleves` renseigné). `proposerGroupes` fait `demande?.nombreEleves ?? sejour.placesTotales` — couvre les 3 cas.
2. **`prisma migrate deploy` scanne TOUS les sous-dossiers** de `prisma/migrations/`. Ne jamais créer de sous-dossier dans `migrations/` pour autre chose que des migrations Prisma standards (nommage `YYYYMMDDHHMMSS_nom` + fichier `migration.sql`). Pour les migrations SQL manuelles à référencer dans le repo : `prisma/manual-migrations/` ou `docs/migrations/`, jamais dans `prisma/migrations/`.
3. **Backfill à 0 = feature jamais utilisée en prod jusqu'ici**. La table `planning_activite_groupes` est vide après migration parce qu'aucune activité IA n'avait été générée en prod avec l'ancien schéma. Ni Anne, ni Yves, ni personne n'avait vraiment testé la génération planning en production — même si l'UI existait depuis un moment.
4. **Fix à la source vs patch** : Théo a rejeté catégoriquement Option B (activités dupliquées) et Option C (array Postgres) au profit d'une refonte many-to-many propre malgré le coût (2h vs 30min). Trade-off assumé : pas de dette. L'audit a confirmé qu'il n'y avait pas de cascade cachée.
5. **Backend et frontend Scalingo redéploient indépendamment**. Fenêtre de risque entre push et fin des 2 rebuilds : ~5-10 min pendant lesquelles les deux versions peuvent coexister. Ici : le push a précédé le SQL, donc le nouveau backend a démarré sur une base sans la table de jointure → crash P3015. À l'avenir : ordre strict SQL prod → push code, jamais l'inverse.

### Status test empirique m2m
**Non validé en prod** au moment de la clôture de session. Backend UP (Nest démarré 11:48), frontend UP (Ready 11:50), audit code clean. Test manuel utilisateur reporté à Théo (créer une activité manuelle avec 2 groupes sur un séjour test, vérifier badges affichés).

---

## SESSION 05/07/2026 — Colonne PU TTC devis/facture + fix build local turbopack

### Feature Alticlub — livrée

Alticlub voulait des lignes "option" affichant HT/TTC sans impact sur le total. Workaround qty=0 conservé (pas de nouveau champ, pas de migration) mais colonne PU TTC ajoutée aux 3 rendus (DevisPDF, page publique signer, FacturePDF).

**Fichiers modifiés** (commit 9b412bb + 8504438) :
- `frontend/src/components/pdf/DevisPDF.tsx` — 7 colonnes : Désignation | Qté | PU TTC | TVA % | PU HT | Total HT | Total TTC (largeurs 28/8/12/8/12/16/16 = 100%)
- `frontend/app/devis/signer/[token]/page.tsx` — mêmes 7 colonnes avec responsive `hidden sm:table-cell` sur TVA%, PU HT, Total HT
- `backend/src/facture/pdf/FacturePDF.tsx` — mêmes 7 colonnes (uniformisation devis/facture pour cohérence comptable)

Helper `puTTC = (puHT, tva) => Math.round(puHT * (1 + tva/100) * 100) / 100` répété à l'identique dans les 3 fichiers. PU TTC dérivé du HT stocké, jamais persisté.

### Fix build local turbopack — livré (commit 8a60079)

Root cause : `@react-pdf/pdfkit 4.1.0` (lib/pdfkit.browser.js) importe `pako/lib/zlib/*.js` **sans déclarer pako comme dépendance**. Ça marchait par hoisting du pako@1.0.11 nested sous `browserify-zlib`. Turbopack strict sur la résolution → bloqué. Un premier `npm install pako` (v3) avait aggravé (exports field v3 bloque les subpaths).

Fix : `npm install pako@1.0.11 --save-exact` (dépendance directe explicite) + suppression de l'override `browserify-zlib.pako` inutile. Aucun fichier source .ts/.tsx touché. `tsc --noEmit` + `npm run build` verts après fix.

### Grille tarifaire dégressive Yves — reporté

Yves (Pôle Montagne) demande une grille tarifaire dégressive multi-centre (Les Gets, Florimont, Bellevaux) avec paliers d'effectif. Diagnostic : besoin différent de la feature Alticlub (document pricing en amont du devis, pas ligne dans un devis existant). Options évaluées : PJ PDF externe / section grille structurée sur devis (JSON) / paliers sur ProduitCatalogue (auto-calcul) / textarea `notesTarifaires`. Théo a acté "on voit plus tard pour Yves". Ajouté au backlog §6 de la roadmap. Requalifier SI d'autres adhérents LMDJ expriment le besoin.

### Leçons retenues

1. **Dépendance fantôme** : quand un package importe un sous-module via un path direct (`pako/lib/zlib/*.js`) sans le déclarer dans ses deps, le résolveur strict (turbopack) casse. Le résolveur permissif (webpack legacy) hoiste. Solution : épingler la dépendance directement dans le package.json de l'app avec la version exacte.
2. **Workaround acceptable si le fix source est disproportionné**. Alticlub a lu son besoin comme "afficher PU TTC" — pas "typer les lignes d'option en base". Théo a tranché le workaround qty=0 + colonne PU TTC pour ne pas migrer un champ nouveau uniquement pour un client.
3. **Grille tarifaire ≠ ligne d'option** : deux besoins visuellement proches mais sémantiquement distincts. Ne pas mutualiser sans avoir 3 clients qui demandent la même chose.

---

## SESSION 03/07/2026 — Responsive mobile (Fable 5 overnight + fixes manuels)

### Contexte

LIAVO n'était pas utilisable sur mobile — la sidebar hébergeur (220px fixe) écrasait le contenu sur petit écran. Chantier lancé en run overnight Fable 5 sur branche `responsive-mobile`, puis 2 fixes manuels, puis merge fast-forward dans main et déploiement prod.

### Run overnight Fable 5 (6 commits, 16 fichiers, +690/−13)

- **Phase 1** : HebergeurSidebar convertie en drawer overlay mobile (< md). Fixed + translate-x, backdrop cliquable, fermeture auto au clic lien, top-bar mobile hamburger+logo dans HebergeurShell. Desktop (>= md) strictement inchangé (sticky 220px). Débloque les 33 pages hébergeur d'un coup.
- **Phase 2** : Dashboard hébergeur — déjà responsive, rien touché.
- **Phase 3** : Planning hébergeur — vue mois par défaut sur mobile (matchMedia, `?view=` prime toujours), toolbar empilée, vues jour/semaine en scroll horizontal (min-w-[640px]).
- **Phase 4** : Sweep ~60 pages. 3 casses corrigées : onglets séjour collaboratif clippés (overflow-x-auto ajouté), KPI pilotage écrasés (grid-cols-2), libellés étapes appel-offres débordants.
- Auth locale impossible (mot de passe Sauvageon obsolète dans les docs, register hébergeur = compteValide=false). Vérification via auth simulée (puppeteer + localStorage mocké + interception API, zéro requête prod).

### Fix manuel 1 — TabPlanning séjour (commit 834cc93)

Le panneau catalogue/parking (`w-64 shrink-0`) écrasait la grille planning sur mobile. Fix : `hidden md:block` — panneau masqué < md, grille pleine largeur. Desktop inchangé. @dnd-kit refs subsistent (display:none, pas unmount).

### Fix manuel 2 — Landing nav mobile (commit ad6cd41, appliqué via MCP filesystem)

Le bouton « Se connecter » (`.btn-ghost`) était masqué par une media query CSS (max-width:880px). Fix : suppression du display:none sur `.btn-ghost`, compactage des CTA nav (gap 6px, padding réduit, flèche masquée). Les deux boutons tiennent sur mobile. Bug pré-existant (landing.css du 07/05), pas une régression Fable 5.

### Merge et déploiement

- SHA main avant merge (rollback) : `896ff42` — tag local `pre-responsive-2026-07-03`
- SHA après merge : `ad6cd41` (fast-forward propre, aucun conflit)
- Gates : `tsc --noEmit` ✅ + `npm run build` ✅
- Déployé en prod via push origin main

### Vérification

- Vérifié sur vrai téléphone (Pixel, tunnel Cloudflare HTTPS → next dev local) avec compte Sauvageon (données réelles) : drawer, dashboard, planning hébergeur global, planning séjour, liste séjours. Tout OK.
- Pages admin/réseau/organisateur/signataire : touchées par le sweep mais non vérifiées avec données réelles. Risque faible (quasi-vide, pas de client payant sur ces rôles).
- Risque résiduel : `overflow-hidden` du shell peut clipper des éléments larges data-driven non testés en empty-state.

### Leçons retenues

1. **Fable 5 overnight pour du responsive** : résultat à 80-90%, les 2 fixes manuels étaient des oublis ciblés (panneau latéral, CSS custom landing). Le chrome (drawer) était impeccable du premier coup.
2. **Auth locale impossible en HTTP simple** quand les cookies sont Secure+httpOnly — besoin d'un tunnel HTTPS (Cloudflare) pour tester sur mobile. Le login retourne les tokens dans le body JSON ET pose des cookies httpOnly ; le frontend s'appuie sur les cookies, pas le body.
3. **landing.css est du CSS custom hors Tailwind**, non scopé par les breakpoints Tailwind. Les runs Fable 5 qui ciblent les pages Tailwind ne le voient pas.
4. **RESPONSIVE_TODO.md et scripts puppeteer** (shots.mjs, check-overflow.mjs, mock.mjs, debug-login.mjs) créés par Fable 5 — utiles pour la vérification, réutilisables pour de futurs chantiers responsive.

---

## SESSION 02-03/07/2026 nuit — Refactoring Fable 5 (dette technique 4.1-4.3)

### Contexte

ClaudeCode configuré avec Fable 5 pour 3 runs de refactoring autonomes sur le repo. Objectif : solder les 3 chantiers de dette technique (ROADMAP 4.1, 4.2, 4.3) en une nuit, sans toucher à la logique métier ni au backend.

### Run 1 — Modules devis partagés (branche feat/fable5-test-nuit, LIVRÉ)

6 commits. Extraction logique dupliquée entre 3 fichiers frontend de devis (nouveau 41KB + modifier 37KB + TabDevisFacturation 121KB) → 3 modules partagés :
- `frontend/src/lib/devis-calculs.ts` (round2, resolvePrixCatalogueTTC, mapLignesForApi, formatMontant)
- `frontend/src/hooks/useDevisLignes.ts` (hook state lignes + handlers + calculs)
- `frontend/src/components/DevisEditor.tsx` (JSX partagé grille/slider/totaux)

Bilan : 6 fichiers touchés, 949 insertions, 982 suppressions, delta net -33 lignes.

### Run 2 — Découpage page séjour (branche feat/fable5-test-nuit, LIVRÉ)

10 commits. `sejour/[id]/page.tsx` passé de 194KB (3681 lignes) à 505 lignes puis 20KB après Run 3 (-86%). 9 composants extraits dans `_components/` : TabMessages, TabPlanning (avec DnD @dnd-kit), TabGroupes, TabDocuments, TabBudget, TabProjetPedagogique, TabJournal, TabParticipantsCollab, InviteOrganisateurCard.

### Run 3 — DashboardShell unification (branche feat/dashboard-shell-unification, LIVRÉ)

11 commits. Centralisation du chrome (sidebar hébergeur OU topbar) dans `dashboard/layout.tsx`.

**Fichiers créés** :
- `dashboard/_components/HebergeurShell.tsx` — extrait de hebergeur/layout.tsx (sidebar + useHebergeurCounts + usePermissions + PlanInsufficientModal)
- `dashboard/_components/TopBarShell.tsx` — fusion des 4 navbars inline (organisateur/signataire/admin/réseau) + badge rôle du DashboardShell. ROLE_PROFILE_PATH pour lien profil organisateur
- `docs/INVENTAIRE_DASHBOARD_SHELLS.md` — inventaire exhaustif avant unification

**Fichiers modifiés** :
- `dashboard/layout.tsx` — routeur HEBERGEUR → HebergeurShell / reste → TopBarShell + Footer mutualisé
- `hebergeur/layout.tsx` — auth guard conservé (seul redirect /login des pages hébergeur), chrome supprimé
- `sejour/[id]/page.tsx` — HebergeurSidebar/isHebergeur/usePermissions supprimés (le layout fournit le shell)
- `organisateur/page.tsx`, `signataire/page.tsx`, `admin/page.tsx`, `reseau/page.tsx` — navbars inline supprimées

**Fichier supprimé** : `_components/DashboardShell.tsx`

**Écarts délibérés par rapport au plan** :
1. hebergeur/layout.tsx n’est pas un passthrough pur : auth guard conservé (seul redirect /login de toutes les pages hébergeur)
2. Lien profil organisateur conservé via ROLE_PROFILE_PATH dans TopBarShell

**Suivi** : double bandeau sous-pages organisateur/admin (TopBarShell + nav locale breadcrumb). Chantier de suivi 4.5.

### Fix post-Run 3 (commit 4958489)

1. **Bug hooks React** : `organisateur/page.tsx` — `useSearchParams()` appelé après early return conditionnel (violation règles hooks). Remonté avant le early return.
2. **min-h-screen dupliqué** : TopBarShell fournit `min-h-screen bg-gray-50`, les 4 pages racines (organisateur, signataire, admin, réseau) le dupliquaient → 4rem de scroll en trop. Retiré des 4 pages.

### Tests visuels validés
- Admin : TopBarShell + onglets fonctionnels ✅
- Parent (page courte) : footer collé en bas, zéro scroll ✅
- Hébergeur Sauvageon : sidebar intacte, dashboard + page séjour OK ✅

### Branches
- `feat/fable5-test-nuit` : Runs 1+2 (16 commits) — à merger via PR
- `feat/dashboard-shell-unification` : Run 3 + fix (12 commits) — à merger via PR

### Leçons retenues
1. **Fable 5 pour le refactoring structurel pur** : 3 runs autonomes en une nuit, zéro intervention humaine pendant l’exécution, build vert à chaque étape. Idéal pour de l’extraction/déplacement de code sans logique métier.
2. **Écarts conservateurs = bon jugement** : les 2 déviations du Run 3 (auth guard hebergeur, lien profil organisateur) étaient les bons choix. Le prompt autorisait ces écarts avec justification.
3. **Fix post-run nécessaire** : même avec build vert, l’audit humain a révélé un bug hooks préexistant (pas introduit par le run) et un micro-bug CSS (scroll 4rem en trop). L’agent ne les voit pas parce qu’ils ne cassent pas tsc/build.
4. **Pages parent/autorite = scaffolding mort** : découvert pendant les tests visuels. Aucune fonctionnalité, aucun guard de rôle. Le modèle LIAVO actuel ne prévoit pas de dashboard connecté pour ces rôles.

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

### Responsive mobile — LIVRÉ
Dashboard hébergeur, planning, pages publiques, ~60 pages sweep. Drawer overlay mobile < 768px, desktop inchangé. Vérifié sur vrai téléphone avec données réelles (hébergeur Sauvageon).

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
- [x] ~~Modules devis partagés~~ (Run 1 Fable 5 — 3 modules extraits, logique commune mutualisée)
- [x] ~~Découper sejour/[id]/page.tsx~~ (Run 2 Fable 5 — 194KB → 20KB, 9 composants)
- [x] ~~DashboardShell unification~~ (Run 3 Fable 5 — HebergeurShell + TopBarShell)
- [x] ~~Responsive mobile~~ (Fable 5 overnight + 2 fixes manuels, 8 commits, déployé 03/07)
- [ ] Merge complet 3 DevisBuilder → 1 paramétrique (prochaine modif devis)
- [ ] Double bandeau sous-pages organisateur/admin (chantier 4.5)
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
