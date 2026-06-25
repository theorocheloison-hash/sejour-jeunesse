# LIAVO — État session dev
> Dernière mise à jour : 25/06/2026 — Intégration Mollie SEPA complète (backend), trial 30j Pilotage, fix edge cases, migration 4 clients existants.

---

## SESSION 25/06/2026 — Intégration Mollie SEPA + Monétisation

### Chantier principal — Infrastructure paiement Mollie

| Lot | Commit | Description |
|---|---|---|
| Fix planning | 8c18f1c | Bug collaborateurs planning (Thomas/Pôle Montagne) : `getCentreIdsForUser()` dans centre.helper.ts |
| 1 | d90757a | Migration Prisma : enum PILOTAGE + 4 champs Mollie sur CentreHebergement |
| 2 | 06e9860 | Service Mollie : checkout SEPA + webhook + subscription récurrente (@mollie/api-client v4.5.0) |
| 3 | b271b0c | Trial 30j Pilotage : activerTrial + getStatut (isTrial, trialExpire) |
| 3b | c6a9b3b | Fix edge cases : annulation upgrade, prolongation max(exp,now), trialUsed |
| SQL | — | Migration 4 clients existants : trial_started_at = created_at |
| Fix | (à pousser) | FacturePdfLink → SecureFileLink |

### Décisions prises

- PSP : Mollie (NL, ACPR). SEPA Core 0,35€/tx. Stripe et PayPlug écartés.
- Pricing v3 : mensuel (29/49/69€) + annuel ronds (290/490/690€), remise ~17%
- TVA : franchise de base art. 293 B CGI
- Trial : 30j Pilotage, blocage souple (bannière + lecture seule, pas de downgrade forcé)
- Upgrade mid-cycle : nouveau prix au prélèvement suivant, pas de prorata
- Downgrade : sur demande manuelle, fin de période, données lecture seule
- Sauvageon : compte ancre gratuit, pas de trial

### Fichiers créés/modifiés

- `backend/prisma/schema.prisma` — enum PILOTAGE + champs Mollie
- `backend/prisma/migrations/20260625_add_pilotage_mollie/migration.sql`
- `backend/src/abonnements/abonnement.service.ts` — réécrit (Mollie checkout/webhook/trial/cancel)
- `backend/src/abonnements/abonnement.controller.ts` — réécrit (+checkout, +trial, +annuler)
- `backend/src/abonnements/webhook.controller.ts` — créé (public, sans guards)
- `backend/src/abonnements/dto/checkout-abonnement.dto.ts` — créé
- `backend/src/abonnements/abonnement.module.ts` — réécrit (2 controllers)
- `docs/commercial/MONETISATION_PLAN.md` — pricing v3, décisions, questions tranchées

---

## SESSION 25/06/2026 — 7 commits (antérieurs)

### Chantier 1 — Email logging : couverture complète (9/9)

Fichier unique : `backend/src/devis/devis.service.ts`. Tous les flux d'email/activité du cycle de vie d'un devis loguent désormais une `ActiviteClient` avec `sejourId` colonne directe + metadata enrichie.

| # | Flux | Changement |
|---|------|-----------|
| 1 | `envoyerDevisDirect()` | déjà OK |
| 2 | `genererConventionScolaire()` | déjà OK |
| 3 | `signerDevisDirect()` | Ajout `sejourId` colonne |
| 4 | `annulerDevis()` | Bascule sur `sejourCibleId` (couvre COLLAB) + `sejourId` + `userId` |
| 5 | `create()` (collab) | Nouveau bloc CRM (skip si client non rattaché) |
| 6 | `signerDevis()` (direction collab) | Nouveau bloc CRM type SIGNATURE |
| 7 | `uploadSignatureDocument()` | Nouveau bloc CRM type SIGNATURE |
| 8 | `notifierEnseignantModification()` | Nouveau bloc CRM type EMAIL |
| 9 | `updateDevis()` (inline email auto) | Log CRM dans le if après envoi effectif |
| 10 | `uploadSignaturePublic()` | Nouveau bloc CRM type SIGNATURE |
| 11 | `envoyerADirection()` | Nouveau bloc CRM type EMAIL |

