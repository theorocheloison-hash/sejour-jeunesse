# LIAVO — État session dev
> Dernière mise à jour : 23/06/2026 — Sécurité LOT 4a complet. Feedback Maeva (Les Choucas) 8/8 items résolus. Timeline emails enrichie.

---

## COMMITS SESSION 23/06/2026

| Commit | Description |
|---|---|
| `391291f` | feat(auth): LOT 4a Phase 3 backend — `auth-cookies.ts` helper, `setAuthCookies` sur `centres/register` + `collaborateurs/register` |
| `28cb4da` | fix(auth): LOT 4a Phase 2 frontend — proxy rewrite `/api/*`, suppression js-cookie, fix `sj_user`→`sj_user_v2`, DashboardShell migré |
| `5436632` | fix(ux): modal guard — 17 modales formulaire protégées (backdrop click + Escape supprimés), 12 modales confirmation conservées |
| `2a16ad3` | feat(devis): catalogue suggestions complémentaire + TVA par ligne + composant partagé `CatalogueSuggestionInput.tsx` + bouton visible |
| `3758f12` | feat(sejour): accompagnants à la création séjour DIRECT — DTO backend + service + frontend (grid 2 colonnes) |
| `bb1e848` | fix(ux): bouton retour intelligent — `router.back()` + fallback `retourHref` si accès direct |
| *(inline)* | feat(sejour): ajout `SEJOUR_ETUDIANT` dans `SOUS_TYPES_SEJOUR` de `CreateSejourModal` |
| *(inline)* | fix(profil): ajout `siret: form.siret` manquant dans `handleSubmit` profil hébergeur |
| `aeb7ba0` | feat(planning): overlay jours fériés FR (algo Easter) + vacances scolaires 2025-2027 (3 zones) + alerte admin expiration |
| `6fc6e0b` | feat(backend): emails dans timeline — enrichissement metadata existante (to/subject/messagePreview) + fix sejourId colonne + log invitation orga |
| `e897baf` | feat(ux): timeline cliquable — entries email expandables + icône facture 🧾 |

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

**Tous les findings fermés. LOT 4a (3 phases) terminé.** Cookies auth = httpOnly, Secure, SameSite=lax. Reste : LOT 6 maintenance continue + checklist hors-code H1-H9.

### Feedback Maeva (Les Choucas) — 8/8 items résolus

| # | Item | Commit |
|---|---|---|
| 1 | Modales : clic extérieur ferme le formulaire | `5436632` |
| 2 | Bouton retour → revenir au planning | `bb1e848` |
| 3 | Catalogue suggestions sur devis complémentaire | `2a16ad3` |
| 4 | Voir les emails envoyés dans le dossier | `6fc6e0b` + `e897baf` |
| 5 | Jours fériés + vacances sur le planning | `aeb7ba0` |
| 6 | Nombre d'accompagnants à la création séjour | `3758f12` |
| 7 | TVA par ligne sur devis complémentaire (= devis principal) | `2a16ad3` |
| 8 | Catégorie étudiant/enseignement supérieur | inline |

### Bugs corrigés cette session

- ✅ SIRET profil non persisté (`handleSubmit` envoyait 21/22 champs, `siret` manquait)
- ✅ Bug `sj_user` vs `sj_user_v2` inscription-hebergement
- ✅ DashboardShell logout incohérent (server action → `useAuth().logout()`)
- ✅ `sejourId` colonne manquante sur activités devis/facture/convention → timeline vide
- ✅ Icône facture manquante dans `ACTIVITE_ICONS`
- ✅ SQL fix : SIRET Les Choucas — devis avait le SIRET, profil centre non

### Bugs connus restants

