# PLAN DE REMÉDIATION SÉCURITÉ — LIAVO

> **Rédigé le 15/06/2026** — basé sur l'audit `docs/audits/AUDIT_SECURITE_2026-06.md` (Sections A→E) et `docs/audits/REMEDIATION_IDOR_ANALYSE.md`.
> **Dernière MAJ : 25/06/2026** — LOTs 0→5 complets. LOT 4a complet (3 phases). Migration httpOnly cookies terminée. Aucun changement depuis 23/06.
> **Méthode** : chaque lot = un ou plusieurs prompts CC dédiés. Backend et frontend séparés. `tsc --noEmit` + `npm run build` = 0 erreurs avant tout commit.

---

## Vue d'ensemble

| Sévérité | Trouvés | Fixé | Reste |
|----------|---------|------|-------|
| CRITIQUE | 6       | 6    | 0     |
| HAUTE    | 10      | 10   | 0     |
| MOYENNE  | 14      | 14   | 0     |
| BASSE    | 4       | 4    | 0     |

**Tous les findings CRITIQUE, HAUTE, MOYENNE et BASSE sont fermés.**
LOT 4a (cookies httpOnly — 3 phases) terminé. Reste : LOT 6 maintenance continue.

---

## LOT 0 — ✅ DÉPLOYÉ (15/06/2026)

| # | Finding | Fix | Statut |
|---|---------|-----|--------|
| 0a | **E2** trust proxy | `app.set('trust proxy', 1)` dans `main.ts` | ✅ |
| 0b | **B4** throttle reset-password/verify-email | `@Throttle` sur les 2 routes | ✅ |
| B0 | Anonyme → ADMIN via register | Champ `role` retiré de `RegisterDto` | ✅ |

---

## LOT 1 — ✅ DÉPLOYÉ (19/06/2026) — IDOR ownership

**17 sites IDOR fermés en 3 prompts CC + 1 cleanup.**

Fichiers clés :
- `backend/src/auth/ownership.helper.ts` — NOUVEAU, 5 fonctions (isSignataireLinkedToSejour, assertSignataireCanAccessSejour, assertSignataireCanAccessDemande, assertHebergeurCanAccessDemande, getSignataireSejourIds)
- `collaboration.service.ts` — verifyAccess conditionné à R1 (30 endpoints)
- `sejour.controller.ts` + `sejour.service.ts` — getSejourDetail, getDossierPedagogique, updateStatus
- `accompagnateur.controller.ts` + `accompagnateur.service.ts` — getBySejour ownership + retrait tokenAcces du select
- `demande.controller.ts` + `demande.service.ts` — findOne ownership ORG/SIG/HEB, getComparatif R2 + retrait iban
- `devis.controller.ts` + `devis.service.ts` — 6 endpoints sécurisés (N1-N3, N5-N7)
- `facture.controller.ts` + `facture.service.ts` — assertFactureOwnership + 6 endpoints sécurisés (N8-N11 + versements)

| Site | Statut | Site | Statut |
|------|--------|------|--------|
| A1 verifyAccess (30 callers) | ✅ | N5 getDevisAValider | ✅ |
| A2 getSejourDetail | ✅ | N6 getFacturesAcompte | ✅ |
| A3 getDossierPedagogique | ✅ | N7 getDemandeInfo | ✅ |
| A4 demande.findOne | ✅ | N8 getFacturesForDevis | ✅ |
| A5 getComparatif | ✅ | N9 validerAcompte | ✅ |
| N1 getDevisForDemande | ✅ | N10 getChorusXml | ✅ |
| N2 updateStatut | ✅ | N11 downloadPdf | ✅ |
| N3 signerDevis | ✅ | C1 getBySejour accomp | ✅ |
| N4 updateStatus séjour | ✅ | Q6 versements SIG | ✅ |

**Bonus** : `notifierHebergeur()` dans collaboration.service.ts (symétrique de notifierOrganisateur).

---

