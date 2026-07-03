# Refactor responsive mobile — suivi

> **Statut : LIVRÉ et déployé en prod le 03/07/2026.** Branche responsive-mobile mergée dans main (fast-forward). Ce fichier est conservé comme référence pour les scripts de test et le détail page par page.

Branche : `responsive-mobile` (locale, jamais poussée). Breakpoint de bascule : `md` (768px).

## Phase 0 — Setup & auth (résultats)

**Outillage** (`frontend/scripts/`, hors build) :
- `shots.mjs` — screenshots 375/768/1440 (`node scripts/shots.mjs /chemin`, options `MOCK_ROLE`, `CLICK`, `FULLPAGE`, `WIDTHS`) → PNG dans `frontend/screenshots/` (gitignoré).
- `check-overflow.mjs` — détecte débordement horizontal à 375px + erreurs runtime React par page.
- `mock.mjs` — formes de réponses API simulées partagées.
- `debug-login.mjs` — diagnostic du login local.

**Test d'auth locale : ÉCHEC — identifiants documentés invalides.**
- Le proxy `/api/*` → `api.liavo.fr` fonctionne en local (le POST login atteint la prod et répond proprement).
- `resa@lesauvageon.com` / `Test1234!` (documenté dans LIAVO_STATUS.md et LIAVO_COMMERCIAL.md) → **401 « Identifiants invalides »** (rejet avant les gates email/validation ⇒ le mot de passe documenté est obsolète). Aucune autre variante essayée (compte prod), aucun autre compte utilisé.
- **Compte de test hébergeur : volontairement NON créé.** Le register hébergeur crée un compte `compteValide=false` → connexion impossible sans validation admin (vu dans `auth.service.ts`). Créer le compte aurait été une écriture prod inutile (+ email de notification admin) sans jamais permettre le login. Aucun identifiant de test à noter donc.

**Plan B utilisé — auth simulée (`MOCK_ROLE=HEBERGEUR node scripts/shots.mjs …`)** :
profil injecté dans localStorage + interception puppeteer de toutes les requêtes `/api/*` avec des réponses locales (états vides) → **aucune requête ne part vers la prod**, zéro risque d'écriture. Permet de vérifier le chrome (drawer/topbar), les états vides et la mise en page — PAS les données réelles.

**Limites de vérification (assumées)** :
- **Planning DENSE** (séjours réels qui se chevauchent) : non vérifiable sans login réel → vérifié grille vide + lecture du code (le rendu des pastilles/chevauchements est inchangé, seule la coquille a bougé).
- Pages riches en données (cartes séjours remplies, tables pleines) : vérifiées en état VIDE uniquement. Les tables ont déjà leur wrapper `overflow-x-auto` (admin, réseau) — comportement avec données réelles à confirmer.
- ⚠️ Si un login Sauvageon redevient possible : ne JAMAIS visiter `/dashboard/sejour/[id]` avec ce compte — la page déclenche automatiquement `marquerVisite` (POST) pour un hébergeur.

## Ce qui a été fait (commits sur `responsive-mobile`)

1. `chore: responsive tooling` — puppeteer + scripts + doc auth.
2. `feat: hebergeur sidebar becomes mobile drawer` — **Phase 1** : HebergeurSidebar = drawer overlay < md (translate + backdrop + fermeture au clic lien), sticky 220px inchangée ≥ md ; top-bar mobile hamburger+logo dans HebergeurShell. Vérifié 375 (fermé/ouvert) + 768 + 1440.
3. `feat: planning — mobile month default, stacked toolbar, h-scroll grids` — **Phase 3** : défaut mobile = vue mois (matchMedia 767px, `?view=` prime, persistance URL intacte) ; toolbar empilée < md (recherche pleine largeur, tous les boutons conservés) ; vues jour/5j/semaine : scroll horizontal (`min-w-[640px]` si multi-colonnes, `md:overflow-x-visible` préserve le sticky desktop). Vérifié 375 (mois + semaine) + 1440.
4. `fix: appel-offres step labels + pilotage KPI grids` — **Phase 4** : /appel-offres (seul débordement du sweep, libellés d'étapes nowrap → seul l'actif visible < sm) ; pilotage/ca (KPI `flex` → `grid grid-cols-2 md:flex`, ventilation → `grid-cols-1 sm:grid-cols-3`).
5. `fix: sejour collab tabs scrollable on mobile` — onglets de `/dashboard/sejour/[id]` clippés par l'`overflow-hidden` du shell → `overflow-x-auto` + `shrink-0 whitespace-nowrap`.