### Chantier 2 — Modification devis SELECTIONNE/SIGNE_DIRECTION

Bouton "Modifier" visible pour SELECTIONNE et SIGNE_DIRECTION sans facture d'acompte, en DIRECT et COLLAB. Condition `!factureAcompte` évite le chevauchement avec "Ajuster avant solde". Backend acceptait déjà ces statuts. Fix frontend uniquement.

### Chantier 3 — Signature direction hébergeur (hors plateforme)

Use case : directeur envoie devis signé par email → hébergeur l'enregistre dans LIAVO.

- **Backend** : `POST /devis/:id/marquer-signe` (HEBERGEUR, FileInterceptor). Ownership centreId, statut SELECTIONNE requis, PDF optionnel, nom signataire optionnel. Passe devis à SIGNE_DIRECTION, mute séjour, log CRM.
- **Frontend** : bouton violet "Enregistrer la signature direction" dans section COLLAB hébergeur. Formulaire inline : nom signataire + upload PDF optionnel.

### Chantier 4 — Fix getBudgetData (bug pré-existant COLLAB)

`getBudgetData()` dans `collaboration.service.ts` filtrait `statut: 'SELECTIONNE'` uniquement. Après signature direction ou facturation → devis invisible. Fix : `{ in: ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'] }`.

### Chantier 5 — Endpoint unifié + refactoring TabDevisFacturation

**Problème éliminé** : devis chargé par deux chemins incompatibles (DIRECT : `GET /devis/mes-devis` + filtre client ; COLLAB : `GET /collaboration/:id/budget` + filtre statut restrictif).

- **Backend** : `GET /devis/sejour/:sejourId` — endpoint unique, `findFirst` avec `OR: [{ sejourDirectId }, { demande: { sejourId } }]`, ownership centreId, include calqué sur `getMesDevis`.
- **Frontend** : `TabDevisFacturation.tsx` — un seul state `devis`, un seul `useEffect`, un seul `reloadDevis()`. Suppression de `directDevis` + `budgetData.devis`. `activeDevisForFacturation` simplifié. Résultat net : −28 lignes.
- **Props non utilisées restantes** : `budgetLoading` et `onBudgetReload` — cleanup avec `page.tsx` en dette technique.

### Commits

| Commit | Message |
|---|---|
| *(hash)* | `feat(backend): email logging complet — 9 flux CRM couverts` |
| `adc62bb` | `fix(frontend): bouton Modifier devis visible pour SELECTIONNE/SIGNE_DIRECTION sans facture` |
| `03f3ec5` | `feat(backend): endpoint marquer-signe — signature direction hors plateforme` |
| `01a36ae` | `feat(frontend): hébergeur peut enregistrer signature direction hors plateforme` |
| `045a12d` | `fix(backend): getBudgetData inclut devis SIGNE_DIRECTION et facturés` |
| `2fc17b5` | `feat(backend): GET /devis/sejour/:sejourId — endpoint unifié DIRECT + COLLAB` |
| `bebf817` | `refactor(frontend): TabDevisFacturation — source de données unifiée` |

---

## COMMITS SESSION 23/06/2026

| Commit | Description |
|---|---|
| `391291f` | feat(auth): LOT 4a Phase 3 backend — `auth-cookies.ts` helper, `setAuthCookies` sur register |
| `28cb4da` | fix(auth): LOT 4a Phase 2 frontend — proxy rewrite, suppression js-cookie, DashboardShell migré |
| `5436632` | fix(ux): modal guard — 17 modales formulaire protégées |
| `2a16ad3` | feat(devis): catalogue suggestions complémentaire + TVA par ligne + `CatalogueSuggestionInput.tsx` |
| `3758f12` | feat(sejour): accompagnants à la création séjour DIRECT |
| `bb1e848` | fix(ux): bouton retour intelligent — `router.back()` + fallback |
| `aeb7ba0` | feat(planning): overlay jours fériés FR + vacances scolaires 2025-2027 |
| `6fc6e0b` | feat(backend): emails dans timeline — enrichissement metadata + fix sejourId colonne |
| `e897baf` | feat(ux): timeline cliquable — entries email expandables |