## LOT 2 — ✅ DÉPLOYÉ (19/06/2026) — Auth hardening

| # | Finding | Fix | Statut |
|---|---------|-----|--------|
| 2a | **B1** JWT 7j sans révocation | JWT 1h + refresh token rotatif 30j + `tokenVersion` en base + check `compteValide` HEBERGEUR dans `validate()` + `POST /auth/refresh` (throttle 10/min) | ✅ |
| 2a-front | Interceptor refresh | `api.ts` interceptor 401→refresh→retry avec queue anti-boucle + `AuthContext.tsx` stockage refresh + `callback/page.tsx` lecture refreshToken hash | ✅ |
| 2b | **B2** set-password sans ré-auth | `definirMotDePasse` exige ancien MDP si `motDePasseDefini:true`, bcrypt 12, incrémente tokenVersion | ✅ |
| 2c | **B8** registerSignataire org | Membership uniquement si invitationToken valide ∧ organisationId concordant | ✅ |
| 2d | **B3** magic link TTL + compteValide | TTL 30min (genererMagicUrl + devis.service inline) ; consommerMagicLink ne lève que `emailVerifie` | ✅ |
| 2e | **B7** bcrypt 10 vs 12 | reinitialiserMotDePasse bcrypt 12 + incrémente tokenVersion | ✅ |

Migration SQL : `token_version INTEGER NOT NULL DEFAULT 0`, `refresh_token UUID`, `refresh_token_expires TIMESTAMP` sur `utilisateurs`.

---

## LOT 3 — ✅ DÉPLOYÉ (19-22/06/2026) — Storage privé (gate dur mineurs)

| # | Finding | Fix | Statut |
|---|---------|-----|--------|
| 3a | **A0** backend | `generateSignedUrl()` + `getKeyFromUrl()` via `@aws-sdk/s3-request-presigner` ; `StorageController` `GET /storage/signed-url` authentifié TTL 15min | ✅ 19/06 |
| 3a-acl | ACL conditionnelle | `PUBLIC_FOLDERS = {logos, centres}` → public_read. Tout le reste → privé. Dans `upload()` et `uploadBuffer()`. | ✅ 19/06 |
| 3b | **A0** frontend gate dur | `useSecureUrl` hook + `SecureImage` (openOnClick → URL signée) + `SecureFileLink` + page.tsx : PhotoGrid journal, doc médical, attestation assurance | ✅ 19/06 |
| 3c | **A6** token autorisations sans expiration | `tokenExpiresAt` (dateFin + 30j) sur AutorisationParentale | ✅ 22/06 |
| 3d | **C3** token accompagnateur sans expiration | Même pattern sur AccompagnateurMission | ✅ 22/06 |
| 3e | **A8** orphelins S3 / pas de purge | `storage.delete()` dans deleteAutorisation + hard-delete séjour (fire-and-forget) | ✅ 22/06 |
| 3f | Call sites frontend restants | FacturePdfLink, documents partagés/centre → SecureFileLink. **15 call sites migrés.** | ✅ 22/06 |

**Presigning OVH validé en prod** (test curl 19/06).

**⚠️ Fichiers existants** : uploadés avant le 19/06 avec ACL `public_read` objet → toujours accessibles en direct. Aucune donnée sensible en prod actuellement (vérifié 22/06), H11 classé N/A.

---

## LOT 4 — ✅ COMPLET

### Quick wins — ✅ DÉPLOYÉ (22/06/2026, commit 5d97896)

| # | Finding | Fix | Statut |
|---|---------|-----|--------|
| 4b | **E1** Helmet / headers sécurité | `helmet()` avec HSTS, nosniff, Referrer-Policy dans `main.ts` | ✅ |
| 4c | **E4** CORS cleanup | Retrait origines Railway/obsolètes, CORS_ORIGIN nettoyé | ✅ |
| 4d | **B5** login user enumeration | Dummy bcrypt + messages génériques, suppression gate COMPTE_DORMANT | ✅ |
| 4e | **D5** upload sans limite multer | `limits: { fileSize: 10*1024*1024 }` sur 11 FileInterceptor | ✅ |
| 4f | **D3** href XSS latent (siteWeb) | Sanitization protocole (https only) | ✅ |

