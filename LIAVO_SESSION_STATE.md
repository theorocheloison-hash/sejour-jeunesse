# LIAVO — État session dev
> Dernière mise à jour : 30/06/2026 — Session complète : Mollie live, LOT 6 sécurité complet (code), checklist hors-code H1-H9 fermée, politique confidentialité corrigée.

---

## SESSION 30/06/2026 — Mollie live + LOT 6 sécurité complet + checklist infra

### Résumé

Validation webhook Mollie E2E, passage clé API live, nettoyage données test Sauvageon, 2 bugfix (affichage plan + préfixe facture PDF), endpoint admin facturation manuelle, migration Brevo, **LOT 6 sécurité code complet** (6g/6k/6a/6j/6b/6l + 6m/6n/6i), **checklist hors-code H1-H9 fermée** (bucket, env frontend, headers Helmet, SSL DB, DNS email, DPA ×3, politique confidentialité, rétention logs), **politique confidentialité corrigée** (ajout Mollie sous-traitant, correction claim IBAN, redirect URL).

### Lots livrés

| Lot | Description |
|---|---|
| Webhook Mollie E2E | Validation complète : paymentId reçu → status paid → sequenceType recurring → idempotence check → prolongation abonnement → facture FL-2026-001 émise → email envoyé |
| Passage live Mollie | Clé API live créée et déployée sur Scalingo (MOLLIE_API_KEY) |
| Nettoyage Sauvageon | SQL prod : suppression facture test FL-2026-001, purge IDs Mollie (customer/mandat/subscription), reset plan PILOTAGE 2099, reset compteur séquence FACTURE_LIAVO |
| Fix affichage plan | Cas 4bis frontend : plan actif sans mandat Mollie (PILOTAGE permanent) affiche correctement "Plan actif" au lieu de "Découverte" |
| Fix préfixe facture | Déplacement "Séjour —" de FacturePDF.tsx vers facture-pdf.mapper.ts — factures LIAVO n'ont plus le préfixe parasite |
| Endpoint facturation admin | POST /admin/facturer-centre — active le plan + émet facture LIAVO (PDF + email) sans Mollie. Pour clients publics (mairies/Trésor Public) |
| Migration Brevo | @sendinblue/client → @getbrevo/brevo v3.0.4 — élimine 5 vulns dont 2 critical |
| LOT 6 sécurité 6m | CORS_ORIGIN fallback supprimé → FRONTEND_URL uniquement |
| LOT 6 sécurité 6n | assertTokenNotExpired ajouté dans lierCompte() |
| LOT 6 sécurité 6g | AllExceptionsFilter global — HttpException inchangées, 500 générique pour le reste |
| LOT 6 sécurité 6k | searchPublic + getPublic filtrent statut ACTIVE |
| LOT 6 sécurité 6a | Logs sensibles supprimés (tokenAcces/lien/email) → this.logger |
| LOT 6 sécurité 6j | Ownership check getOrdreMissionHtml — empêche IDOR cross-séjour |
| LOT 6 sécurité 6b | escapeHtml() sur 19 méthodes email (49 occurrences) |
| LOT 6 sécurité 6l | DTO class-validator 38 champs sur POST /public/demande — whitelist + validation types/bornes |
| npm audit fix | 39 → 10 vulns (0 critical, transitives NestJS/Prisma) |
| H1 Bucket OVH | AccessDenied sur listing — OK |
| H2 npm audit frontend | 0 vulnérabilité |
| H3 Headers sécurité | Helmet complet (HSTS, nosniff, SAMEORIGIN, CSP, etc.) |
| H4 SSL DB | sslmode=prefer — connexion chiffrée |
| H5 Env frontend | 2 vars seulement (NEXT_PUBLIC_API_URL, PROJECT_DIR) |
| H6 DNS email | SPF + DKIM Brevo + DMARC complet |
| H7 DPA | Scalingo (CGV v2.5.0) + Brevo (CGU) + OVH (Annexe données perso) — archivés docs/juridique/ |
| H8 Politique confidentialité | Page existante /legal/confidentialite corrigée : ajout Mollie sous-traitant, correction claim chiffrement IBAN, redirect /politique-confidentialite |
| H9 Rétention logs | 72h Scalingo par défaut + événements critiques en base — suffisant |

### Fichiers modifiés