- **`caViaReseau`** hébergeur placé dans `global/page.tsx` au lieu de `hebergeur/page.tsx` → invisible
- **Matching `findOpen()`** : utilise `codePostal` pas `departement` ; `centresNotifies` hardcodé à 0
- **7 call sites `demandeDevis.create`** à centraliser (future refacto)
- **6m CORS_ORIGIN fallback** : `autorisation.service.ts` et `accompagnateur.service.ts` → remplacer par `FRONTEND_URL`

### Nouveaux composants/fichiers créés

- `frontend/src/components/CatalogueSuggestionInput.tsx` — composant partagé catalogue (remplace code dupliqué dans 3 fichiers)
- `frontend/src/data/calendrier-france.ts` — jours fériés algorithmiques + vacances scolaires 2025-2027 (3 zones) + alerte expiration

### Clients

- **Sauvageon** : client ancre, ~63 séjours, production active
- **Les Choucas** (Sixt-Fer-à-Cheval) : signé 17/06, 2 mois gratuits puis plan Complet. Feedback actif (Maeva/Nora).
- **Alticlub** : client actif
- **Pôle Montagne** (Yves Massard) : 3 centres, trial 6 mois (→ 01/12/2026)
- **LMDJ** : en veille stratégique, CA 30/06. APIDAE Connect bloqué structurellement (dépendance LMDJ, pas LIAVO).

---

## ÉCHÉANCES

| Date | Événement | Statut |
|---|---|---|
| **30/06** | CA LMDJ — pitch partenariat | En attente |
| **Fin juillet** | Infrastructure paiement SEPA | Roadmap |
| **01/09/2026** | Obligation réception e-invoicing | Factur-X validé |
| **01/12/2026** | Fin trial Pôle Montagne | — |
| 31/12/2026 | Clôture 1er exercice LIAVO SASU | — |

---

## PROCHAINS CHANTIERS (par priorité)

### 1. Monétisation (MRR = 0€)

- [ ] PSP à trancher : Mollie EU vs Frisbii/PayPlug FR
- [ ] Paiement SEPA (mandats prélèvement, pas carte — assos/mairies passent par le Trésor Public) — fin juillet
- [ ] Onboarding payant : flow d'abonnement après trial
- [ ] Vidéo motion design landing page

### 2. Sécurité — LOT 6 maintenance

- [ ] 6m : CORS_ORIGIN fallback → FRONTEND_URL
- [ ] 6o : 3 iframes src=URL OVH privée → useSecureUrl
- [ ] 6n : lierCompte token expiration
- [ ] H1-H9 : checklist hors-code
- [ ] Secrets à rotation : JWT_SECRET, S3 keys, DATABASE_URL, Brevo key

### 3. Features produit

- [ ] Module pilotage hébergeur (CA, taux occupation, marges) — demandé par Les Choucas et Yves Massard, aligné plan Pilotage 79€/mois
- [ ] Chantier UX séjour (ARCHITECTURE_UX_SEJOUR_FINAL.md — ~7j)
- [ ] CRM pipeline dérivé (statut calculé, kanban 5 colonnes)
- [ ] Planning couleurs par statut (5 statuts facturation)
- [ ] Vacances scolaires 2027-2028 à charger quand publiées au JO (alerte admin en place)

### 4. Dette technique

- [ ] Fusionner 3 DevisBuilder dupliqués (1-2j) — CatalogueSuggestionInput déjà extrait, 1/3 fait
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
- **Frontend** : Next.js 15, React 19.2.3, TypeScript 5, Tailwind 4, axios 1.13.6, Scalingo Paris (`liavo-frontend`)
- **Stockage** : OVH Object Storage Gravelines (`liavo-uploads`, presigning activé)
- **Emails** : Brevo FR
- **Repo local** : `C:\Users\Roche-Loison\Desktop\sejour-jeunesse`
- **CC** : `cd C:\Users\Roche-Loison\Desktop\sejour-jeunesse && claude`
- **SQL prod** : `scalingo --app liavo-backend --region osc-fr1 pgsql-console`
- **Déploiement** : auto sur push main