### 4a — Cookie httpOnly — ✅ COMPLET (22-23/06/2026)

**Phase 1 backend ✅ DÉPLOYÉ (22/06/2026, commit a947f2e) :**
- `cookie-parser` installé
- `cookieThenBearerExtractor` dans jwt.strategy.ts (cookie httpOnly d'abord → fallback Authorization header)
- `setAuthCookies()` dans auth.controller.ts : login, register, refresh posent cookies httpOnly + retournent tokens dans body (backward compat)
- `POST /auth/logout` clearCookie

**Phase 3 backend ✅ DÉPLOYÉ (23/06/2026, commit 391291f) :**
- `auth-cookies.ts` : helper partagé `setAuthCookies()` + constantes `COOKIE_OPTS_ACCESS` / `COOKIE_OPTS_REFRESH` + `isProduction`. Source unique.
- `centres/register` + `collaborateurs/register` : posent cookies httpOnly via `setAuthCookies`. Refresh token rotatif 30j.
- `auth.controller.ts` : imports centralisés depuis `auth-cookies.ts` (plus de déclarations locales dupliquées).
- Backward compatible : tokens toujours dans le body.

**Phase 2 frontend ✅ DÉPLOYÉ (23/06/2026, commit 28cb4da) :**
- `next.config.ts` : `rewrites()` proxy `/api/:path*` → `api.liavo.fr/:path*` (same-origin, résout axios fetch adapter + cross-origin)
- `src/lib/api.ts` : baseURL `/api`, suppression interceptor Authorization header, refresh `POST /auth/refresh` sans body (cookie auto), queue simplifiée
- `AuthContext.tsx` : suppression js-cookie, session restore via localStorage seul, logout async `api.post('/auth/logout')`
- 7 pages migrées : suppression de tous les `Cookies.set/get/remove`
- Bug fixé : `inscription-hebergement` écrivait `sj_user` au lieu de `sj_user_v2`
- `DashboardShell.tsx` : migré de server action `logoutAction` vers `useAuth().logout()` (cohérent httpOnly)
- Supprimé : `js-cookie` + `@types/js-cookie`, `proxy.ts`, `login/actions.ts`, `dashboard/actions.ts`
- **Résultat : le frontend n'expose plus aucun token côté JavaScript.**

**Note technique (leçon retenue)** : la première tentative Phase 2 (22/06) a échoué car axios 1.13.6 dans Next.js 16.1.6/turbopack utilise le fetch adapter (pas XHR), et `credentials: 'include'` ne fonctionne pas en cross-origin dans ce contexte. La solution structurelle = proxy same-origin via `rewrites()`.

---

## LOT 5 — ✅ DÉPLOYÉ (22/06/2026)

| # | Finding | Fix | Statut |
|---|---------|-----|--------|
| 5a | **D1** IBAN dans l'historique git | `git filter-repo` purge. Force push. | ✅ |
| 5b | **D1** IBAN hardcodé dans contrat-sauvageon.pdf.tsx | Migré vers `centre.iban` (dynamique depuis base) | ✅ |
| 5c | **.gitignore** `.env.production` | Ajouté au .gitignore | ✅ |

---

## LOT 6 — Maintenance continue (BASSE / INFO)

| # | Finding | Fix | Quand |
|---|---------|-----|-------|
| 6a | **D7** logs sensibles | Nettoyer console.log email/accompagnateur | Au fil de l'eau |
| 6b | **D8** injection HTML emails | Échapper le message enseignant | Au fil de l'eau |
| 6c | **A7** journal-public cross-famille | Décision produit : filtrer par enfant ou consentement | Politique RGPD |
| 6d | **A9** injection formule CSV | Sanitize à l'export | Quand feature arrive |
| 6e | **A10** omit global Prisma | omit motDePasse/tokens dans PrismaService | Défense en profondeur |
| 6f | **D4** SSRF PDF logoUrl | Allowlist domaine OVH | Défense en profondeur |
| 6g | **D6** filtre d'exception global | AllExceptionsFilter masquer stack traces | Avant montée en charge |
| 6h | **E5** /api/contact rate limit | Rate limit + CAPTCHA + échapper body | Avant marketing public |
| 6i | **E7** xlsx CVE | `npm audit fix` | Lancer npm audit |
| 6j | **C2** ordre-mission-pdf IDOR | Ownership sur accompagnateur.id | Au fil de l'eau |
| 6k | **C4** /public/centres expose PENDING | Filtrer `statut: 'VALIDE'` | Au fil de l'eau |
| 6l | **C5** /public/demande body:any | DTO typé + CAPTCHA | Avant marketing public |
| 6m | CORS_ORIGIN fallback dans services | Remplacer par `process.env.FRONTEND_URL` uniquement | Au fil de l'eau |
| 6n | lierCompte token expiration | `assertTokenNotExpired` dans `lierCompte()` | Au fil de l'eau |
| 6o | 3 iframes src=URL OVH privée | Passer le src par `useSecureUrl` | Avant données sensibles en prod |
| ~~6p~~ | ~~Phase 3 backend setAuthCookies~~ | ~~centres/register + collaborateurs/register~~ | ✅ 23/06 (commit 391291f) |
| ~~6q~~ | ~~Bug inscription-hebergement sj_user~~ | ~~sj_user → sj_user_v2~~ | ✅ 23/06 (commit 28cb4da) |

---

## Checklist hors-code

| # | Action | Statut |
|---|--------|--------|
| H1 | Vérifier listing public bucket OVH | ⏳ |
| H2 | `npm audit` backend + frontend | ⏳ |
| H3 | Vérifier headers sécurité api.liavo.fr | ⏳ (Helmet déployé, à vérifier via curl/securityheaders.com) |
| H4 | DATABASE_URL `?sslmode=require` | ⏳ |
| H5 | BREVO_API_KEY pas dans frontend Scalingo | ⏳ |
| H6 | SPF/DKIM/DMARC sur liavo.fr | ⏳ |
| H7 | DPA Scalingo/OVH/Brevo | ⏳ |
| H8 | Politique de confidentialité + registre RGPD | ⏳ |
| H9 | Rétention logs Scalingo | ⏳ |
| H10 | Rotation JWT_SECRET | ✅ (29/05/2026) |
| H11 | Script re-tagging ACL fichiers existants OVH | N/A — 0 données sensibles en prod (vérifié 22/06) |

---

## Timeline actualisée

```
15/06  LOT 0 ✅
19/06  LOT 1 ✅ (17 IDOR)
19/06  LOT 2 ✅ (auth hardening)
19/06  LOT 3a/3b ✅ (storage privé — gate dur mineurs)
22/06  LOT 3c/3d/3e ✅ (tokens expiration + storage cleanup)
22/06  LOT 3f ✅ (SecureFileLink — 15 call sites)
22/06  LOT 4 quick wins ✅ (Helmet/CORS/enum/multer/XSS)
22/06  LOT 4a Phase 1 backend ✅ (cookies httpOnly, dual extractor)
23/06  LOT 4a Phase 3 backend ✅ (setAuthCookies centres/collaborateurs/register)
23/06  LOT 4a Phase 2 frontend ✅ (proxy rewrite, suppression js-cookie, migration complète)
22/06  LOT 5 ✅ (purge git IBAN + IBAN dynamique + .gitignore)
       ────────────────────────────────────────────────────────
RESTE  LOT 6 (maintenance continue) ..................... au fil de l'eau
       H1-H9 checklist hors-code ....................... au fil de l'eau
```

**Remédiation sécurité dev terminée.** Reste LOT 6 (maintenance) + checklist hors-code.
