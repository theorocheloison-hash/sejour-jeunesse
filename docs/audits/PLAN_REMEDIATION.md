# PLAN DE REMÉDIATION SÉCURITÉ — LIAVO

> **Rédigé le 15/06/2026** — basé sur l'audit `docs/audits/AUDIT_SECURITE_2026-06.md` (Sections A→E) et `docs/audits/REMEDIATION_IDOR_ANALYSE.md`.
> **Dernière MAJ : 30/06/2026** — LOTs 0→5 complets. LOT 6 code complet (6a/6b/6g/6j/6k/6l/6m/6n/6i). Checklist hors-code H1-H9 fermée. Reste LOT 6 maintenance (6c/6d/6e/6f/6h/6o).
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
LOT 6 code complet. Checklist hors-code H1-H9 fermée. Reste LOT 6 maintenance (au fil de l'eau, non bloquant).

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

---

## LOT 2 — ✅ DÉPLOYÉ (19/06/2026) — Auth hardening

| # | Finding | Fix | Statut |
|---|---------|-----|--------|
| 2a | **B1** JWT 7j sans révocation | JWT 1h + refresh token rotatif 30j + tokenVersion | ✅ |
| 2b | **B2** set-password sans ré-auth | Exige ancien MDP si motDePasseDefini:true | ✅ |
| 2c | **B8** registerSignataire org | Membership si invitationToken valide ∧ organisationId concordant | ✅ |
| 2d | **B3** magic link TTL + compteValide | TTL 30min, consommerMagicLink ne lève que emailVerifie | ✅ |
| 2e | **B7** bcrypt 10 vs 12 | bcrypt 12 + incrémente tokenVersion | ✅ |

---

## LOT 3 — ✅ DÉPLOYÉ (19-22/06/2026) — Storage privé

| # | Finding | Fix | Statut |
|---|---------|-----|--------|
| 3a | **A0** backend | generateSignedUrl() + StorageController GET /storage/signed-url | ✅ 19/06 |
| 3a-acl | ACL conditionnelle | PUBLIC_FOLDERS = {logos, centres}, reste = privé | ✅ 19/06 |
| 3b | **A0** frontend | useSecureUrl + SecureImage + SecureFileLink | ✅ 19/06 |
| 3c | **A6** token autorisations | tokenExpiresAt (dateFin + 30j) | ✅ 22/06 |
| 3d | **C3** token accompagnateur | Même pattern | ✅ 22/06 |
| 3e | **A8** orphelins S3 | storage.delete() dans deleteAutorisation + hard-delete séjour | ✅ 22/06 |
| 3f | Call sites frontend | 15 call sites migrés vers SecureFileLink | ✅ 22/06 |

---

## LOT 4 — ✅ COMPLET (22-23/06/2026)

| # | Finding | Fix | Statut |
|---|---------|-----|--------|
| 4b | **E1** Helmet | HSTS, nosniff, Referrer-Policy | ✅ |
| 4c | **E4** CORS cleanup | Retrait origines obsolètes | ✅ |
| 4d | **B5** login enumeration | Dummy bcrypt + messages génériques | ✅ |
| 4e | **D5** upload sans limite | fileSize 10MB sur 11 FileInterceptor | ✅ |
| 4f | **D3** href XSS | Sanitization protocole https only | ✅ |
| 4a | Cookies httpOnly | Phase 1 (backend dual extractor) + Phase 2 (frontend proxy rewrite) + Phase 3 (setAuthCookies centres/collaborateurs) | ✅ |

---

## LOT 5 — ✅ DÉPLOYÉ (22/06/2026)

| # | Finding | Fix | Statut |
|---|---------|-----|--------|
| 5a | **D1** IBAN dans git | git filter-repo purge + force push | ✅ |
| 5b | **D1** IBAN hardcodé | Migré vers centre.iban dynamique | ✅ |
| 5c | .gitignore .env.production | Ajouté | ✅ |

---

## LOT 6 — Code complet / Maintenance au fil de l'eau

| # | Finding | Fix | Statut |
|---|---------|-----|--------|
| 6a | **D7** logs sensibles | tokenAcces/email → this.logger sans données sensibles | ✅ 30/06 |
| 6b | **D8** injection HTML emails | escapeHtml() 49 occurrences (19 méthodes + emailLayout) | ✅ 30/06 |
| 6c | **A7** journal-public cross-famille | Décision produit : filtrer par enfant ou consentement | Politique RGPD |
| 6d | **A9** injection formule CSV | Sanitize à l'export | Quand feature arrive |
| 6e | **A10** omit global Prisma | omit motDePasse/tokens dans PrismaService | Défense en profondeur |
| 6f | **D4** SSRF PDF logoUrl | Allowlist domaine OVH | Défense en profondeur |
| 6g | **D6** filtre d'exception global | AllExceptionsFilter (500 générique, HttpException inchangées) | ✅ 30/06 |
| 6h | **E5** /api/contact rate limit | Route n'existe pas encore — N/A, à implémenter quand page contact créée | N/A |
| 6i | **E7** npm audit | Migration @getbrevo/brevo + npm audit fix (0 critical) | ✅ 30/06 |
| 6j | **C2** ordre-mission-pdf IDOR | Ownership check ORGANISATEUR/SIGNATAIRE dans getOrdreMissionHtml | ✅ 30/06 |
| 6k | **C4** /public/centres expose PENDING | searchPublic + getPublic filtrent statut ACTIVE | ✅ 30/06 |
| 6l | **C5** /public/demande body:any | DTO class-validator 38 champs (types, bornes, MaxLength, UUID, DateString) | ✅ 30/06 |
| 6m | CORS_ORIGIN fallback | FRONTEND_URL uniquement | ✅ 30/06 |
| 6n | lierCompte token expiration | assertTokenNotExpired | ✅ 30/06 |
| 6o | 3 iframes src=URL privée | Passer src par useSecureUrl | Avant données sensibles en prod |

---

## Checklist hors-code — ✅ COMPLÈTE

| # | Action | Statut |
|---|--------|--------|
| H1 | Listing public bucket OVH | ✅ 30/06 — AccessDenied confirmé |
| H2 | npm audit frontend | ✅ 30/06 — 0 vulnérabilité |
| H3 | Headers sécurité api.liavo.fr | ✅ 30/06 — Helmet complet (HSTS, nosniff, SAMEORIGIN, CSP, etc.) |
| H4 | DATABASE_URL sslmode | ✅ 30/06 — sslmode=prefer (SSL actif Scalingo) |
| H5 | Clés sensibles pas dans frontend | ✅ 30/06 — 2 vars seulement (NEXT_PUBLIC_API_URL, PROJECT_DIR) |
| H6 | SPF/DKIM/DMARC | ✅ 30/06 — SPF include:spf.brevo.com, DKIM brevo1/brevo2, DMARC p=none |
| H7 | DPA Scalingo/OVH/Brevo | ✅ 30/06 — 3 DPA archivés docs/juridique/ (Scalingo CGV v2.5.0, Brevo CGU, OVH Annexe données perso) |
| H8 | Politique de confidentialité | ✅ 30/06 — Page /legal/confidentialite complète + redirect /politique-confidentialite + Mollie ajouté + IBAN corrigé |
| H9 | Rétention logs Scalingo | ✅ 30/06 — 72h par défaut + événements critiques en base (ActiviteClient, FactureLiavo) |
| H10 | Rotation JWT_SECRET | ✅ 29/05/2026 |
| H11 | Re-tagging ACL fichiers existants | N/A — 0 données sensibles en prod (vérifié 22/06) |

---

## Améliorations identifiées (non-bloquantes)

| # | Action | Priorité |
|---|--------|----------|
| A1 | Footer liens légaux dans DashboardShell (CGU/CGV/Confidentialité accessibles depuis dashboard connecté) | UX — avant démarchage |
| A2 | DMARC p=none → p=quarantine (quand délivrabilité Brevo validée via rapports) | Email — moyen terme |
| A3 | Chiffrement IBAN en base (pgcrypto ou AES applicatif) — actuellement plain text VarChar(34) | Dette technique — moyen terme |
| A4 | Cron automatisé alertes expiration (NestJS @Cron ou Scalingo scheduler) | Opérationnel — avant 2e client trial |
| A5 | Registre des traitements RGPD (document interne CNIL) | Conformité — moyen terme |

---

## Timeline actualisée

```
15/06  LOT 0 ✅
19/06  LOT 1 ✅ (17 IDOR)
19/06  LOT 2 ✅ (auth hardening)
19/06  LOT 3a/3b ✅ (storage privé)
22/06  LOT 3c-3f ✅ (tokens + cleanup + 15 call sites)
22/06  LOT 4 ✅ (Helmet/CORS/enum/multer/XSS)
23/06  LOT 4a ✅ (cookies httpOnly — 3 phases)
22/06  LOT 5 ✅ (purge git IBAN)
30/06  LOT 6 code ✅ (6g/6k/6a/6j/6b/6l/6m/6n/6i — 9 items)
30/06  Checklist hors-code H1-H9 ✅ (bucket, env, headers, SSL, DNS, DPA, confidentialité, logs)
       ────────────────────────────────────────────────────────
RESTE  LOT 6 maintenance : 6c/6d/6e/6f/6o ............. au fil de l'eau
       6h ............................................... quand page contact existe
       Améliorations A1-A5 ............................. au fil de l'eau
```

**Remédiation sécurité terminée. Prêt pour démarchage commercial.**
