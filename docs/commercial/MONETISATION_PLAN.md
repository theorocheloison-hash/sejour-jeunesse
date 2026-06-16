# LIAVO — Plan de monétisation : Pricing, Gating & Paiement

> **Rédigé le 11/06/2026** — Document de cadrage complet
> **Statut** — Grille pricing validée par Théo. Aucun code modifié.
> **Référence complémentaire** — `docs/commercial/BUSINESS_MODEL.md` (modèle historique)
> **Prochaine étape** — Choix du prestataire de paiement puis implémentation

---

## 1. Grille tarifaire validée

### 1.1 Plans

| | Découverte | Essentiel | Complet | Pilotage |
|---|---|---|---|---|
| **Prix mensuel HT** | 0€ | 39€ | 59€ | 79€ |
| **Prix annuel HT** | 0€ | 32€/mois (390€/an) | 49€/mois (590€/an) | 66€/mois (790€/an) |
| **Remise annuelle** | — | ~17% (2 mois offerts) | ~17% | ~17% |

Pilotage = palier tout inclus (inclut toutes les features Complet + module pilotage). Ce n'est PAS un add-on facturé en plus du Complet.

### 1.2 Multi-centre

- Disponible uniquement à partir du plan **Complet**
- Prix : **+39€ HT/mois par centre supplémentaire**
- Le centre supplémentaire hérite du plan de l'hébergeur (Complet ou Pilotage)
- Pas de remise dégressive pour le moment (à réévaluer à 5+ centres)

### 1.3 Remise annuelle

17% de remise (~2 mois offerts) sur tous les plans payants. À réévaluer si le taux de churn annuel dépasse 15%.

---

## 2. Matrice de gating par plan

### 2.1 Features par plan

| Feature | Découverte | Essentiel | Complet | Pilotage |
|---|---|---|---|---|
| Profil public catalogue | ✅ | ✅ | ✅ | ✅ |
| Disponibilités | ✅ | ✅ | ✅ | ✅ |
| Visibilité demandes (aperçu) | ✅ | ✅ | ✅ | ✅ |
| Réponse PDF (adhérents LMDJ only) | ✅ | — | — | — |
| Voir coordonnées enseignant | ❌ | ✅ | ✅ | ✅ |
| Répondre aux demandes (outil LIAVO) | ❌ | ✅ | ✅ | ✅ |
| Devis structurés + envoi | ❌ | ✅ | ✅ | ✅ |
| Signature électronique | ❌ | ✅ | ✅ | ✅ |
| Facturation (acompte, solde) | ❌ | ✅ | ✅ | ✅ |
| Chorus Pro (collectivités) | ❌ | ✅ | ✅ | ✅ |
| Convention séjour scolaire | ❌ | ✅ | ✅ | ✅ |
| CRM clients (pipeline, rappels, kanban) | ❌ | ❌ | ✅ | ✅ |
| Espace collaboratif enseignant | ❌ | ❌ | ✅ | ✅ |
| Documents partagés | ❌ | ❌ | ✅ | ✅ |
| Multi-utilisateur (équipe, permissions) | ❌ | ❌ | ✅ | ✅ |
| Inscription directe participants | ❌ | ❌ | ✅ | ✅ |
| Multi-centre | ❌ | ❌ | ✅ (+39€/centre) | ✅ (+39€/centre) |
| Rentabilité / marges par séjour | ❌ | ❌ | ❌ | ✅ |
| Tableau chiffre d'affaires | ❌ | ❌ | ❌ | ✅ |
| Planning équipes | ❌ | ❌ | ❌ | ✅ |
| Export comptable (futur) | ❌ | ❌ | ❌ | ✅ |

### 2.2 Positionnement des plans

- **Découverte** = vitrine + teaser. L'hébergeur voit qu'il y a des demandes mais ne peut pas agir. Levier de conversion : la frustration de voir sans pouvoir répondre.
- **Essentiel** = "je fais mon devis et ma facture". Outil de gestion solo. Pas de CRM, pas de collab, pas de documents partagés.
- **Complet** = "je gère avec mon équipe et mes clients". CRM, collab, multi-user, multi-centre.
- **Pilotage** = "je pilote mon business". Marges, CA, planning équipe. Pour les gros centres (50+ séjours/an).

