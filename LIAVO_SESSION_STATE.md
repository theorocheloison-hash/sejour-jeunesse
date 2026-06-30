# LIAVO — État session dev
> Dernière mise à jour : 30/06/2026 — Session complète : validation webhook Mollie E2E, passage live, nettoyage Sauvageon, endpoint facturation admin, migration Brevo, LOT 6 sécurité.

---

## SESSION 30/06/2026 — Mollie live + facturation admin + sécurité

### Résumé

Validation webhook Mollie end-to-end (test → paid via changePaymentState), passage clé API live, nettoyage données test Sauvageon, 2 bugfix (affichage plan + préfixe facture PDF), endpoint admin facturation manuelle (clients publics/mairies), migration @sendinblue/client → @getbrevo/brevo (5 vulns éliminées), LOT 6 sécurité (6m CORS + 6n token + 6g filtre exception + 6k centres ACTIVE + 6a logs sensibles + 6j IDOR + 6b escapeHtml emails).

### Lots livrés

| Lot | Description |
|---|---|
| Webhook Mollie E2E | Validation complète : paymentId reçu → status paid → sequenceType recurring → idempotence check → prolongation abonnement → facture FL-2026-001 émise → email envoyé |
| Passage live Mollie | Clé API live créée et déployée sur Scalingo (MOLLIE_API_KEY) |
| Nettoyage Sauvageon | SQL prod : suppression facture test FL-2026-001, purge IDs Mollie (customer/mandat/subscription), reset plan PILOTAGE 2099, reset compteur séquence FACTURE_LIAVO |
| Fix affichage plan | Cas 4bis frontend : plan actif sans mandat Mollie (PILOTAGE permanent) affiche correctement "Plan actif" au lieu de "Découverte" |
| Fix préfixe facture | Déplacement "Séjour —" de FacturePDF.tsx vers facture-pdf.mapper.ts — factures LIAVO n'ont plus le préfixe parasite |
| Endpoint facturation admin | POST /admin/facturer-centre — active le plan + émet facture LIAVO (PDF + email) sans Mollie. Pour clients publics (mairies/Trésor Public). molliePaymentId élargi à string \| null dans emettre() |
| Migration Brevo | @sendinblue/client → @getbrevo/brevo v3.0.4 — élimine request + form-data + qs + tough-cookie + uuid (5 vulns dont 2 critical) |
| LOT 6 sécurité 6m | CORS_ORIGIN fallback supprimé dans accompagnateur.service.ts + email.service.ts → FRONTEND_URL uniquement |
| LOT 6 sécurité 6n | assertTokenNotExpired ajouté dans lierCompte() (accompagnateur.service.ts) |
| LOT 6 sécurité 6g | AllExceptionsFilter global (common/filters/) — HttpException inchangées, 500 générique + stack loguée serveur pour le reste |
| LOT 6 sécurité 6k | searchPublic + getPublic filtrent statut ACTIVE — /public/centres n'expose plus les centres PENDING |
| LOT 6 sécurité 6a | Logs sensibles supprimés (tokenAcces/lien/email) dans accompagnateur.service + email.service → this.logger sans données sensibles |
| LOT 6 sécurité 6j | Ownership check dans getOrdreMissionHtml — empêche l'accès cross-séjour par itération d'UUID |
| LOT 6 sécurité 6b | escapeHtml() sur params utilisateur des templates email (19 méthodes + emailLayout title) — neutralise l'injection HTML/XSS |
| npm audit fix | Dépendances backend patchées (39 → 10 vulns, dont 0 critical) |

### Fichiers modifiés

Backend :
- `common/filters/all-exceptions.filter.ts` — **NOUVEAU** filtre d'exception global (6g)
- `utils/escape-html.ts` — **NOUVEAU** helper escapeHtml (6b)
- `main.ts` — enregistrement AllExceptionsFilter avant les pipes (6g)
- `email/email.service.ts` — migration @getbrevo/brevo + fix CORS_ORIGIN + logs sensibles → this.logger + escapeHtml sur params utilisateur
- `accompagnateurs/accompagnateur.controller.ts` — @CurrentUser passé à getOrdreMissionPdf (6j)
- `accompagnateurs/accompagnateur.service.ts` — fix CORS_ORIGIN + assertTokenNotExpired dans lierCompte + Logger + ownership check getOrdreMissionHtml
- `centres/centre.service.ts` — searchPublic + getPublic filtrent statut ACTIVE (6k)
- `admin/admin.module.ts` — import FactureLiavoModule
- `admin/admin.service.ts` — injection FactureLiavoService + méthode facturerCentre()
- `admin/admin.controller.ts` — route POST /admin/facturer-centre
- `facture-liavo/facture-liavo.service.ts` — molliePaymentId: string | null
- `facture/pdf/FacturePDF.tsx` — suppression préfixe "Séjour —" hardcodé
- `facture/pdf/facture-pdf.mapper.ts` — ajout préfixe "Séjour —" dans le mapper
- `package.json` + `package-lock.json` — migration @sendinblue → @getbrevo + npm audit fix

