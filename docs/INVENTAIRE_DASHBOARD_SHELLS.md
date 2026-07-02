# Inventaire des layouts/navbars dashboard — avant unification

État des lieux (étape 0 du chantier "dashboard shell unification").
Aucune modification de code dans ce commit.

## Les 3 patterns existants

### 1. `hebergeur/layout.tsx` — vrai layout (sidebar)

- `'use client'`, `useAuth()` + **auth guard** : `router.replace('/login')` si `!user || user.role !== 'HEBERGEUR'`.
- `useHebergeurCounts()` → `centre, demandesCount, rappelsCount, actionsFactCount, sejoursNonLusCount`.
- `usePermissions()` → `perms, permissionsLoading`.
- Structure : `div.flex.min-h-screen.bg-gray-50` > `<HebergeurSidebar …/>` + `div.flex-1.min-w-0.flex.flex-col.overflow-hidden > {children}` + `<PlanInsufficientModal />`.
- ⚠️ **C'est le SEUL auth guard des pages hébergeur** : aucune page sous `hebergeur/**` ne fait son propre redirect `/login` (grep vérifié). Le passthrough de l'étape 4 doit conserver ce guard (sans chrome) pour ne pas perdre la redirection.

### 2. `_components/DashboardShell.tsx` — topbar simple (parent, autorite)

- `'use client'`, `useAuth()` pour `logout` seulement. Props `{ role, title, children }`.
- Navbar `h-14` : `Logo size="sm"` → lien `ROLE_DASHBOARD_PATH[role]`, badge rôle (`ROLE_LABELS`), bouton « Se déconnecter ». Pas d'initiales ni de nom.
- Fournit `<main class="max-w-7xl … py-10">` + `<h1>{title}</h1>` (à NE PAS reprendre dans TopBarShell).
- Utilisé par `parent/page.tsx` et `autorite/page.tsx` (server components avec check cookie `token` + `redirect('/login')`).

### 3. Navbars inline copy-pastées

| Page | Hauteur | Marque | Identité utilisateur | Badge rôle | Logout |
|---|---|---|---|---|---|
| `organisateur/page.tsx` | `h-16`, `max-w-7xl` | `<Logo size="sm">` → `/dashboard/organisateur` | Initiales (`firstName[0]+lastName[0]`) + nom + `organisation?.nom ?? 'Organisateur'`, **le tout dans un `<Link>` vers `/dashboard/organisateur/profil`** | non | « Se déconnecter » |
| `signataire/page.tsx` | `h-16`, `max-w-7xl` | `<Logo size="sm">` → `/dashboard/signataire` | Initiales + nom + `organisation?.nom ?? 'Signataire'` (pas de lien profil) | non | « Se déconnecter » |
| `admin/page.tsx` | `h-14`, `max-w-6xl` | texte `Liavo` + `Administration` (pas de composant Logo) | aucune | non | « Déconnexion » |
| `reseau/page.tsx` | `h-14`, `max-w-6xl` | texte `Liavo` + `Espace réseau` | aucune | non | « Déconnexion » |

Le pattern signataire est le plus complet → base du TopBarShell (+ badge rôle du DashboardShell).
Particularité organisateur : le lien vers `/dashboard/organisateur/profil` sur le bloc identité est une fonctionnalité visible → à conserver (map rôle→profil dans TopBarShell, renseignée pour ORGANISATEUR uniquement).

### 4. `sejour/[id]/page.tsx` — sidebar conditionnelle

- Importe `HebergeurSidebar`, `useHebergeurCounts`, `usePermissions` et définit `HebergeurSidebarWithCounts` (fallback `centre` depuis `sejour.hebergementSelectionne`).
- `const isHebergeur = user.role === 'HEBERGEUR'` (ligne ~229) : utilisé UNIQUEMENT pour le wrapper layout (3 usages : className racine, rendu conditionnel de la sidebar, className du conteneur `flex-1`). Aucun usage pour filtrer onglets/boutons (les onglets filtrent sur `user.role === 'HEBERGEUR'` directement).
- `usePermissions` n'est utilisé nulle part ailleurs dans la page.

## Divers relevés pendant l'inventaire

- `dashboard/layout.tsx` actuel : server component, `div.flex.flex-col.min-h-screen > div.flex-1 > {children}` + footer (© LIAVO, mentions légales, CGU, confidentialité, CGV hébergeurs). Le footer est à conserver tel quel, rendu après `{children}` dans chaque shell.
- `organisateur/layout.tsx` et `signataire/layout.tsx` : déjà des passthroughs `<>{children}</>`.
- `hebergeur/pilotage/layout.tsx` : sous-layout à onglets (Pilotage) — NE PAS TOUCHER.
- Type utilisateur : `User` de `@/src/types/auth` (`firstName`, `lastName`, `role`, `organisation?: OrganisationResume | null`) via `useAuth()`.
- ⚠️ Connu / hors périmètre : ~15 sous-pages (organisateur/nouveau-sejour, profil, hebergements, demandes, sejours/[id]/*, documents ; admin/claims, admin/invitations ; toutes les sous-pages hébergeur) ont leur propre `<nav>` local (breadcrumb « ← Tableau de bord », titre, actions). Après l'unification elles afficheront le TopBarShell AU-DESSUS de leur nav locale (double bandeau côté organisateur/admin). Le nettoyage de ces sous-pages n'est pas dans le plan (étape 7 = 4 pages racines uniquement) — chantier de suivi.
- ⚠️ Bug préexistant (non touché) : `organisateur/page.tsx` appelle `useSearchParams()` après un early return conditionnel (violation des règles de hooks) — hors périmètre de ce refactoring.