### 2.3 Cas spécial : adhérents LMDJ en Découverte

Les adhérents LMDJ paient déjà une cotisation réseau (~28K€/an pour le réseau). En contrepartie :
- Ils **voient les coordonnées enseignant** sur les demandes sourcées LMDJ
- Ils peuvent **répondre via upload d'un devis PDF** (pas l'outil devis structuré LIAVO)
- Cette réponse PDF est traçable dans le dashboard réseau (Marie voit la conversion)
- Mais ils n'ont PAS accès au workflow devis/facturation/signature de LIAVO

**Logique d'acquisition** : l'adhérent LMDJ utilise la réponse PDF, constate la friction (pas de suivi, pas de signature, pas de facturation intégrée), et upgrade vers Essentiel pour le workflow complet.

**Implémentation technique** : nouveau concept "Réponse" sur une demande — fichier PDF uploadé + message libre. Distinct d'un Devis structuré. La condition d'accès est : `centre.reseau` inclut un réseau partenaire ET `planAbonnement === 'DECOUVERTE'`.

### 2.4 Trial / Onboarding

- **Tous les nouveaux hébergeurs** reçoivent un essai gratuit de 30 ou 60 jours (à trancher) sur le plan **Complet**
- Pendant l'essai, accès complet sauf Pilotage
- À l'expiration : retour à Découverte s'ils ne s'abonnent pas
- Yves Massard (Pôle Montagne) : trial 6 mois jusqu'au 01/12/2026, engagement post-trial
- Durée trial à valider : 30j (pousse à décider vite) vs 60j (laisse le temps de faire un séjour complet)

---

## 3. Architecture technique existante

### 3.1 Schema Prisma (déjà en place)

```
enum PlanAbonnement {
  DECOUVERTE    ← plan gratuit par défaut
  ESSENTIEL
  COMPLET
  // PILOTAGE   ← À AJOUTER (migration)
}

enum StatutAbonnement {
  INACTIF       ← jamais eu d'abo, ou expiré
  ACTIF         ← abo en cours
  SUSPENDU      ← paiement échoué
}

enum TypeAbonnement {
  MENSUEL
  ANNUEL
}
```

Champs sur `CentreHebergement` :
- `abonnement` : TypeAbonnement (MENSUEL/ANNUEL)
- `abonnementStatut` : StatutAbonnement (INACTIF/ACTIF/SUSPENDU)
- `abonnementActifJusquAu` : DateTime (date d'expiration)
- `planAbonnement` : PlanAbonnement (DECOUVERTE par défaut)

### 3.2 Backend existant

**Module `abonnements/`** :
- `POST /abonnements/simuler` — active manuellement un abonnement (plan + type → update centre). Utilisé pour activer Yves manuellement.
- `GET /abonnements/statut` — retourne le statut d'abonnement du centre courant.

**Gate existant dans `demande.service.ts` → `findOpen()`** :
```typescript
const accesComplet =
  centre.abonnementStatut === 'ACTIF' &&
  !!centre.abonnementActifJusquAu &&
  centre.abonnementActifJusquAu >= now;
```
Si `accesComplet === false`, l'email enseignant est masqué (seul gate actif aujourd'hui).

### 3.3 Frontend existant

- **Page `/hebergeur/abonnement`** : affiche statut (actif/suspendu/gratuit), PricingTable 3 plans, CTA mailto pour upgrade.
- **Composant `PricingTable.tsx`** : toggle mensuel/annuel, 3 colonnes (Découverte/Essentiel/Complet), bouton upgrade → mailto.
- **Sidebar `HebergeurSidebar.tsx`** : navigation filtrée par permissions module (pas encore par plan).
- **Types frontend `abonnement.ts`** : `PlanAbonnement = 'DECOUVERTE' | 'ESSENTIEL' | 'COMPLET'` (pas de PILOTAGE).

### 3.4 Ce qui manque (à coder)