---

## ÉTAT PROD AU 25/06/2026

### Monétisation — Mollie SEPA (MRR actuel : 0€)

**Backend complet, frontend à faire.**

| Lot | Commit | Description |
|---|---|---|
| 1 | d90757a | Migration Prisma : enum PILOTAGE + champs Mollie (mollieCustomerId, mollieSubscriptionId, mollieMandatId, trialStartedAt) |
| 2 | 06e9860 | Service Mollie : checkout (customer + first payment SEPA), webhook (activation + subscription récurrente + prolongation), annuler |
| 3 | b271b0c | Trial 30j Pilotage : activerTrial + getStatut enrichi (isTrial, trialExpire) |
| 3b | c6a9b3b | Fix edge cases : annulation upgrade mid-cycle, prolongation récurrente max(exp,now), trialUsed |
| SQL | — | UPDATE 4 centres existants : trial_started_at = created_at (Choucas, Alticlub, Florimont, YAKA) |
| Fix | (à pousser) | FacturePdfLink → SecureFileLink (AccessDenied OVH privé) |

**Env vars Scalingo configurées** : MOLLIE_API_KEY (test), MOLLIE_WEBHOOK_SECRET, BACKEND_URL=https://api.liavo.fr

**Pricing v3 validé** (docs/commercial/MONETISATION_PLAN.md) :
- Essentiel : 29€/mois ou 290€/an
- Complet : 49€/mois ou 490€/an
- Pilotage : 69€/mois ou 690€/an
- Centre supp : 39€/mois ou 390€/an
- Remise annuelle ~17% = 2 mois offerts
- TVA : franchise de base art. 293 B CGI
- Trial : 30j Pilotage, blocage souple à expiration
- Upgrade mid-cycle : nouveau prix au prélèvement suivant
- Downgrade : sur demande manuelle, fin de période, données lecture seule

**Décisions PSP** : Mollie (NL, agréé ACPR). SEPA Core prélèvement auto. Tarif 0,35€/transaction. Stripe écarté (souveraineté), PayPlug écarté (pas SEPA B2B natif).

### Sécurité

Tous findings fermés (CRITIQUE 6/6, HAUTE 10/10, MOYENNE 14/14, BASSE 4/4). LOT 4a terminé. Reste LOT 6 maintenance.

### Email logging

9/9 flux couverts. Timeline "Notes & suivi" complète.

### Architecture devis

`GET /devis/sejour/:sejourId` remplace les deux chemins divergents. `TabDevisFacturation` consomme un seul état.

### Bugs connus restants

- FacturePdfLink AccessDenied → fix en cours (SecureFileLink)
- Props non utilisées : `budgetLoading`/`onBudgetReload` dans TabDevisFacturation
- Dashboard hébergeur : essaiActif hardcodé sur COMPLET → doit accepter PILOTAGE
- PricingTable.tsx : 3 plans au lieu de 4, prix obsolètes (Complet à 59€)
- Page abonnement : mailto au lieu de checkout Mollie
- Admin : pas d'onglet Abonnements ni Factures LIAVO
- Pas de PlanGuard backend (blocage souple frontend uniquement)
- Multi-centre : ajout post-souscription ne met pas à jour la subscription Mollie (gestion manuelle)
- Pas de cron expiration (getStatut calcule dynamiquement, incohérence en base)
- Pas de notification pré-renouvellement annuel

### Clients

