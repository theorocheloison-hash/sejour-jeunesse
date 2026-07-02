# Refactor responsive mobile — suivi

Branche : `responsive-mobile` (locale, jamais poussée). Breakpoint de bascule : `md` (768px).

## Phase 0 — Setup & auth (résultats)

**Outillage** : puppeteer en devDependency + `frontend/scripts/shots.mjs`
(`node scripts/shots.mjs /chemin` → PNG 375/768/1440 dans `frontend/screenshots/`, gitignoré).

**Test d'auth locale : ÉCHEC — identifiants documentés invalides.**
- Le proxy `/api/*` → `api.liavo.fr` fonctionne en local (le POST login atteint la prod et répond proprement).
- `resa@lesauvageon.com` / `Test1234!` (documenté dans LIAVO_STATUS.md et LIAVO_COMMERCIAL.md) → **401 « Identifiants invalides »** (rejet avant les gates email/validation ⇒ le mot de passe documenté est obsolète). Aucune autre variante essayée (compte prod), aucun autre compte utilisé.
- **Compte de test hébergeur : volontairement NON créé.** Le register hébergeur crée un compte `compteValide=false` → connexion impossible sans validation admin (vu dans `auth.service.ts`). Créer le compte aurait été une écriture prod inutile (+ email de notification à l'admin) sans jamais permettre le login. Aucun identifiant de test à noter donc.

**Plan B utilisé — auth simulée (`MOCK_ROLE=HEBERGEUR node scripts/shots.mjs …`)** :
profil injecté dans localStorage + interception puppeteer de toutes les requêtes `/api/*`
avec une réponse locale `200 []` → **aucune requête ne part vers la prod**, zéro risque
d'écriture. Permet de vérifier visuellement le chrome (sidebar/drawer/topbar), les états
vides et la mise en page — mais PAS les données réelles.

**Limites de vérification (assumées)** :
- Planning DENSE (séjours réels qui se chevauchent) : non vérifiable sans le vrai login Sauvageon → vérifié uniquement avec grille vide + lecture du code.
- Pages dont le rendu dépend fortement des données (cartes séjours remplies, tables pleines) : vérifiées en état vide uniquement.
- ⚠️ Même si un login Sauvageon redevient possible : ne JAMAIS visiter `/dashboard/sejour/[id]` avec ce compte — la page déclenche automatiquement `marquerVisite` (POST) pour un hébergeur.

## Statut des pages

| Page | Statut | Notes |
|---|---|---|
| (en cours — rempli au fil des phases) | | |