Backend :
- `common/filters/all-exceptions.filter.ts` — **NOUVEAU** filtre d'exception global (6g)
- `utils/escape-html.ts` — **NOUVEAU** helper escapeHtml (6b)
- `public/dto/create-demande-publique.dto.ts` — **NOUVEAU** DTO 38 champs (6l)
- `main.ts` — enregistrement AllExceptionsFilter (6g)
- `email/email.service.ts` — migration Brevo + logs → Logger + escapeHtml 49 occurrences
- `accompagnateurs/accompagnateur.controller.ts` — @CurrentUser passé à getOrdreMissionPdf (6j)
- `accompagnateurs/accompagnateur.service.ts` — fix CORS + token expiration + Logger + ownership check (6j)
- `centres/centre.service.ts` — searchPublic + getPublic filtrent statut ACTIVE (6k)
- `public/public.controller.ts` — @Body() dto: CreateDemandePubliqueDto (6l)
- `admin/admin.module.ts` — import FactureLiavoModule
- `admin/admin.service.ts` — méthode facturerCentre()
- `admin/admin.controller.ts` — route POST /admin/facturer-centre
- `facture-liavo/facture-liavo.service.ts` — molliePaymentId: string | null
- `facture/pdf/FacturePDF.tsx` — suppression préfixe "Séjour —"
- `facture/pdf/facture-pdf.mapper.ts` — ajout préfixe dans le mapper

Frontend :
- `next.config.ts` — redirect /politique-confidentialite → /legal/confidentialite
- `app/legal/confidentialite/page.tsx` — ajout Mollie + correction IBAN
- `app/dashboard/hebergeur/abonnement/page.tsx` — cas 4bis plan actif sans mandat

---

## TODO avant premier vrai paiement (Choucas ~17/07)

- [x] Checkbox CGV obligatoire
- [x] Horodater l'acceptation en base
- [x] MAJ CGV tarifs réels
- [x] PricingTable annuel
- [x] Bug catalogue KBIS
- [x] Idempotence webhook
- [x] Logs webhook
- [x] Email confirmation hébergeur
- [x] Notification admin souscription/trial/annulation
- [x] Espace factures hébergeur
- [x] Valider webhook Mollie E2E
- [x] Nettoyage Sauvageon
- [x] Passer MOLLIE_API_KEY de test à live
- [x] **LOT 6 sécurité code complet**
- [x] **Checklist hors-code H1-H9 fermée**
- [x] **Politique confidentialité corrigée**
- [ ] Facturer Les Choucas via POST /admin/facturer-centre

---

## NOTE 26/06/2026 — Premier utilisateur organique via Les Choucas

**Jean Charles DENIS** (`djeancharles2@gmail.com`, tél 0617984562) — compte ORGANISATEUR créé 25/06/2026 16:46.
- Séjour **"Classe Printemps"** — Sixt-Fer-à-Cheval, 14-18 juin 2027, 40 élèves
- Mode COLLABORATIF, centre sélectionné = **Les Choucas** (507d5133)
- Signal fort d'adoption : Les Choucas mettent leurs vrais clients sur la plateforme

---

## ÉTAT PROD AU 30/06/2026

### Monétisation — Mollie SEPA (MRR actuel : 0€)

**Backend + frontend complets. Clé API live déployée. Webhook validé E2E. Sécurité verrouillée. Prêt pour le premier paiement réel.**

### Sécurité — VERROUILLAGE COMPLET

**LOT 6 code :** 6g/6k/6a/6j/6b/6l/6m/6n/6i — tous livrés.
**Checklist infra :** H1-H9 — tous vérifiés et fermés.
**npm audit :** 10 vulns restantes (0 critical, transitives NestJS/Prisma/Anthropic SDK — aucune action possible sans upgrade majeur).