1. **Migration** : ajouter `PILOTAGE` à l'enum `PlanAbonnement` + champs PSP sur CentreHebergement et/ou User
2. **Prestataire de paiement** : intégration checkout + webhooks + recurring
3. **PlanGuard** (backend) : nouveau guard NestJS `@RequirePlan(PlanAbonnement.ESSENTIEL)` qui vérifie le plan du centre. Hiérarchie : DECOUVERTE < ESSENTIEL < COMPLET < PILOTAGE
4. **Gates sur les endpoints** : appliquer `@RequirePlan` sur ~15-20 endpoints (devis, facturation, CRM, collab, rentabilité, etc.)
5. **Gate sidebar frontend** : masquer les items de navigation selon le plan + afficher CTA upgrade
6. **Concept "Réponse PDF"** : nouveau modèle + endpoint pour les adhérents LMDJ en Découverte
7. **PricingTable v2** : 4 plans, nouveaux prix, bouton checkout au lieu de mailto
8. **CRON facturation** (si PayPlug) : job quotidien pour charger les cartes sauvegardées sur les abonnements à renouveler

---

## 4. Prestataires de paiement — Comparatif

### 4.1 Tableau comparatif

| Critère | Mollie 🇳🇱 | PayPlug 🇫🇷 | GoCardless 🇬🇧 | Frisbii 🇫🇷 | Stripe 🇺🇸 |
|---|---|---|---|---|---|
| **Siège** | Amsterdam | Paris (BPCE) | Londres | Lyon (ex-ProAbono) | San Francisco |
| **Subscriptions API native** | ✅ automatisé | ❌ manuel | ✅ automatisé | ✅ automatisé | ✅ automatisé |
| **SDK Node.js officiel** | ✅ `@mollie/api-client` | ❌ API REST brut | ✅ `gocardless-nodejs` | ❓ à vérifier | ✅ `stripe` |
| **CB européenne** | ✅ | ✅ | ❌ SEPA only | ✅ | ✅ |
| **SEPA prélèvement** | ✅ | ❌ | ✅ (spécialiste) | ✅ | ✅ |
| **Frais transaction CB** | ~1,8% + 0,25€ | ~1,1-1,5% + 0,25€ | N/A | Variable | 1,5% + 0,25€ |
| **Frais SEPA** | ~0,25€ | N/A | 1% + 0,20€ (max 4€) | Variable | 0,35€ |
| **Frais mensuels** | 0€ | 10-30€/mois | 0€ | Variable | 0€ |
| **Webhooks subscription** | ✅ | ❌ (IPN paiement only) | ✅ | ✅ | ✅ |
| **Retry paiement échoué** | ✅ auto | ❌ à coder | ✅ auto | ✅ auto | ✅ auto |
| **Portail client billing** | ❌ | ❌ | ❌ | ✅ portail self-service | ✅ Customer Portal |
| **Données traitées en** | EU (Pays-Bas) | France | EU (UK/Irlande) | France | EU (Irlande) |
| **Souveraineté** | 🟡 EU | 🟢 FR | 🟡 UK/EU | 🟢 FR | 🔴 US/EU |
| **Dev estimé intégration** | ~1,5j | ~4-5j | ~1,5j | ~2j (à confirmer) | ~1,5j |
| **Adapté SaaS B2B récurrent** | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

### 4.2 Analyse détaillée

