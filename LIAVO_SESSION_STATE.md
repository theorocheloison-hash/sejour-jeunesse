# LIAVO — État session dev
> Dernière mise à jour : 25/06/2026 — Chantier monétisation complet (backend + frontend + PlanGuard). SEPA Mollie via API Mandates.

---

## SESSION 25/06/2026 — Monétisation complète

### Résumé

Chantier complet en une journée : backend Mollie SEPA, frontend checkout par formulaire IBAN (pas de redirect), PricingTable 4 plans, page abonnement, facturation LIAVO→hébergeur (PDF Factur-X réutilisé + email Brevo + stockage OVH), PlanGuard blocage souple, admin abonnements + factures LIAVO + métriques conversion, cron alertes expiration.

### Lots livrés

| Lot | Description |
|---|---|
| Migration Prisma | Enum PILOTAGE + 4 champs Mollie sur CentreHebergement |
| Service Mollie | Checkout SEPA + webhook + subscription récurrente (@mollie/api-client v4.5.0) |
| Trial 30j | activerTrial + getStatut (isTrial, trialExpire, trialUsed) |
| Fix edge cases | Annulation upgrade mid-cycle, prolongation récurrente max(exp,now), trialUsed |
| Lib abonnement | Type AbonnementStatut aligné backend + fonctions souscrire/trial/annuler |
| Bannière trial | Fix hardcode planAbonnement === 'COMPLET' → appel getAbonnementStatut() |
| PricingTable v3 | 4 plans (Découverte/Essentiel/Complet/Pilotage), prix v3 corrects, responsive |
| Page abonnement | Formulaire IBAN inline (pas de redirect Mollie), bandeaux statut, annulation |
| FactureLiavo | Table + service + PDF (réutilise FacturePDF + mentionTVA) + email + webhook |
| Admin abonnements | Onglet tableau + métriques (MRR, trials actifs/expirés, conversion) |
| Admin factures | Onglet factures LIAVO + SecureFileLink PDF |
| Cron alertes | Endpoint POST /admin/cron/alertes-expiration (J-21/14/7/3/1 + expirés + renouvellement annuel) |
| PlanGuard | @RequirePlan decorator + PlanGuard (HEBERGEUR only, GET passent, mutations bloquées) |
| Modal upgrade | PlanInsufficientModal + intercepteur axios 403 PLAN_INSUFFICIENT |
| Fix SEPA | Remplacement sequenceType:'first' (nécessitait CB) par API Mandates (IBAN direct) |

### Décisions prises

- **PSP** : Mollie (NL, ACPR). SEPA Core via API Mandates (pas de redirect, pas de CB).
- **Flow SEPA** : formulaire IBAN côté LIAVO → création mandat + subscription Mollie API → prélèvement auto.
- **Activation optimiste** : grace period 14j à la souscription, le webhook met l'expiration réelle au 1er prélèvement.
- **Pricing v3** : Essentiel 29€/49€/69€ mensuel, 290€/490€/690€ annuel. Multi-centre +39€/mois (Complet+).
- **TVA** : franchise de base art. 293 B CGI. mentionTVA prop ajouté à FacturePDF (backward-compatible).
- **Facturation LIAVO** : séquence FL-YYYY-NNN, SequenceService avec UUID sentinelle 00000000-..., PDF Factur-X réutilisé, stockage OVH factures-liavo/, email Brevo avec PJ.
- **PlanGuard** : blocage souple (lecture seule après expiration). GET/HEAD passent toujours. HEBERGEUR uniquement. Erreur 403 PLAN_INSUFFICIENT avec planRequired/planActuel.
- **Sauvageon** : PILOTAGE gratuit permanent (abonnement_actif_jusqua = 2099-12-31, pas de mandat Mollie).

### Contrôleurs annotés PlanGuard

| Contrôleur | Plan requis |
|---|---|
| devis | ESSENTIEL |
| facture | ESSENTIEL |
| sejours | ESSENTIEL |
| clients | COMPLET |
| activites-client | COMPLET |
| collaboration | COMPLET |
| rentabilite | PILOTAGE |

### Fichiers créés/modifiés principaux

Backend :
- `abonnement.service.ts` — réécrit : souscrire() via Mandates API, webhook simplifié (plus de bloc "first")
- `abonnement.controller.ts` — POST /souscrire remplace POST /checkout
- `dto/souscrire-abonnement.dto.ts` — plan, frequence, iban, titulaire
- `facture-liavo/facture-liavo.service.ts` — genererNumero, emettre, lister, listerToutes
- `facture-liavo/facture-liavo.module.ts` — imports SequenceModule
- `cron-alertes.service.ts` — envoyerAlertes, envoyerAlertesExpires, envoyerAlertesRenouvellement
- `auth/guards/plan.guard.ts` — PlanGuard
- `auth/decorators/plan.decorator.ts` — @RequirePlan
- `facture/pdf/FacturePDF.tsx` — prop mentionTVA (backward-compatible)
- `admin/admin.controller.ts` — GET /abonnements, GET /factures-liavo, GET /metriques-abonnements, POST /cron/alertes-expiration
- `admin/admin.service.ts` — getAbonnements, getFacturesLiavo, getMetriquesAbonnements