**Phase 2 (dashboard hébergeur)** : rien à changer — vérifié à 375, cartes KPI empilées, planning compact 7 colonnes serré mais lisible (conforme consigne).

## Statut des pages (à 375px)

Légende : **OK** = vérifiée visuellement (screenshot) sans modif · **corrigée** = modif + re-vérifiée · **ok (auto)** = passée au détecteur overflow+erreurs, sans inspection visuelle détaillée · **non vérifiée** = injoignable sans données/auth réelles.

| Page | Statut |
|---|---|
| `/` (landing) | OK |
| `/catalogue` | OK (header un peu dense, fonctionnel) |
| `/catalogue/[id]` | non vérifiée (id du listing → « Centre introuvable » ; état d'erreur OK) |
| `/a-propos`, `/login`, `/register`, `/register/*`, `/forgot-password`, `/legal/*` (5) | ok (auto) |
| `/appel-offres` | **corrigée** (étape 1 vérifiée ; étapes 2-5 du formulaire non screenshotées) |
| Pages à token (signature devis, autorisation, rejoindre, journal familles, ordre-mission, invitations, reset/verify) | ok (auto) — états d'erreur seulement, contenu réel non vérifiable sans token valide |
| `/dashboard/hebergeur` | OK (drawer + KPI + planning compact) |
| `/dashboard/hebergeur/planning` | **corrigée** (mois vide + semaine vide vérifiées ; planning dense non vérifiable) |
| `/dashboard/hebergeur/pilotage` + `/ca` | **corrigée** (KPI 2×2, ventilation empilée) |
| `/dashboard/hebergeur/pilotage/rentabilite`, `/comptabilite`, `/equipe` | ok (auto) |
| `/dashboard/hebergeur/sejours` | OK (recherche + chips wrap) |
| `/dashboard/hebergeur/devis` | OK (onglets scrollables — `overflow-x-auto` déjà présent) |
| `/dashboard/hebergeur/devis/nouveau` | ok (auto) |
| `/dashboard/hebergeur/devis/[id]/modifier` | non vérifiée (nécessite un devis réel) |
| `/dashboard/hebergeur/clients`, `/catalogue`, `/profil`, `/documents`, `/parametres/inscription`, `/equipe`, `/abonnement`, `/disponibilites`, `/global`, `/inviter-enseignant`, `/centres/nouveau`, `/demandes` | ok (auto) |
| `/dashboard/sejour/[id]` | **corrigée** (onglets scrollables ; vérifiée avec séjour mocké, onglet Devis vide ; contenu des 10 onglets avec données réelles non vérifié) |
| `/dashboard/organisateur` (+ demandes, hebergements, nouveau-sejour, profil) | OK / ok (auto) |
| `/dashboard/organisateur/sejours/[id]/*`, `/documents/[sejourId]`, `/hebergements/[id]` | non vérifiées (nécessitent des données réelles) |
| `/dashboard/signataire` | OK |
| `/dashboard/admin` (+ claims, invitations) | OK / ok (auto) — tables en `overflow-x-auto` (règle : pas de transformation en cartes) |
| `/dashboard/reseau` | OK |
| `/dashboard/parent`, `/dashboard/autorite` | ok (auto) |

## À trancher avec Théo / reste à faire

1. **Vérification avec données réelles** : planning dense, listes devis/séjours remplies, tables admin pleines, page séjour avec vrais onglets. Bloqué par l'auth (mot de passe Sauvageon obsolète dans les docs). → Mettre à jour le mot de passe documenté, puis repasser `shots.mjs` en `LOGIN_EMAIL/LOGIN_PASSWORD` (lecture seule, éviter `/dashboard/sejour/[id]`).
2. **Formulaire /appel-offres étapes 2-5** (EtapeInfos/Geographie/Recap) : non screenshotées (nécessitent de remplir le formulaire). Composants partagés avec nouveau-sejour (ok auto), risque faible.
3. **Fiche catalogue publique `/catalogue/[id]`** : trouver un id valide et vérifier.
4. **Header du catalogue à 375** : logo + bouton CTA + « Se connecter » un peu tassés (fonctionnel, pas cassé). Amélioration cosmétique possible, non faite (règle : strict minimum).
5. Le compte mocké ne montre que 2 items de menu dans le drawer (artefact du mock de permissions) — avec de vraies permissions, tous les groupes s'affichent ; la structure du drawer est identique.