Frontend :
- `app/dashboard/hebergeur/abonnement/page.tsx` — cas 4bis plan actif sans mandat

### Constatations importantes

- **SEPA DD test mode ne passe jamais à paid automatiquement** — il faut utiliser l'URL changePaymentState de Mollie pour forcer le statut. Documenté pour les futurs tests.
- **sequenceType des paiements subscription = 'recurring'** même pour le premier paiement (mandat créé via API Mandates). Pas besoin du fix défensif 'first'.
- **Clé test Mollie conservée** dans le dashboard Mollie (pas dans Scalingo). Réutilisable pour tester de nouvelles features.

---

## SESSION 29/06/2026 — Emails monétisation + Dashboard admin Activité

### Résumé

6 livrables en une session : idempotence + logs webhook Mollie, emails confirmation/annulation hébergeur (IBAN masqué), notifs admin (souscription/trial/annulation), espace factures hébergeur, endpoint GET /admin/activite (feed 7j + santé clients + KPIs mois), onglet frontend admin "Activité" en première position.

### Lots livrés

| Lot | Description |
|---|---|
| Webhook idempotence | Check `factureLiavo.findFirst({ molliePaymentId })` avant prolongation — skip si déjà traité |
| Webhook logs | 5 points de log `[mollie-webhook]` : réception, status/sequenceType, prolongation, facture émise, doublon skip |
| Email confirmation hébergeur | `sendConfirmationAbonnement` — plan, fréquence, montant, IBAN masqué (XX•••1234), bouton "Gérer mon abonnement" |
| Email annulation hébergeur | `sendConfirmationAnnulation` — date expiration, bouton "Gérer mon abonnement" |
| Notifs admin | `sendNotifAdmin` générique — souscription (centre/hébergeur/plan/montant), trial (centre/hébergeur/expiration), annulation (centre/hébergeur/plan) → contact@liavo.fr |
| GET /abonnements/factures | Endpoint hébergeur (pas de PlanGuard) → `factureLiavoService.lister(centre.id)` |
| Frontend factures | Section "Mes factures" sur page abonnement (numéro, date, description, montant HT, lien PDF) |
| GET /admin/activite | Feed 7j (comptes, centres, séjours avec client DIRECT, demandes avec dates/ville/nb devis reçus, devis), santé clients (signal vert/jaune/rouge/gris, dernière activité, jours restants), KPIs mois (séjours/devis créés, taux activation) |
| Frontend admin Activité | Onglet "Activité" en 1ère position, tab par défaut, 3 sections (KPIs, santé clients, feed chronologique) |

### Fichiers modifiés

Backend :
- `abonnement.service.ts` — injection EmailService, maskIban(), emails dans souscrire/activerTrial/annuler, getFactures(), idempotence + logs webhook
- `abonnement.controller.ts` — route GET /factures
- `email.service.ts` — sendConfirmationAbonnement, sendConfirmationAnnulation, sendNotifAdmin
- `admin.service.ts` — méthode getActivite()
- `admin.controller.ts` — route GET /activite

Frontend :
- `src/lib/abonnement.ts` — interface FactureLiavo + getFacturesLiavo()
- `app/dashboard/hebergeur/abonnement/page.tsx` — section "Mes factures", useEffect Promise.all
- `src/lib/admin.ts` — interfaces FeedEvent/SanteClient/KpisActivite/AdminActivite + getAdminActivite()
- `app/dashboard/admin/page.tsx` — type Tab + TABS + ActiviteTab composant + tab par défaut 'activite'

### Test Mollie E2E — En attente validation webhook

