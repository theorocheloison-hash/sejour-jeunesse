# PLAN DE REMÉDIATION SÉCURITÉ — LIAVO

> **Rédigé le 15/06/2026** — basé sur l'audit `docs/audits/AUDIT_SECURITE_2026-06.md` (Sections A→E) et `docs/audits/REMEDIATION_IDOR_ANALYSE.md`.
> **Statut** : aucun code modifié (sauf B0, déjà fixé et déployé le 15/06).
> **Méthode** : chaque lot = un prompt CC dédié. Backend et frontend séparés quand le blast radius le justifie. `tsc --noEmit` + `npm run build` = 0 erreurs avant tout commit.

---

## Vue d'ensemble

| Sévérité | Trouvés | Fixé | Reste |
|----------|---------|------|-------|
| CRITIQUE | 6       | 1 (B0) | 5   |
| HAUTE    | 10      | 0    | 10    |
| MOYENNE  | 14      | 0    | 14    |
| BASSE    | 4       | 0    | 4     |

**Findings CRITIQUE restants** : B1 (JWT sans révocation), A1 (IDOR verifyAccess → dossiers médicaux), A2 (IDOR séjour detail), A0 (S3 public_read), D1 (IBAN commités dans git).

---

## Séquencement par deadline

### LOT 0 — Immédiat (< 1h) — Infra, 0 risque de régression

Ces deux fixes ne touchent aucune logique métier, aucun test, aucun frontend. Ils amplifient toutes les protections existantes.

| # | Finding | Fix | Effort | Fichier |
|---|---------|-----|--------|---------|
| 0a | **E2** trust proxy manquant → throttling inopérant | `app.set('trust proxy', 1)` dans `main.ts` | 5 min | `main.ts` |
| 0b | **B4** reset-password/verify-email sans @Throttle | Ajouter `@Throttle` sur les 2 routes | 15 min | `auth.controller.ts` |

**Prompt CC unique. Déploie immédiatement après.**

