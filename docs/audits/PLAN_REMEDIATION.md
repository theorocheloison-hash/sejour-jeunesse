# PLAN DE REMÉDIATION SÉCURITÉ — LIAVO

> **Rédigé le 15/06/2026** — basé sur l'audit `docs/audits/AUDIT_SECURITE_2026-06.md` (Sections A→E) et `docs/audits/REMEDIATION_IDOR_ANALYSE.md`.
> **Dernière MAJ : 19/06/2026** — LOTs 0→3 implémentés et déployés en prod.
> **Méthode** : chaque lot = un ou plusieurs prompts CC dédiés. Backend et frontend séparés. `tsc --noEmit` + `npm run build` = 0 erreurs avant tout commit.

---

## Vue d'ensemble

| Sévérité | Trouvés | Fixé | Reste |
|----------|---------|------|-------|
| CRITIQUE | 6       | 6    | 0     |
| HAUTE    | 10      | 10   | 0     |
| MOYENNE  | 14      | 14   | 0     |
| BASSE    | 4       | 1    | 3     |

**Tous les findings CRITIQUE et HAUTE sont fermés.**

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

## LOT 3 — ✅ DÉPLOYÉ (19/06/2026) — Storage privé (gate dur mineurs)

| # | Finding | Fix | Statut |
|---|---------|-----|--------|
| 3a | **A0** backend | `generateSignedUrl()` + `getKeyFromUrl()` via `@aws-sdk/s3-request-presigner` ; `StorageController` `GET /storage/signed-url` authentifié TTL 15min | ✅ |
| 3a-acl | ACL conditionnelle | `PUBLIC_FOLDERS = {logos, centres}` → public_read. Tout le reste → privé. Dans `upload()` et `uploadBuffer()`. | ✅ |
| 3b | **A0** frontend gate dur | `useSecureUrl` hook + `SecureImage` (openOnClick → URL signée) + `SecureFileLink` + page.tsx : PhotoGrid journal, doc médical, attestation assurance | ✅ |

**Presigning OVH validé en prod** (test curl 19/06).

**⚠️ Fichiers existants** : uploadés avant le 19/06 avec ACL `public_read` objet → toujours accessibles en direct. Script de re-tagging OVH nécessaire (action manuelle H11).

**Call sites frontend restants (priorité basse)** : FacturePdfLink, documents partagés, documents centre.

### Items LOT 3 reportés

| # | Finding | Fix prévu | Effort |
|---|---------|-----------|--------|
| 3c | **A6** token autorisations sans expiration | `tokenExpiresAt` (dateFin + 30j) sur AutorisationParentale | 0,5j |
| 3d | **C3** token accompagnateur sans expiration | Même pattern sur AccompagnateurMission | inclus |
| 3e | **A8** orphelins S3 / pas de purge | `storage.delete()` dans deleteAutorisation + hard-delete séjour | 0,5j |
| 3f | Call sites frontend restants | FacturePdfLink, documents partagés/centre → SecureFileLink | 0,5j |

---

## LOT 4 — ⏳ À FAIRE — Hardening général (~2j)

| # | Finding | Fix | Effort |
|---|---------|-----|--------|
| 4a | **E3** JWT cookie non-httpOnly | Cookie httpOnly+Secure+SameSite=Lax côté serveur + `withCredentials` axios + supprimer js-cookie | 1j |
| 4b | **E1** Helmet / headers de sécurité | `npm i helmet` + config CSP/HSTS/nosniff/Referrer-Policy dans `main.ts` | 0,5j |
| 4c | **E4** CORS cleanup | Retirer origines Railway/obsolètes, contraindre CORS_ORIGIN | 15min |
| 4d | **B5** login user enumeration | Messages génériques avant auth réussie | 0,25j |
| 4e | **D5** upload sans limite multer | `limits: { fileSize: 10*1024*1024 }` aux 18 FileInterceptor | 0,25j |
| 4f | **D3** href XSS latent (siteWeb) | Valider protocole (https only) | 15min |

**Dépendance** : 4a dépend de 2a (refresh token — ✅ fait).

---

## LOT 5 — ⏳ À FAIRE — Nettoyage git (~0,5j)

| # | Finding | Fix | Effort |
|---|---------|-----|--------|
| 5a | **D1** IBAN dans l'historique git | `git filter-repo` ou BFG pour purger. Force push. Prévenir Maëva. | 0,5j |
| 5b | **D1** IBAN hardcodé dans contrat-sauvageon.pdf.tsx | Déplacer vers `centre.iban` (déjà en base) | inclus |
| 5c | **.gitignore** `.env.production` | Ajouter au .gitignore | 5min |

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
| 6m | CORS_ORIGIN fallback dans services | `autorisation.service.ts` et `accompagnateur.service.ts` utilisent `process.env.CORS_ORIGIN` comme fallback FRONTEND_URL. CORS_ORIGIN supprimé du code CORS (LOT 4), variable env potentiellement obsolète. Remplacer par `process.env.FRONTEND_URL` uniquement. | Au fil de l'eau |
| 6n | lierCompte token expiration | `accompagnateur.service.ts` `lierCompte()` utilise tokenAcces sans vérifier tokenExpiresAt (ajouté en 3d). Endpoint authentifié (JWT) donc risque faible. Ajouter `assertTokenNotExpired`. | Au fil de l'eau |
| 6o | 3 iframes src=URL OVH privée | `TabDevisFacturation` (2×) + `offres/page.tsx` (1×) affichent un aperçu PDF inline via `<iframe src={documentUrl}>`. SecureFileLink ne couvre pas les iframes. Passer le src par `useSecureUrl`. | Avant H11 si données sensibles |

---

## Checklist hors-code

| # | Action | Statut |
|---|--------|--------|
| H1 | Vérifier listing public bucket OVH | ⏳ |
| H2 | `npm audit` backend + frontend | ⏳ |
| H3 | Vérifier headers sécurité api.liavo.fr | Après LOT 4b |
| H4 | DATABASE_URL `?sslmode=require` | ⏳ |
| H5 | BREVO_API_KEY pas dans frontend Scalingo | ⏳ |
| H6 | SPF/DKIM/DMARC sur liavo.fr | ⏳ |
| H7 | DPA Scalingo/OVH/Brevo | ⏳ |
| H8 | Politique de confidentialité + registre RGPD | ⏳ |
| H9 | Rétention logs Scalingo | ⏳ |
| H10 | Rotation JWT_SECRET | ✅ (29/05/2026) |
| H11 | Script re-tagging ACL fichiers existants OVH | ⏳ NOUVEAU |

---

## Timeline actualisée

```
15/06  LOT 0 ✅
19/06  LOT 1 ✅ (17 IDOR)
19/06  LOT 2 ✅ (auth hardening)
19/06  LOT 3 ✅ (storage privé — gate dur mineurs)
       ────────────────────────────────
RESTE  LOT 3c/3d/3e/3f (tokens + purge + call sites) . ✅ 22/06
       LOT 4 quick wins (Helmet/CORS/multer/enum/XSS) . ✅ 22/06
       LOT 4a (httpOnly cookie) ...................... 1j
       LOT 5a (purge git IBAN) ....................... ✅ 22/06
       LOT 5b (IBAN dynamique contrat PDF) ........... ✅ 22/06
       LOT 5c (.gitignore) ........................... ✅ 22/06
       LOT 6 (maintenance continue) .................. au fil de l'eau
       H11 (re-tagging ACL OVH) ...................... ✅ N/A (0 données sensibles en prod)
```

**Restant estimé : ~1j de dev** (LOT 4a httpOnly cookie) + LOT 6 au fil de l'eau.
