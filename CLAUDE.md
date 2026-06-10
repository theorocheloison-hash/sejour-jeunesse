# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

LIAVO — plateforme de coordination de séjours jeunesse (devis, facturation conforme, collaboration organisateur/hébergeur/direction). Monorepo : `backend/` (NestJS 11 / Prisma 7 / PostgreSQL 17) + `frontend/` (Next.js 16 App Router / React 19 / Tailwind 4). Déploiement Scalingo (Paris), stockage OVH Object Storage (S3), emails Brevo.

## Commandes

**Backend** (`cd backend`) :
- `npm run build` — `prisma generate && nest build` (le build régénère TOUJOURS le client Prisma)
- `npm run start:dev` — serveur NestJS en watch (port 4000 par défaut)
- `npx tsc --noEmit` — typecheck seul (le **gate** utilisé avant chaque commit)
- `npm test` — Jest (specs `*.spec.ts` sous `src/`). Un seul test : `npx jest chemin/du/fichier.spec.ts -t "nom du test"`
- `npm run test:e2e` — tests e2e (`test/jest-e2e.json`)
- `npm run seed` — `prisma/seed.ts`
- `npm run lint` — ESLint avec `--fix`

**Frontend** (`cd frontend`) :
- `npm run dev` — Next.js dev (port 3000)
- `npm run build` / `npm run start` / `npm run lint`
- `npx tsc --noEmit` — typecheck seul (**gate** avant commit ; Next n'a pas de script dédié)

Avant tout commit : `npx tsc --noEmit` doit retourner 0 erreur côté backend **et** frontend.

## Conventions critiques (sources d'erreurs si ignorées)

- **Backend ESM** : `tsconfig` en `module: nodenext`. Tous les imports relatifs DOIVENT finir par `.js` (même pour des sources `.ts`) — ex. `import { X } from './x.service.js'`. `jsx: react-jsx` est activé (génération PDF serveur via react-pdf dans `facture/pdf/`).
- **Migrations = SQL manuel uniquement**. NE JAMAIS lancer `prisma migrate dev`. Créer `backend/prisma/migrations/<timestamp>_nom/migration.sql` à la main + éditer `schema.prisma`. Scalingo applique via `prisma migrate deploy` au démarrage (`start:migrate`). Vérifier les données prod avant (`SELECT col, COUNT(*) GROUP BY col`). Modifier une valeur d'enum PostgreSQL = rename enum → create nouveau → `ALTER COLUMN ... USING` (avec `DROP DEFAULT`/`SET DEFAULT` si la colonne a un `@default`) → drop ancien.
- **`ValidationPipe` global** (`whitelist: true, transform: true`, cf. `main.ts`) : tout body de route doit être une **classe DTO avec décorateurs class-validator**, sinon les champs non décorés sont silencieusement supprimés.
- **Prisma via driver adapter** : `PrismaService` utilise `@prisma/adapter-pg` (`PrismaPg` + `DATABASE_URL`).
- **Noms de tables PostgreSQL en snake_case**, différents des modèles Prisma — table de correspondance dans `LIAVO_SESSION_STATE.md` (à lire avant toute requête SQL).
- **git via Claude Code ; ne jamais `git push` sans confirmation explicite de l'utilisateur.**

## Architecture backend

NestJS modulaire (un dossier par domaine sous `backend/src/`, agrégés dans `app.module.ts`). Modules transverses `@Global()` injectables partout sans import : `PrismaModule`, `StorageModule` (OVH `uploadBuffer`), `EmailModule` (Brevo).

**Auth & rôles** : JWT en header `Authorization: Bearer`. Enum `Role` : `ORGANISATEUR | SIGNATAIRE | HEBERGEUR | ADMIN | RESEAU | PARENT | AUTORITE` (`AUTORITE` est legacy). Les contrôleurs protégés font `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.X)`.

**Multi-centre** : un hébergeur peut gérer plusieurs centres. Le centre actif transite par le header `X-Centre-Id` (interceptor frontend depuis `localStorage['liavo-centre-actif']`), résolu côté backend par le décorateur `@CentreId()` + le helper `getCentreForUser(prisma, userId, centreId)` (`centres/centre.helper.ts`).

**Identité** : couche canonique `Organisation` + `Membership` (un user est rattaché via un Membership `isPrimary`). Doc de référence : `docs/ARCHITECTURE_ORGANISATIONS.md`.

## Domaine facturation (central, le plus subtil)

- **`Facture` = entité snapshot immuable** (émise depuis un `Devis`). Le devis **ne mute plus** son `statut`/`typeDocument` à la facturation — il reste `SELECTIONNE`/`SIGNE_DIRECTION`. **Conséquence** : tout affichage d'état de facturation doit DÉRIVER depuis `devis.factures[]` via les helpers de `frontend/src/lib/devis.ts` (`getFactureAcompte`, `getFactureSolde`, `getFactureAvoir`, `etatFacturation`), jamais lire `devis.statut`. Les valeurs `FACTURE_ACOMPTE`/`FACTURE_SOLDE` de l'enum `StatutDevis` sont du legacy non assigné.
- **Numérotation séquentielle atomique** : `SequenceService` (`sequence/`), upsert transactionnel scopé `(emetteurId, annee, typeDoc)`. Formats `DEV-/FA-/FS-/AV-{annee}-{NNNN}`. `emetteurId = centre.organisationId ?? centre.id`.
- **PDF facture généré côté serveur** (`facture/pdf/` : `FacturePDF.tsx` react-pdf → `generateFacturePdf` → buffer), puis **embarqué en Factur-X EN 16931** (XML CII D22B dans un PDF/A-3 via `facture-x.ts` + `pdf-lib`), uploadé sur OVH → `Facture.pdfUrl`. Génération **fire-and-forget non bloquante** (`generateAndStorePdf`). `getChorusXml()` reste séparé (UBL, pour Chorus Pro futur).
- **Avoir** : `typeFacture = 'AVOIR'`, montants négatifs, relation auto-référencée `factureAnnuleeId` (`@unique`).

## Domaine séjour

- **Deux modes** : COLLAB (devis lié via `DemandeDevis` → `devis.demandeId`) et DIRECT (`devis.sejourDirectId`, infos client portées par le `Sejour`). De nombreuses requêtes doivent couvrir les DEUX : `where: { OR: [{ demande: { sejourId } }, { sejourDirectId: sejourId }] }`.
- **`StatutSejour`** : `DRAFT | OPTION | SUBMITTED | CONVENTION | SIGNE_DIRECTION | SOUMIS_RECTORAT | DECLARE_TAM` (`APPROVED`/`REJECTED` supprimés).
- **`typeContexte`** : `SCOLAIRE | HORS_SCOLAIRE`. Le hors-scolaire (ACM) déclenche le parcours TAM (PDF de préparation déclaration accueils de mineurs, `PreparationTamPDFButton`).

## Frontend (Next.js App Router)

- Logique d'accès API centralisée dans `frontend/src/lib/*.ts` (`api.ts` = client axios : `baseURL` = `NEXT_PUBLIC_API_URL`, JWT depuis cookie `token`, header `X-Centre-Id` depuis localStorage). Le métier vit dans `devis.ts`, `sejour.ts`, `clients.ts`, `collaboration.ts`, `accompagnateur.ts`.
- Composants PDF client-side dans `src/components/pdf/` (import dynamique de `@react-pdf/renderer`). Composants PDF serveur (factures) côté backend dans `facture/pdf/`.
- Pages séjour : `app/dashboard/sejour/[id]/` (gros fichier `page.tsx` + `_components/` extraits comme `SejourHeader`, `TabDevisFacturation`, `TabNotes`).
- Charte : primaire `#1B4060`, accent `#C87D2E`, police Inter uniquement.

## Documents de référence du projet

- `LIAVO_STATUS.md` — état projet, infra, roadmap, chantiers livrés (mis à jour à chaque session).
- `LIAVO_SESSION_STATE.md` — état session dev : **table de correspondance Prisma↔PostgreSQL**, enums, leçons retenues, prochains chantiers. À lire en début de session.
- `docs/ARCHITECTURE_*.md` — décisions d'architecture (organisations, multi-centre, séjour direct, UX séjour).