**Mollie (recommandation #1 si EU acceptable)**

Avantages :
- Subscriptions API native avec auto-scheduling et retry automatique
- SDK Node.js officiel, doc très complète
- SEPA + CB dans la même intégration
- 0 frais fixe, pay-per-use
- 200K+ marchands, solution éprouvée

Inconvénients :
- Néerlandais, pas français (données en EU mais pas en France)
- Pas de portail client self-service (à construire côté LIAVO)
- Pas de gestion native des plans/upgrades/downgrades (à coder côté LIAVO, mais le recurring est géré)

Flux technique :
1. Hébergeur clique "S'abonner" → LIAVO crée un first payment Mollie (CB ou SEPA mandate)
2. Hébergeur paye sur page hosted Mollie → webhook `payment.paid`
3. LIAVO crée une subscription Mollie (intervalle + montant) → Mollie charge automatiquement
4. Webhook `subscription.updated` / `payment.failed` → LIAVO met à jour le statut

**PayPlug (recommandation si FR obligatoire)**

Avantages :
- 100% français (BPCE/Natixis)
- Support français réactif
- Bons taux CB France (connexion réseau CB)
- Simple pour un premier paiement

Inconvénients :
- Pas de subscription management — le billing engine est entièrement à coder côté LIAVO
- Pas de SDK Node.js (appels REST manuels)
- Pas de SEPA
- Frais mensuels (10-30€/mois)
- +3-4j de dev pour le CRON de facturation récurrente, gestion des échecs, relances

Flux technique :
1. Hébergeur clique "S'abonner" → LIAVO crée un payment PayPlug (page hosted)
2. Hébergeur paye → webhook IPN `payment.paid` → carte sauvegardée (token)
3. CRON LIAVO quotidien : vérifie les abonnements à renouveler, crée un payment `initiator: MERCHANT` avec le token
4. Si échec → retry J+3, J+7, puis suspension. Tout à coder.

**GoCardless (bon complément pour SEPA annuel)**

Avantages :
- Spécialiste SEPA Direct Debit, très bien fait
- Frais bas (1% + 0,20€, max 4€/transaction)
- Parfait pour les prélèvements annuels B2B (les hébergeurs sont des pros)
- SDK Node.js officiel
- Mandats + recurring automatique + retry

Inconvénients :
- SEPA uniquement, pas de CB (il faut un 2e PSP pour les CB)
- UK-based (post-Brexit, mais données SEPA traitées en EU)
- Double intégration si combo avec Mollie ou PayPlug

**Frisbii (à creuser)**

Avantages :
- Français (Lyon, ex-ProAbono)
- Pensé spécifiquement pour le SaaS B2B récurrent
- Gestion complète : plans, upgrades, dunning, portail client self-service
- Facturation récurrente automatisée

Inconvénients :
- Communauté plus petite, moins de retours d'expérience
- SDK Node.js non confirmé (à vérifier)
- Pricing non public (contact commercial)
- Risque de dépendance à un petit acteur

**Stripe (benchmark, écarté pour raison de souveraineté)**

Le standard du marché SaaS. Checkout + Billing + portail client + webhooks + SDK Node.js. Intégration la plus rapide (~1,5j). Écarté car société US.

### 4.3 Options hybrides

**Mollie (CB mensuel) + GoCardless (SEPA annuel)** : chaque PSP sur son point fort. Over-engineering pour le volume actuel mais optimal à 50+ clients.

**PayPlug (CB) + virement SEPA manuel (annuel)** : 100% français. L'annuel est géré par facture LIAVO + virement sur IBAN LIAVO. Activation manuelle. 0 frais sur l'annuel.

### 4.4 Classement pour LIAVO

1. **Mollie** — meilleur rapport fonctionnalités/effort. EU, pas FR.
2. **Frisbii** — potentiellement le meilleur choix FR si l'API est propre. À investiguer.
3. **PayPlug + virements manuels** — 100% FR, plus de travail.
4. **GoCardless** — excellent en complément SEPA, pas suffisant seul.

### 4.5 Actions requises avant implémentation

- [ ] Créer un compte test Mollie et évaluer l'API Subscriptions (30 min)
- [ ] Contacter Frisbii pour obtenir la doc API, vérifier SDK Node.js, pricing (1 email)
- [ ] Décider : EU acceptable (→ Mollie) ou FR obligatoire (→ Frisbii ou PayPlug)
- [ ] Créer les produits/prix chez le PSP choisi (mode test)
- [ ] Ajouter les env vars sur Scalingo

---

## 5. Architecture d'implémentation

### 5.1 Modifications schema Prisma

```sql
-- 1. Ajouter PILOTAGE à l'enum
ALTER TYPE "PlanAbonnement" ADD VALUE IF NOT EXISTS 'PILOTAGE';

-- 2. Ajouter les champs PSP sur User (customer = l'hébergeur qui paie)
ALTER TABLE utilisateurs ADD COLUMN psp_customer_id VARCHAR(255);

-- 3. Ajouter les champs PSP sur CentreHebergement (subscription = par centre)
ALTER TABLE centres_hebergement ADD COLUMN psp_subscription_id VARCHAR(255);
ALTER TABLE centres_hebergement ADD COLUMN psp_price_id VARCHAR(255);
```

Stratégie : `pspCustomerId` sur **User** (une entité payante = un hébergeur), `pspSubscriptionId` sur **CentreHebergement** (un abonnement par centre).

### 5.2 Nouveau guard `PlanGuard`

```typescript
// Hiérarchie des plans (ordre croissant de features)
const PLAN_HIERARCHY: Record<PlanAbonnement, number> = {
  DECOUVERTE: 0,
  ESSENTIEL: 1,
  COMPLET: 2,
  PILOTAGE: 3,
};

// Usage: @RequirePlan(PlanAbonnement.ESSENTIEL)
// Vérifie que le centre a un plan >= ESSENTIEL ET statut ACTIF ET non expiré
```

### 5.3 Endpoints à gater

| Endpoint / Controller | Plan minimum requis |
|---|---|
| `GET /demandes/open` (voir email) | ESSENTIEL |
| `POST /demandes/:id/repondre` (réponse structurée) | ESSENTIEL |
| `POST /demandes/:id/reponse-pdf` (upload PDF, LMDJ only) | DECOUVERTE + réseau |
| `POST /devis` (créer) | ESSENTIEL |
| `PATCH /devis/:id` (modifier) | ESSENTIEL |
| `POST /devis/:id/envoyer` | ESSENTIEL |
| `PATCH /devis/:id/facturer-acompte` | ESSENTIEL |
| `PATCH /devis/:id/facturer-solde` | ESSENTIEL |
| `POST /devis/:id/versements` | ESSENTIEL |
| `POST /devis/:id/convention` | ESSENTIEL |
| `GET /clients/*` (CRM) | COMPLET |
| `POST /clients/*` (CRM) | COMPLET |
| `GET /rappels/*` | COMPLET |
| `POST /sejours/:id/messages` | COMPLET |
| `GET /sejours/:id/journal` | COMPLET |
| `POST /centres/:id/collaborateurs` (multi-user) | COMPLET |
| `GET /rentabilite/*` | PILOTAGE |
| `POST /factures-prestataires` | PILOTAGE |
| `GET /pilotage/ca` (futur) | PILOTAGE |
| `GET /pilotage/equipes` (futur) | PILOTAGE |

### 5.4 Sidebar frontend — masquage par plan

| Item sidebar | Plan minimum |
|---|---|
| Tableau de bord | DECOUVERTE |
| Demandes | DECOUVERTE (aperçu) |
| Devis & Facturation | ESSENTIEL |
| Rentabilité | PILOTAGE |
| CRM clients | COMPLET |
| Planning | DECOUVERTE |
| Séjours | DECOUVERTE |
| Catalogue & tarifs | DECOUVERTE |
| Disponibilités | DECOUVERTE |
| Documents | DECOUVERTE |
| Profil | DECOUVERTE |
| Mon équipe | COMPLET |
| Abonnement | DECOUVERTE |

Items masqués → remplacés par un CTA "Disponible avec le plan X" si l'utilisateur tente d'y accéder directement (URL).

### 5.5 Concept "Réponse PDF" (LMDJ Découverte)

Nouveau modèle :
```
model ReponseDemande {
  id          String   @id @default(uuid())
  demandeId   String   @map("demande_id")
  centreId    String   @map("centre_id")
  message     String?  @db.Text
  fichierUrl  String   @map("fichier_url") @db.VarChar(500)
  createdAt   DateTime @default(now())

  demande     DemandeDevis       @relation(...)
  centre      CentreHebergement  @relation(...)

  @@unique([demandeId, centreId])
  @@map("reponses_demandes")
}
```

Endpoints :
- `POST /demandes/:id/reponse-pdf` — upload PDF + message. Condition : centre.reseau inclut un réseau partenaire ET planAbonnement === DECOUVERTE.
- L'enseignant voit la réponse dans son comparatif (PDF téléchargeable, pas de devis structuré).
- Le dashboard réseau compte cette réponse comme une "réponse" dans les KPIs de conversion.

---

## 6. Env vars à configurer (selon PSP choisi)

```bash
# Mollie
MOLLIE_API_KEY=test_xxxxxxxx
MOLLIE_WEBHOOK_SECRET=xxxxx

# OU PayPlug
PAYPLUG_SECRET_KEY=sk_test_xxxxx

# OU Stripe (écarté)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# URLs de redirection
FRONTEND_URL=https://liavo.fr
```

Produits/Prix à créer chez le PSP (mode test puis live) :
- LIAVO Essentiel Mensuel : 3900 centimes (39€)
- LIAVO Essentiel Annuel : 39000 centimes (390€)
- LIAVO Complet Mensuel : 5900 centimes (59€)
- LIAVO Complet Annuel : 59000 centimes (590€)
- LIAVO Pilotage Mensuel : 7900 centimes (79€)
- LIAVO Pilotage Annuel : 79000 centimes (790€)
- Centre supplémentaire Mensuel : 3900 centimes (39€)

---

## 7. Roadmap d'implémentation estimée

| # | Tâche | Estimation | Dépendance |
|---|---|---|---|
| 0 | Choix PSP + création compte + config mode test | 0.5j | Décision Théo |
| 1 | Migration Prisma : enum PILOTAGE + champs PSP | 0.5j | #0 |
| 2 | Backend : PlanGuard + application sur endpoints | 1j | #1 |
| 3 | Backend : intégration PSP (checkout + webhooks) | 1-1.5j (Mollie) / 3-4j (PayPlug) | #1 |
| 4 | Frontend : PricingTable v2 (4 plans, nouveaux prix) | 0.5j | #1 |
| 5 | Frontend : page abonnement + checkout redirect | 0.5j | #3 |
| 6 | Frontend : sidebar gating par plan + pages upgrade CTA | 1j | #2 |
| 7 | Backend + Frontend : concept Réponse PDF (LMDJ) | 1j | #2 |
| 8 | Test end-to-end avec Sauvageon (mode test PSP) | 0.5j | #3, #5 |
| 9 | Passage en mode live PSP + test avec vrai paiement | 0.5j | #8 |

**Total estimé** : ~6-7j avec Mollie, ~9-10j avec PayPlug.

**Chemin critique** : #0 → #1 → #3 → #5 → #8 (checkout fonctionnel en ~3j avec Mollie).

---

## 8. Questions ouvertes

- [ ] **Durée du trial** : 30 jours ou 60 jours ?
- [ ] **Souveraineté** : EU acceptable (→ Mollie) ou FR obligatoire (→ Frisbii/PayPlug) ?
- [ ] **Frisbii** : SDK Node.js ? Pricing ? Qualité API ? → envoyer un email commercial.
- [ ] **Multi-centre annuel** : le +39€/centre est mensuel. En annuel, 39 × 10 = 390€/an/centre supp ? Ou prix différent ?
- [ ] **Upgrade mid-cycle** : prorata ou plein tarif le mois suivant ?
- [ ] **Downgrade** : possible ? Effectif à la fin de la période en cours ?
- [ ] **CRM simplifié dans Essentiel** : rien validé. Mais un hébergeur Essentiel qui fait des devis voudra retrouver ses clients. Risque UX à surveiller.
- [ ] **Licence réseau** : LMDJ pourrait-il payer un forfait LIAVO (inclus dans cotisation) pour offrir un plan Essentiel à ses adhérents ? À explorer post-CA 30/06.

---

## 9. Décisions prises (référence)

| Sujet | Décision | Date |
|---|---|---|
| Nombre de plans | 4 (Découverte, Essentiel, Complet, Pilotage) | 11/06/2026 |
| Pilotage | Palier tout inclus à 79€, pas un add-on | 11/06/2026 |
| Essentiel | 39€/mois (augmenté depuis 29€ du business model initial) | 11/06/2026 |
| Complet | 59€/mois (inchangé) | 11/06/2026 |
| Multi-centre | Complet+ uniquement, +39€/centre supp | 11/06/2026 |
| Remise annuelle | 17% (~2 mois offerts) | 11/06/2026 |
| CRM dans Essentiel | Non. Essentiel = devis + facturation uniquement | 11/06/2026 |
| Documents partagés dans Essentiel | Non. Uniquement avec espace collaboratif (Complet+) | 11/06/2026 |
| Multi-user dans Essentiel | Non. Uniquement Complet+ | 11/06/2026 |
| Adhérents LMDJ Découverte | Réponse PDF + coordonnées enseignant sur demandes LMDJ | 11/06/2026 |
| LMDJ paye LIAVO | Non. Gratuit en échange de l'acquisition masse | 11/06/2026 |
| Stripe | Écarté (souveraineté numérique) | 11/06/2026 |
| Prestataire paiement | À trancher : Mollie (EU) vs Frisbii/PayPlug (FR) | En attente |

---

**Aucun code modifié dans le cadre de ce document.**