**État au 29/06 :**
- Souscription test Sauvageon (26/06) : customer `cst_2vyTqoR78L` + mandat `mdt_KUGcvC83gV` + subscription `sub_8nVaSBGQ4X`
- Paiement `tr_jFPJFCLwADz8RnH5hsATJ` créé le 27/06, statut "En cours", échéance **30 juin 2026**
- Webhook testé manuellement (curl) : route accessible, retourne `{ received: true }` quand statut ≠ paid
- Logs + idempotence déployés : quand le paiement passera à `paid`, on verra la chaîne complète dans les logs
- **IBAN test** : `NL55INGB0000000000` est un IBAN officiel de test Mollie — le paiement passera à paid

**Action 30/06 matin :**
1. Lancer `scalingo --app liavo-backend --region osc-fr1 logs --follow`
2. Chercher `[mollie-webhook]` dans les logs
3. Vérifier : prolongation abonnement + facture LIAVO émise
4. Si OK : nettoyage Sauvageon → PILOTAGE 2099 + purge IDs Mollie test
5. Puis : passer MOLLIE_API_KEY de test à live

---

## TODO avant premier vrai paiement (Choucas ~17/07)

- [x] Checkbox CGV obligatoire
- [x] Horodater l'acceptation en base
- [x] MAJ CGV tarifs réels
- [x] PricingTable annuel
- [x] Bug catalogue KBIS
- [x] **Idempotence webhook** (29/06)
- [x] **Logs webhook** (29/06)
- [x] **Email confirmation hébergeur** (29/06)
- [x] **Notification admin** souscription/trial/annulation (29/06)
- [x] **Espace factures hébergeur** (29/06)
- [x] **Valider webhook Mollie** — 30/06, E2E validé via changePaymentState
- [x] **Nettoyage Sauvageon** — PILOTAGE 2099 + purge IDs Mollie test + reset séquence
- [x] Passer `MOLLIE_API_KEY` de test à live

---

## NOTE 26/06/2026 — Premier utilisateur organique via Les Choucas

**Jean Charles DENIS** (`djeancharles2@gmail.com`, tél 0617984562) — compte ORGANISATEUR créé 25/06/2026 16:46.
- Séjour **"Classe Printemps"** — Sixt-Fer-à-Cheval, 14-18 juin 2027, 40 élèves
- Mode COLLABORATIF, centre sélectionné = **Les Choucas** (507d5133)
- Signal fort d'adoption : Les Choucas mettent leurs vrais clients sur la plateforme

---

## ÉTAT PROD AU 29/06/2026

### Monétisation — Mollie SEPA (MRR actuel : 0€)

**Backend + frontend complets. Clé API live déployée. Webhook validé E2E. Prêt pour le premier paiement réel.**

**Endpoint admin POST /admin/facturer-centre** pour clients publics (mairies/Trésor Public) — facture sans Mollie.

Flow SEPA :
1. Hébergeur remplit IBAN + titulaire sur /dashboard/hebergeur/abonnement
2. Backend crée customer Mollie + mandat SEPA + subscription
3. Activation optimiste (grace period 14j)
4. Email confirmation hébergeur (IBAN masqué) + notif admin
5. Mollie valide le mandat puis prélève
6. Webhook : check idempotence → prolonge abonnement → émet facture LIAVO (PDF + email)

Pricing v3 :
- Essentiel : 29€/mois ou 290€/an
- Complet : 49€/mois ou 490€/an
- Pilotage : 69€/mois ou 690€/an
- Centre supp : 39€/mois ou 390€/an
- TVA : franchise de base art. 293 B CGI
- Trial : 30j Pilotage, blocage souple à expiration

### Admin — Dashboard Activité (NEW 29/06)

Onglet "Activité" en première position, ouvert par défaut :
- **KPIs mois** : séjours créés, devis créés, centres actifs, taux activation
- **Santé clients** : signal vert/jaune/rouge/gris par centre, dernière activité, jours restants abonnement
- **Feed 7j** : comptes, centres, séjours (avec client DIRECT), demandes (avec dates/ville/nb devis reçus/enseignant), devis

### Sécurité

Tous findings fermés (LOT 0-5). LOT 6 : 6m + 6n + 6g + 6k + 6a + 6j + 6b + migration Brevo terminés. Reste LOT 6 maintenance (6h/6l/6o + 6e/6f défense en profondeur + 6c/6d décision produit). npm audit : 10 vulns restantes (0 critical, toutes transitives NestJS/Prisma CLI/Anthropic SDK).

### Email logging

9/9 flux couverts + 3 nouveaux (confirmation abo, annulation abo, notif admin).

