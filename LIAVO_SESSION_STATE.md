# LIAVO — État session dev
> Dernière mise à jour : 23/06/2026 — LOT 4a complet (3 phases). Migration httpOnly cookies terminée.

---

## COMMITS SESSION 23/06/2026

| Commit | Description |
|---|---|
| `391291f` | feat(auth): LOT 4a Phase 3 backend — `auth-cookies.ts` helper partagé, `setAuthCookies` sur `centres/register` + `collaborateurs/register`, refresh token rotatif 30j. Backward compatible. |
| `28cb4da` | fix(auth): LOT 4a Phase 2 frontend — proxy rewrite `/api/*` → `api.liavo.fr/*`, suppression js-cookie, baseURL `/api`, refresh sans body, fix bug `sj_user`→`sj_user_v2`, DashboardShell migré `useAuth().logout()`, suppression code mort. 15 fichiers. |

---

## COMMITS SESSION 22/06/2026

| Commit | Description |
|---|---|
| `a99ea29` | fix(security): LOT 3c/3d/3e — token expiration AutorisationParentale + AccompagnateurMission, storage cleanup on delete |
| *(22/06)* | feat(security): LOT 3f — SecureFileLink migration 15 call sites |
| `5d97896` | feat(security): LOT 4 quick wins — Helmet HSTS, CORS cleanup, login anti-enumeration, Multer limits, siteWeb XSS |
| `a947f2e` | feat(auth): LOT 4a Phase 1 — cookie-parser, cookieThenBearerExtractor dual, setAuthCookies httpOnly, POST /auth/logout |
| *(22/06)* | fix(security): LOT 5a/5b/5c — purge IBAN git, IBAN dynamique contrat, .gitignore .env.production |

---

## ÉTAT PROD AU 23/06/2026

### Sécurité — bilan

| Sévérité | Trouvés | Fixé | Reste |
|----------|---------|------|-------|
| CRITIQUE | 6       | 6    | 0     |
| HAUTE    | 10      | 10   | 0     |
| MOYENNE  | 14      | 14   | 0     |
| BASSE    | 4       | 4    | 0     |

**Tous les findings fermés. LOT 4a (3 phases) terminé.** Le frontend n'expose plus aucun token côté JavaScript. Cookies auth = httpOnly, Secure, SameSite=lax, posés exclusivement par le backend.

Reste : LOT 6 maintenance continue + checklist hors-code H1-H9.

### Bugs corrigés cette session

- ✅ Bug `sj_user` vs `sj_user_v2` inscription-hebergement (commit 28cb4da)
- ✅ DashboardShell logout incohérent (server action → `useAuth().logout()`)

### Bugs connus restants

- **`caViaReseau`** hébergeur placé dans `global/page.tsx` au lieu de `hebergeur/page.tsx` → invisible
- **Matching `findOpen()`** : utilise `codePostal` pas `departement` ; `centresNotifies` hardcodé à 0
- **7 call sites `demandeDevis.create`** à centraliser (future refacto)
- **6m CORS_ORIGIN fallback** : `autorisation.service.ts` et `accompagnateur.service.ts` → remplacer par `FRONTEND_URL`

### Clients

- **Sauvageon** : client ancre, ~63 séjours, production active
- **Les Choucas** (Sixt-Fer-à-Cheval) : signé 17/06, 2 mois gratuits puis plan Complet
- **Alticlub** : client actif
- **Pôle Montagne** (Yves Massard) : 3 centres, trial 6 mois (→ 01/12/2026)
- **LMDJ** : en veille stratégique, CA 30/06

---

## ÉCHÉANCES

| Date | Événement | Statut |
|---|---|---|
| **30/06** | CA LMDJ — pitch partenariat | En attente retour |
| **Fin juillet** | Infrastructure paiement SEPA | Roadmap |
| **01/09/2026** | Obligation réception e-invoicing | Factur-X validé |
| **01/12/2026** | Fin trial Pôle Montagne | — |
| 31/12/2026 | Clôture 1er exercice LIAVO SASU | — |

---

## PROCHAINS CHANTIERS (par priorité)

### Sécurité — LOT 6 maintenance

- [ ] 6m : CORS_ORIGIN fallback → FRONTEND_URL
- [ ] 6o : 3 iframes src=URL OVH privée → useSecureUrl
- [ ] 6n : lierCompte token expiration
- [ ] H1-H9 : checklist hors-code
- [ ] Secrets à rotation : JWT_SECRET, S3 keys, DATABASE_URL, Brevo key

### Features & monétisation

- [ ] Paiement SEPA (mandats prélèvement) — fin juillet
- [ ] Vidéo motion design landing page
- [ ] Module pilotage hébergeur (CA, taux occupation, marges)
- [ ] Chantier UX séjour (ARCHITECTURE_UX_SEJOUR_FINAL.md — ~7j)
- [ ] CRM pipeline dérivé
- [ ] Planning couleurs par statut
- [ ] PSP à trancher : Mollie EU vs Frisbii/PayPlug FR

### Dette technique

- [ ] Fusionner 3 DevisBuilder dupliqués (1-2j)
- [ ] Découper `sejour/[id]/page.tsx` (~3 200 lignes)
- [ ] DashboardShell unification (4-6j)

---

## DOCUMENTS STRATÉGIQUES

| Document | Emplacement |
|---|---|
| Positionnement LIAVO × réseaux | `docs/POSITIONNEMENT_LIAVO_RESEAUX.md` |
| Architecture UX séjour | `docs/ARCHITECTURE_UX_SEJOUR_FINAL.md` |
| Plan monétisation | `docs/commercial/MONETISATION_PLAN.md` |
| Plan remédiation | `docs/audits/PLAN_REMEDIATION.md` |
| Analyse httpOnly Phase 2 | `docs/audits/ANALYSE_HTTPONLY_PHASE2.md` |
| Dette technique | `docs/DETTE_TECHNIQUE.md` |

---

## STACK & COMMANDES RAPPEL

- **Backend** : NestJS 11, Prisma ORM, PostgreSQL 17, Scalingo Paris (`liavo-backend`)
- **Frontend** : Next.js 16.1.6, React 19.2.3, TypeScript 5, Tailwind 4, axios 1.13.6, Scalingo Paris (`liavo-frontend`)
- **Stockage** : OVH Object Storage Gravelines (`liavo-uploads`, presigning activé)
- **Emails** : Brevo FR
- **Repo local** : `C:\Users\Roche-Loison\Desktop\sejour-jeunesse`
- **CC** : `cd C:\Users\Roche-Loison\Desktop\sejour-jeunesse && claude`
- **SQL prod** : `scalingo --app liavo-backend --region osc-fr1 pgsql-console`
- **Déploiement** : auto sur push main