Reste LOT 6 maintenance (au fil de l'eau, non bloquant) :
- 6h : /api/contact rate limit — N/A, la route n'existe pas encore
- 6o : 3 iframes → useSecureUrl — avant données sensibles en prod
- 6c/6d/6e/6f : décision produit + défense en profondeur

### Clients

- **Sauvageon** : PILOTAGE gratuit permanent (2099-12-31). Données Mollie test nettoyées.
- **Les Choucas** : trial Complet actif. **Deadline ~17/07 — premier paiement.** Paiement via mairie/Trésor Public → endpoint admin facturation.
- **Alticlub** : trial Complet actif jusqu'au 10/09/2026.
- **Pôle Montagne** (Florimont + YAKA) : trial Complet actif jusqu'au 01/12/2026.
- **LMDJ** : CA le 30/06, en veille stratégique.

### Bugs connus

- Props non utilisées : `budgetLoading`/`onBudgetReload` dans TabDevisFacturation
- Multi-centre : ajout post-souscription ne met pas à jour la subscription Mollie
- npm audit 10 vulns restantes (transitives, 0 critical)

---

## ÉCHÉANCES

| Date | Événement |
|---|---|
| ~~30/06~~ | ~~Validation webhook Mollie~~ ✅ |
| ~~30/06~~ | ~~CA LMDJ~~ |
| **17/07** | **Fin trial Les Choucas — deadline paiement opérationnel** |
| 10/09 | Fin trial Alticlub |
| 01/09/2026 | Obligation réception e-invoicing (Factur-X validé) |
| 01/12/2026 | Fin trial Pôle Montagne |
| 31/12/2026 | Clôture 1er exercice LIAVO SASU |

---

## PROCHAINS CHANTIERS (par priorité)

### 1. Démarchage commercial (immédiat)
- [ ] Facturer Les Choucas via POST /admin/facturer-centre (plan COMPLET annuel)
- [ ] Vidéo motion design landing page (besoin commercial)
- [ ] Relance LMDJ post-CA 30/06
- [ ] Pitch Alticlub conversion trial → payant
- [ ] AMI France Tourisme Tech 2026-2027 (deadline septembre)

### 2. UX / Conformité — quick wins
- [ ] Footer liens légaux dans DashboardShell (CGU/CGV/Confidentialité visibles pour utilisateurs connectés)
- [ ] Cron automatisé alertes expiration (NestJS @Cron ou Scalingo scheduler)
- [ ] DMARC p=none → p=quarantine (quand délivrabilité validée)
- [ ] Chiffrement IBAN en base (pgcrypto ou AES applicatif) — dette technique

### 3. Features produit
- [ ] Chantier UX séjour (ARCHITECTURE_UX_SEJOUR_FINAL.md — ~7j)
- [ ] CRM pipeline dérivé (statut calculé, kanban 5 colonnes)
- [ ] Planning couleurs par statut (5 statuts facturation)
- [ ] Module pilotage hébergeur (CA, taux occupation, marges)
- [ ] Convention séjour scolaire Phase 2 (configurable par centre)

### 4. LOT 6 maintenance (au fil de l'eau)
- [ ] 6h : /api/contact rate limit + CAPTCHA (quand page contact existe)
- [ ] 6o : 3 iframes → useSecureUrl (quand données sensibles en prod)
- [ ] 6c : journal-public cross-famille (décision RGPD)
- [ ] 6d : injection formule CSV (quand feature export arrive)
- [ ] 6e : omit global Prisma (défense en profondeur)
- [ ] 6f : SSRF PDF logoUrl allowlist (défense en profondeur)

### 5. Dette technique
- [ ] Fusionner 3 DevisBuilder dupliqués (1-2j)
- [ ] Découper `sejour/[id]/page.tsx` (~3 200 lignes)
- [ ] DashboardShell unification (4-6j)
- [ ] Multi-centre subscription update Mollie
- [ ] Cleanup props budgetLoading/onBudgetReload
- [ ] .gitignore exception !docs/audits/PLAN_REMEDIATION.md

---

## STACK & COMMANDES

- **Backend** : NestJS 11, Prisma, PostgreSQL 17, Scalingo Paris
- **Frontend** : Next.js 15 (16.1.6), React 19, TypeScript 5, Tailwind 4, Scalingo Paris
- **Stockage** : OVH Object Storage Gravelines
- **Emails** : Brevo FR
- **PSP** : Mollie (SEPA direct, clé live)
- **Repo** : `C:\Users\Roche-Loison\Desktop\sejour-jeunesse`
- **CC** : `cd C:\Users\Roche-Loison\Desktop\sejour-jeunesse && claude`
- **SQL prod** : `scalingo --app liavo-backend --region osc-fr1 pgsql-console`
- **Logs live** : `scalingo --app liavo-backend --region osc-fr1 logs --follow`
- **Déploiement** : auto sur push main