### Clients

- **Sauvageon** : PILOTAGE gratuit permanent (2099-12-31). Données Mollie test nettoyées. Pas de mandat Mollie.
- **Les Choucas** : trial Complet actif. **Deadline 17/07 — premier paiement.** Paiement via mairie/Trésor Public, pas via Mollie. Endpoint admin facturation prêt.
- **Alticlub** : trial Complet actif jusqu'au 10/09/2026.
- **Pôle Montagne** (Florimont + YAKA) : trial Complet actif jusqu'au 01/12/2026. Nants pending.
- **LMDJ** : CA le 30/06, en veille stratégique.

### Bugs connus

- Props non utilisées : `budgetLoading`/`onBudgetReload` dans TabDevisFacturation
- Multi-centre : ajout post-souscription ne met pas à jour la subscription Mollie (gestion manuelle)
- npm audit 10 vulns restantes (transitives NestJS/Prisma/Anthropic, 0 critical, pas d'action possible sans upgrade majeur)

---

## ÉCHÉANCES

| Date | Événement |
|---|---|
| **30/06** | **Validation webhook Mollie** — paiement test échéance ce jour |
| **30/06** | CA LMDJ — pitch partenariat |
| **17/07** | **Fin trial Les Choucas — deadline paiement opérationnel** |
| **10/09** | Fin trial Alticlub |
| **01/09/2026** | Obligation réception e-invoicing (Factur-X validé) |
| **01/12/2026** | Fin trial Pôle Montagne |
| 31/12/2026 | Clôture 1er exercice LIAVO SASU |

---

## PROCHAINS CHANTIERS (par priorité)

### 1. Sécurité — verrouillage avant démarchage commercial
- [x] 6m : CORS_ORIGIN fallback → FRONTEND_URL
- [x] 6n : lierCompte token expiration
- [x] Migration @sendinblue → @getbrevo/brevo
- [x] npm audit fix
- [x] 6g : AllExceptionsFilter (masquer stack traces)
- [x] 6a : Nettoyer console.log sensibles
- [x] 6b : Échapper HTML params utilisateur emails
- [x] 6j : Ordre-mission-pdf IDOR ownership
- [x] 6k : /public/centres expose PENDING
- [ ] 6h : /api/contact rate limit + CAPTCHA
- [ ] 6l : /public/demande DTO typé
- [ ] 6o : 3 iframes → useSecureUrl
- [ ] 6c/6d/6e/6f : décision produit + défense en profondeur
- [ ] H1-H9 checklist hors-code (H7 DPA : Scalingo + Brevo récupérés, OVH à faire)

### 2. Premier paiement réel
- [ ] Facturer Les Choucas via POST /admin/facturer-centre (plan COMPLET annuel)
- [ ] Monitorer premier client Mollie SEPA (quand un client non-public souscrit)

### 3. Features produit
- [ ] Module pilotage hébergeur (CA, taux occupation, marges)
- [ ] Chantier UX séjour (ARCHITECTURE_UX_SEJOUR_FINAL.md — ~7j)
- [ ] CRM pipeline dérivé (statut calculé, kanban 5 colonnes)
- [ ] Planning couleurs par statut (5 statuts facturation)

### 4. Dette technique
- [ ] Cleanup props `budgetLoading`/`onBudgetReload`
- [ ] Fusionner 3 DevisBuilder dupliqués (1-2j)
- [ ] Découper `sejour/[id]/page.tsx` (~3 200 lignes)
- [ ] DashboardShell unification (4-6j)
- [ ] Multi-centre subscription update Mollie (PATCH montant au prochain cycle)

---

## STACK & COMMANDES

- **Backend** : NestJS 11, Prisma, PostgreSQL 17, Scalingo Paris
- **Frontend** : Next.js 15 (16.1.6), React 19, TypeScript 5, Tailwind 4, Scalingo Paris
- **Stockage** : OVH Object Storage Gravelines
- **Emails** : Brevo FR
- **Repo** : `C:\Users\Roche-Loison\Desktop\sejour-jeunesse`
- **CC** : `cd C:\Users\Roche-Loison\Desktop\sejour-jeunesse && claude`
- **SQL prod** : `scalingo --app liavo-backend --region osc-fr1 pgsql-console`
- **Logs live** : `scalingo --app liavo-backend --region osc-fr1 logs --follow`
- **Déploiement** : auto sur push main