Frontend :
- `src/lib/abonnement.ts` — type PILOTAGE + souscrireAbonnement + activerTrial + annulerAbonnement
- `src/lib/admin.ts` — CentreAbonnement + FactureLiavo + getAdminAbonnements + getAdminFacturesLiavo
- `app/components/PricingTable.tsx` — 4 plans, prix v3, responsive, onUpgrade accepte PILOTAGE
- `app/dashboard/hebergeur/abonnement/page.tsx` — formulaire IBAN, bandeaux statut, annulation
- `app/dashboard/hebergeur/page.tsx` — bannière trial via getAbonnementStatut()
- `app/dashboard/admin/page.tsx` — onglets Abonnements + Factures LIAVO + métriques
- `src/components/PlanInsufficientModal.tsx` — modale globale
- `src/lib/api.ts` — intercepteur 403 PLAN_INSUFFICIENT
- `app/dashboard/hebergeur/layout.tsx` — PlanInsufficientModal monté

### Migrations SQL appliquées en prod

```sql
-- Table factures_liavo (appliquée 25/06/2026)
CREATE TABLE "factures_liavo" (...);
CREATE UNIQUE INDEX "factures_liavo_numero_key" ...;
CREATE INDEX "factures_liavo_centre_id_idx" ...;
CREATE INDEX "factures_liavo_date_emission_idx" ...;
ALTER TABLE "factures_liavo" ADD CONSTRAINT ... FOREIGN KEY ...;

-- Champ alerte expiration (appliquée 25/06/2026)
ALTER TABLE "centres_hebergement" ADD COLUMN "dernier_email_alerte_at" TIMESTAMP(3);

-- Sauvageon PILOTAGE permanent (appliquée 25/06/2026)
UPDATE centres_hebergement SET plan_abonnement = 'PILOTAGE', abonnement_actif_jusqua = '2099-12-31' WHERE id = '3a710674-d580-4ffd-9d9a-f739bae82154';

-- Fix migration Prisma marquée failed (appliquée 25/06/2026)
UPDATE _prisma_migrations SET finished_at = NOW(), rolled_back_at = NULL, logs = NULL WHERE migration_name LIKE '%add_facture_liavo%';
```

### Env vars Scalingo

MOLLIE_API_KEY (test), MOLLIE_WEBHOOK_SECRET (inutilisé — Mollie ne signe pas les webhooks), BACKEND_URL=https://api.liavo.fr

---

## ÉTAT PROD AU 25/06/2026

### Monétisation — Mollie SEPA (MRR actuel : 0€)

**Backend + frontend complets. À TESTER end-to-end.**

Flow SEPA :
1. Hébergeur remplit IBAN + titulaire sur /dashboard/hebergeur/abonnement
2. Backend crée customer Mollie + mandat SEPA + subscription
3. Activation optimiste (grace period 14j)
4. Mollie valide le mandat (1-3 jours) puis prélève
5. Webhook : prolonge l'abonnement + émet facture LIAVO (PDF + email)

Pricing v3 :
- Essentiel : 29€/mois ou 290€/an
- Complet : 49€/mois ou 490€/an
- Pilotage : 69€/mois ou 690€/an
- Centre supp : 39€/mois ou 390€/an
- TVA : franchise de base art. 293 B CGI
- Trial : 30j Pilotage, blocage souple à expiration

### Sécurité

Tous findings fermés (LOT 0-5). PlanGuard déployé. LOT 6 maintenance reste.

### Email logging

9/9 flux couverts. Timeline "Notes & suivi" complète.

### Clients

- **Sauvageon** : PILOTAGE gratuit permanent (2099-12-31). Pas de mandat Mollie.
- **Les Choucas** : trial Complet actif. **Deadline 17/07 — premier paiement.**
- **Alticlub** : trial Complet actif jusqu'au 10/09/2026.
- **Pôle Montagne** (Florimont + YAKA) : trial Complet actif jusqu'au 01/12/2026. Nants pending.
- **LMDJ** : en veille stratégique, CA 30/06.

### Bugs connus

- Props non utilisées : `budgetLoading`/`onBudgetReload` dans TabDevisFacturation
- Multi-centre : ajout post-souscription ne met pas à jour la subscription Mollie (gestion manuelle)
- MOLLIE_WEBHOOK_SECRET en env var mais non vérifié (Mollie ne signe pas — variable inutile)

---

## ÉCHÉANCES

| Date | Événement |
|---|---|
| **26/06** | **TEST END-TO-END Mollie SEPA** (formulaire IBAN → mandat → subscription → webhook) |
| **30/06** | CA LMDJ — pitch partenariat |
| **17/07** | **Fin trial Les Choucas — deadline paiement opérationnel** |
| **10/09** | Fin trial Alticlub |
| **01/09/2026** | Obligation réception e-invoicing (Factur-X validé) |
| **01/12/2026** | Fin trial Pôle Montagne |
| 31/12/2026 | Clôture 1er exercice LIAVO SASU |

---

## PROCHAINS CHANTIERS (par priorité)

### 1. Test Mollie end-to-end (PRIORITÉ ABSOLUE)
- [ ] Tester le formulaire IBAN avec un compte Sauvageon ou test
- [ ] Vérifier que le mandat est créé dans Mollie dashboard
- [ ] Vérifier que la subscription est créée
- [ ] Vérifier que le webhook reçoit le paiement (logs Scalingo)
- [ ] Vérifier que la facture LIAVO est émise (PDF + email)
- [ ] Passer MOLLIE_API_KEY de test à live

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