Pourquoi en premier : E2 neutralise *toutes* les limites de débit (login, register, magic link, public/*). Tant que ce n'est pas fixé, chaque mitigation « throttle 5/min » citée dans l'audit est un mensonge. 5 minutes de travail, impact maximal.

---

### LOT 1 — Avant le 18/06 (démo Marie) — Écritures juridiques + IDOR critique (~1,5j)

**Objectif** : fermer les vecteurs d'attaque les plus graves pour un SIGNATAIRE auto-enregistré. La démo est en rôle RESEAU (confirmé), donc aucun risque de sur-blocage sur la démo elle-même.

**Passe B1-backend — Helper d'ownership + verifyAccess + écritures juridiques**

| # | Finding(s) | Fix | Effort |
|---|------------|-----|--------|
| 1a | **A1** (verifyAccess, 30 callers) | `isSignataireLinkedToSejour()` dans `auth/ownership.helper.ts` + correction ligne 68 de `collaboration.service.ts` | 0,5j |
| 1b | **N3** signerDevis (écriture juridique) | `assertSignataireCanAccessDemande()` dans `devis.service.ts:593` | inclus |
| 1c | **N2** updateStatut devis (refus IDOR) | idem, `devis.service.ts:488` | inclus |
| 1d | **N4** updateStatus séjour | `assertSignataireCanAccessSejour()` dans `sejour.service.ts:903` | inclus |
| 1e | **N9** validerAcompte (écriture financière) | Passer user au controller + ownership dans `facture.service.ts` | inclus |

**Passe B1-suite — IDOR lectures critiques**

| # | Finding(s) | Fix | Effort |
|---|------------|-----|--------|
| 1f | **A2** getSejourDetail | Passer `@CurrentUser()` + `assertSignataireCanAccessSejour()` | 0,25j |
| 1g | **A3** dossier-pedagogique | Branche SIGNATAIRE dans le guard existant | inclus |
| 1h | **A4** demande.findOne | Passer user+centreId, brancher R2 (SIG) + R3 (HEB) | 0,25j |
| 1i | **A5** + **N1** comparatif + getDevisForDemande | Branche SIGNATAIRE + retirer `iban` du select | inclus |
| 1j | **C1** getBySejour accompagnateurs | ownership sur sejourId | 0,25j |

**Dépendances** : le helper `ownership.helper.ts` (1a) est le prérequis de tout le reste. L'analyse exhaustive est déjà faite (Passe A). Les signatures de helper sont validées. Le compte démo est RESEAU → non impacté.

**Décisions prises** :
- Q1 (démo) : RESEAU, pas de risque → fermé
- Q2 (AUTORITE) : 1 user en prod → on lui définit une règle R1-like en lot 1d (pas de retrait du @Roles)
- Q3 (IBAN comparatif) : on retire
- Q4 (N5/N6 scoping) : R1 complet (S1∪S2∪S3)
- Q5 (périmètre) : tout en un lot (le helper rend chaque site trivial une fois posé)

**Vérification post-déploiement** : tester avec un vrai compte SIGNATAIRE que (a) ses séjours restent accessibles, (b) un séjour d'un autre établissement renvoie 403.

---

### LOT 2 — Avant le 25/06 (avant CA LMDJ) — Auth hardening (~2j)

Fermer les vecteurs d'entrée et de persistance. Pas de risque frontend (tout est backend auth).

| # | Finding | Fix | Effort |
|---|---------|-----|--------|
| 2a | **B1** JWT 7j sans révocation | Réduire à 1h + refresh token rotatif + `tokenVersion` en base + check `compteValide` dans `validate()`. Migration SQL manuelle (`token_version INTEGER DEFAULT 0`). | 1j |
| 2b | **B2** set-password sans ré-auth | Exiger ancien MDP si `motDePasseDefini:true` ; restreindre au cas `false` sinon | 0,25j |
| 2c | **B8** registerSignataire org sans invitation | Lier membership à la validation effective de `invitationToken` (transaction) | 0,5j |
| 2d | **B3** magic link TTL 7j + force compteValide | Réduire TTL à 30min ; ne lever que `emailVerifie`, pas `compteValide` (préserver gate admin HEBERGEUR) | 0,25j |
| 2e | **B7** bcrypt 10 vs 12 | Uniformiser rounds=12 partout | 15min |

**Dépendances** : 2a (refresh token) change le contrat d'auth côté frontend (axios interceptor, stockage du refresh token). Prompt CC séparé backend + frontend. 2b/2c/2d/2e sont backend-only.

**Ordre interne** : 2a d'abord (le refresh token conditionne la réduction du TTL JWT), puis 2b→2e en un seul prompt.

---

### LOT 3 — Avant onboarding réel LMDJ (vrais enfants) — Storage privé (~2j)

**Gate dur** : aucune donnée médicale de mineur ne doit transiter sur la plateforme tant que ce lot n'est pas déployé.

| # | Finding | Fix | Effort |
|---|---------|-----|--------|
| 3a | **A0** S3 public_read | Bucket privé OVH + méthode `getSignedUrl()` dans `StorageService` (TTL 15min) + endpoint authentifié `/files/:key` avec ownership check | 1j backend |
| 3b | **A0** frontend | Remplacer tous les `<img src={url}>` / `<a href={url}>` par des appels à l'endpoint signé. Composant `<SecureFile url={...} />`. Audit des ~14 call sites d'upload listés en Section A. | 1j frontend |
| 3c | **A6** token autorisations sans expiration | `tokenExpiresAt` (dateFin séjour + 30j), vérif sur les 3 routes publiques, invalidation post-signature | 0,5j |
| 3d | **C3** token accompagnateur sans expiration | Idem que A6 (même pattern, entité différente) | inclus |
| 3e | **A8** orphelins S3 / pas de purge | `storage.delete()` dans `deleteAutorisation` + hard-delete séjour ; définir durée de rétention | 0,5j |

**Risque de régression** : 3b touche l'affichage de tous les fichiers (logos, PDF, photos, brochures). Tester sur staging ou env de dev avant push main. Ne pas faire pendant la semaine de démo.

**Dépendance** : 3a (backend) avant 3b (frontend). 3c/3d/3e indépendants.

---

### LOT 4 — Avant 30 hébergeurs — Hardening général (~2j)

| # | Finding | Fix | Effort |
|---|---------|-----|--------|
| 4a | **E3** JWT cookie non-httpOnly | Cookie httpOnly+Secure+SameSite=Lax côté serveur + `withCredentials` axios + supprimer js-cookie | 1j |
| 4b | **E1** Helmet / headers de sécurité | `npm i helmet` + config CSP/HSTS/nosniff/Referrer-Policy dans `main.ts` | 0,5j |
| 4c | **E4** CORS cleanup | Retirer origines Railway/obsolètes, contraindre CORS_ORIGIN | 15min |
| 4d | **B5** login user enumeration | Messages génériques avant auth réussie | 0,25j |
| 4e | **D5** upload sans limite multer | Ajouter `limits: { fileSize: 10*1024*1024 }` aux 18 FileInterceptor | 0,25j |
| 4f | **D3** href XSS latent (siteWeb) | Valider protocole (https only) sur siteWeb | 15min |

**Dépendance** : 4a dépend de 2a (refresh token en place, sinon le cookie httpOnly casse le flux magic link actuel).

---

### LOT 5 — Avant ouverture du repo / recrutement — Nettoyage (~0,5j)

| # | Finding | Fix | Effort |
|---|---------|-----|--------|
| 5a | **D1** IBAN dans l'historique git | `git filter-repo` ou BFG pour purger les 2 fichiers. Force push. Prévenir Maëva (IBAN potentiellement à changer si le repo a été cloné par un tiers). | 0,5j |
| 5b | **D1** IBAN hardcodé dans contrat-sauvageon.pdf.tsx | Déplacer l'IBAN vers une variable d'env ou un champ `centre.iban` (déjà en base) | inclus |
| 5c | **.gitignore** `.env.production` non ignoré | Ajouter `.env.production` au .gitignore (garder `.env.production.local`) | 5min |

---

### LOT 6 — Maintenance continue (BASSE / INFO)

| # | Finding | Fix | Quand |
|---|---------|-----|-------|
| 6a | **D7** logs sensibles (email bodies, tokens) | Nettoyer les console.log dans email.service.ts et accompagnateur.service.ts | Quand tu touches ces fichiers |
| 6b | **D8** injection HTML dans emails | Échapper le message enseignant avant interpolation dans le template Brevo | Quand tu touches email.service.ts |
| 6c | **A7** journal-public (photos cross-famille) | Décision produit : filtrer par enfant ou documenter le consentement | Quand tu définis la politique RGPD |
| 6d | **A9** injection formule CSV | Sanitize à l'export quand tu créeras un export participants | Quand la feature arrive |
| 6e | **A10** omit global Prisma | Ajouter omit sur motDePasse/tokens dans PrismaService | Défense en profondeur, pas urgent |
| 6f | **B6** auto-compteValide SIGNATAIRE | Exiger invitationToken vérifiée (couvert par 2c) | Couvert par lot 2 |
| 6g | **D4** SSRF PDF (logoUrl) | Allowlist domaine OVH sur les `<Image src>` des PDF | Défense en profondeur |
| 6h | **D6** filtre d'exception global | Ajouter un AllExceptionsFilter pour masquer les stack traces | Avant montée en charge |
| 6i | **E5** /api/contact (rate limit + HTML injection) | Rate limit + CAPTCHA + échapper le body | Avant marketing public |
| 6j | **E7** xlsx@0.18.5 CVE | `npm audit fix` ou upgrade | Lancer `npm audit` et traiter |
| 6k | **C2** ordre-mission-pdf IDOR | Ownership sur accompagnateur.id | Avec le lot IDOR ou après |
| 6l | **C4** /public/centres expose PENDING + SIRET | Filtrer `statut: 'VALIDE'` dans searchPublic | Quand tu touches le module centres |
| 6m | **C5** /public/demande body:any | DTO typé + CAPTCHA + anti-email-bombing | Avant marketing public |
| 6n | **N5/N6** listes globales devis/factures | Scoper par R1 (collègues) | Inclus dans lot 1 |
| 6o | **N7** getDemandeInfo faux-sécurisé | assertHebergeurCanAccessDemande | Inclus dans lot 1 |
| 6p | **N8/N10/N11** factures lecture IDOR | Passer user + ownership | Inclus dans lot 1 |

---

## Checklist hors-code (Théo, manuellement)

Actions à faire sur les consoles/dashboards, non automatisables par CC :

| # | Action | Où | Quand |
|---|--------|----|-------|
| H1 | Vérifier que le bucket `liavo-uploads` n'a pas le listing public activé | Dashboard OVH Object Storage | Aujourd'hui |
| H2 | Lancer `npm audit` sur backend/ et frontend/ | Terminal local | Aujourd'hui |
| H3 | Vérifier `Referrer-Policy` et `X-Content-Type-Options` sur api.liavo.fr | `curl -I https://api.liavo.fr` | Après lot 4b |
| H4 | Vérifier DATABASE_URL avec `?sslmode=require` | Variables d'env Scalingo | Aujourd'hui |
| H5 | Confirmer que `BREVO_API_KEY` n'est PAS dans les variables frontend Scalingo (E5) | Dashboard Scalingo liavo-frontend | Aujourd'hui |
| H6 | Vérifier SPF/DKIM/DMARC sur liavo.fr | `dig TXT liavo.fr` / MXToolbox | Cette semaine |
| H7 | Signer les DPA avec Scalingo, OVH, Brevo | Contrats/CGU des prestataires | Avant onboarding LMDJ |
| H8 | Rédiger politique de confidentialité + registre des traitements RGPD | Juridique | Avant onboarding LMDJ |
| H9 | Vérifier la rétention/accès des logs Scalingo (tokens/emails loggés ?) | Dashboard Scalingo → Logs | Cette semaine |
| H10 | Rotation JWT_SECRET si le secret actuel est faible (< 32 chars) | Variables d'env Scalingo | Avec lot 2a |

---

## Timeline résumée

```
15/06  B0 ✅ fixé
15/06  LOT 0 (trust proxy + throttle) .............. 0,5h
16-17  LOT 1 (IDOR ownership helper) ............... 1,5j
18/06  ★ DÉMO MARIE
19-20  LOT 2 (auth hardening) ...................... 2j
25/06  LOT 3 (storage privé + URL signées) ......... 2j
30/06  ★ CA LMDJ
       LOT 4 (cookie httpOnly + Helmet + CORS) ..... 2j
       LOT 5 (purge git IBAN) ...................... 0,5j
       LOT 6 (maintenance continue) ................ au fil de l'eau
```

**Total estimé : ~10,5 jours de dev** (hors checklist hors-code).
**Gate dur** : LOT 3 terminé avant le premier upload de donnée médicale de mineur en prod.