- **Sauvageon** : client ancre, gratuit, Découverte. Ne PAS activer de trial.
- **Les Choucas** : signé 17/06, Complet actif jusqu'au 17/07/2026. **Deadline la plus proche.** trial_started_at migré.
- **Alticlub** : Complet actif jusqu'au 10/09/2026. trial_started_at migré.
- **Pôle Montagne** (Yves Massard) : Florimont + YAKA Complet actif jusqu'au 01/12/2026. 49€ + 39€ = 88€/mois (ou 880€/an). trial_started_at migré. Nants : user_id NULL, PENDING.
- **LMDJ** : en veille stratégique, CA 30/06.

---

## ÉCHÉANCES

| Date | Événement |
|---|---|
| **30/06** | CA LMDJ — pitch partenariat |
| **17/07** | **Fin trial Les Choucas — deadline paiement opérationnel** |
| **10/09** | Fin trial Alticlub |
| **01/09/2026** | Obligation réception e-invoicing (Factur-X validé) |
| **01/12/2026** | Fin trial Pôle Montagne |
| 31/12/2026 | Clôture 1er exercice LIAVO SASU |

---

## PROCHAINS CHANTIERS (par priorité)

### 1. Monétisation — Frontend + Admin (PRIORITÉ ABSOLUE → deadline 17/07)

- [ ] **Fix FacturePdfLink** → SecureFileLink (prompt CC prêt)
- [ ] **PricingTable v2** : 4 plans, prix corrects (29/49/69 mensuel, 290/490/690 annuel), toggle mensuel/annuel
- [ ] **Page abonnement hébergeur** : checkout Mollie (redirect), statut abonnement, liste factures LIAVO
- [ ] **Bannière trial dashboard** : supporter PILOTAGE (plus hardcodé COMPLET), CTA insistant fin de trial
- [ ] **Admin abonnements** : tableau tous centres + plan + statut + dates + actions manuelles
- [ ] **Admin factures LIAVO** : liste factures émises + export CSV
- [ ] **Métriques conversion** : trial → payant, centres expirés sans conversion
- [ ] **Facturation LIAVO→hébergeur** : table factures_liavo, génération PDF (pattern Factur-X, séquence FL-), stockage OVH, email post-webhook
- [ ] **Cron alertes** : emails hebdo J-21/J-14/J-7/J-1 avant expiration trial

### 2. Sécurité — LOT 6 maintenance

- [ ] 6m : CORS_ORIGIN fallback → FRONTEND_URL
- [ ] 6o : 3 iframes src=URL OVH privée → useSecureUrl
- [ ] 6n : lierCompte token expiration
- [ ] H1-H9 : checklist hors-code

### 3. Features produit

- [ ] Module pilotage hébergeur (CA, taux occupation, marges)
- [ ] Chantier UX séjour (ARCHITECTURE_UX_SEJOUR_FINAL.md — ~7j)
- [ ] CRM pipeline dérivé (statut calculé, kanban 5 colonnes)
- [ ] Planning couleurs par statut (5 statuts facturation)

### 4. Dette technique

- [ ] Cleanup props `budgetLoading`/`onBudgetReload` dans TabDevisFacturation + page.tsx
- [ ] Fusionner 3 DevisBuilder dupliqués (1-2j)
- [ ] Découper `sejour/[id]/page.tsx` (~3 200 lignes)
- [ ] DashboardShell unification (4-6j)

---

## STACK & COMMANDES

- **Backend** : NestJS 11, Prisma, PostgreSQL 17, Scalingo Paris
- **Frontend** : Next.js 15, React 19, TypeScript 5, Tailwind 4, Scalingo Paris
- **Stockage** : OVH Object Storage Gravelines
- **Emails** : Brevo FR
- **Repo** : `C:\Users\Roche-Loison\Desktop\sejour-jeunesse`
- **CC** : `cd C:\Users\Roche-Loison\Desktop\sejour-jeunesse && claude`
- **SQL prod** : `scalingo --app liavo-backend --region osc-fr1 pgsql-console`
- **Déploiement** : auto sur push main
