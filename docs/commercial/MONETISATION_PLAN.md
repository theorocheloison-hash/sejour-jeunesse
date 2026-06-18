# LIAVO — Plan de monétisation : Pricing, Gating & Paiement

> **Rédigé le 11/06/2026** — Document de cadrage complet
> **Dernière mise à jour** : 18/06/2026 — Simplification grille tarifaire (tarif unique, suppression distinction mensuel/annuel)
> **Statut** — Grille pricing validée par Théo. Aucun code modifié.
> **Référence complémentaire** — `docs/commercial/BUSINESS_MODEL.md` (modèle historique)
> **Prochaine étape** — Choix du prestataire de paiement puis implémentation

---

## 1. Grille tarifaire validée

### 1.1 Plans

| | Découverte | Essentiel | Complet | Pilotage |
|---|---|---|---|---|
| **Prix HT/mois** | Gratuit | 29 € | 49 € | 69 € |

Tarif unique mensuel. Pas de distinction mensuel/annuel. Pas de remise engagement.

Pilotage = palier tout inclus (inclut toutes les features Complet + module pilotage). Ce n'est PAS un add-on facturé en plus du Complet.

### 1.2 Multi-centre

- Disponible uniquement à partir du plan **Complet**
- Prix : **+39 € HT/mois par centre supplémentaire**
- Le centre supplémentaire hérite du plan de l'hébergeur (Complet ou Pilotage)
- Pas de remise dégressive pour le moment (à réévaluer à 5+ centres)

### 1.3 Historique tarifaire

> **Grille précédente (11/06/2026 → 18/06/2026)** — supprimée pour simplification :
>
> | | Découverte | Essentiel | Complet | Pilotage |
> |---|---|---|---|---|
> | Prix mensuel HT | 0€ | 39€ | 59€ | 79€ |
> | Prix annuel HT | 0€ | 32€/mois (390€/an) | 49€/mois (590€/an) | 66€/mois (790€/an) |
> | Remise annuelle | — | ~17% (2 mois offerts) | ~17% | ~17% |
>
> Raison du changement : trop de complexité (double grille mensuel/annuel), confusion en démo, écart entre le doc et la page live. Simplification en tarif unique.

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

---

## 3. Paiement — Choix du prestataire

### 3.1 Critères de choix

| Critère | Poids | Mollie (NL) | PayPlug (FR) | Frisbii (FR) |
|---|---|---|---|---|
| Souveraineté | ★★★ | 🟡 EU, pas FR | ✅ FR | ✅ FR |
| SDK Node.js / NestJS | ★★★ | ✅ Excellent | ✅ Bon | ❓ À vérifier |
| Prélèvement SEPA récurrent | ★★★ | ✅ Natif | ✅ Natif | ❓ |
| Tarif (CB) | ★★ | 1.8% + 0.25€ | 1.2% + 0.25€ | ~1.4% |
| Tarif (SEPA) | ★★ | 0.25€ | variable | ❓ |
| Portail client (hébergeur gère ses factures) | ★★ | ✅ | 🟡 Limité | ❓ |
| Webhooks fiables | ★★★ | ✅ | ✅ | ❓ |
| Stripe-like DX | ★ | ✅ (le plus proche) | 🟡 | ❓ |

**Recommandation** : Mollie. Le meilleur DX, SEPA natif, webhooks fiables. EU (pas FR) mais pas de data US.
**Alternative FR** : PayPlug si la souveraineté FR est un impératif client (appels d'offres publics).

### 3.2 Architecture technique

```
Hébergeur clique "Activer plan Complet"
    ↓
Frontend redirige vers Mollie Checkout (hosted page)
    ↓
Paiement réussi → webhook POST /webhooks/mollie
    ↓
Backend met à jour : planAbonnement = COMPLET, abonnementStatut = ACTIF, mollieSubscriptionId = ...
    ↓
Renouvellement automatique mensuel via prélèvement SEPA ou CB récurrente
```

Le checkout Mollie gère les aspects PCI-DSS (pas de numéro de carte sur nos serveurs).

---

## 4. Parcours upgrade en action

### 4.1 Scénarios déclencheurs (par frustration)

| Trigger | Plan actuel | CTA affiché | Plan cible |
|---|---|---|---|
| Hébergeur clique "Répondre" sur une demande | Découverte | "Passez à Essentiel pour répondre" | Essentiel |
| Hébergeur va dans CRM | Découverte / Essentiel | "Le CRM est disponible avec le plan Complet" | Complet |
| Hébergeur invite un collaborateur | Essentiel | "Multi-utilisateur dès le plan Complet" | Complet |
| Hébergeur ouvre Rentabilité | Complet | "Tableaux de bord avancés avec Pilotage" | Pilotage |
| Hébergeur ajoute un 2e centre | Essentiel | "Multi-centre dès le plan Complet" | Complet |

### 4.2 Page d'abonnement (`/dashboard/hebergeur/abonnement`)

Déjà implémentée côté frontend (PricingTable, toggle, boutons "Activer ce plan"). À connecter au PSP.

---

## 5. Concept "Réponse PDF" pour adhérents LMDJ Découverte

Nouveau modèle Prisma :

```prisma
model ReponseDemande {
  id          String   @id @default(uuid())
  demandeId   String
  centreId    String
  fichierUrl  String
  message     String?
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
- LIAVO Essentiel : 2900 centimes (29€/mois)
- LIAVO Complet : 4900 centimes (49€/mois)
- LIAVO Pilotage : 6900 centimes (69€/mois)
- Centre supplémentaire : 3900 centimes (39€/mois)

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
- [ ] **Multi-centre annuel** : le +39€/centre est mensuel. Remise volume à définir.
- [ ] **Upgrade mid-cycle** : prorata ou plein tarif le mois suivant ?
- [ ] **Downgrade** : possible ? Effectif à la fin de la période en cours ?
- [ ] **CRM simplifié dans Essentiel** : rien validé. Mais un hébergeur Essentiel qui fait des devis voudra retrouver ses clients. Risque UX à surveiller.
- [ ] **Licence réseau** : LMDJ pourrait-il payer un forfait LIAVO (inclus dans cotisation) pour offrir un plan Essentiel à ses adhérents ? À explorer post-CA 30/06.

---

## 9. Décisions prises (référence)

| Sujet | Décision | Date |
|---|---|---|
| Nombre de plans | 4 (Découverte, Essentiel, Complet, Pilotage) | 11/06/2026 |
| Pilotage | Palier tout inclus à 69€, pas un add-on | 18/06/2026 |
| **Simplification pricing** | **Tarif unique mensuel, suppression distinction mensuel/annuel** | **18/06/2026** |
| **Essentiel** | **29€ HT/mois (baissé depuis 39€)** | **18/06/2026** |
| **Complet** | **49€ HT/mois (baissé depuis 59€)** | **18/06/2026** |
| **Pilotage** | **69€ HT/mois (baissé depuis 79€)** | **18/06/2026** |
| Multi-centre | Complet+ uniquement, +39€/centre supp | 11/06/2026 |
| Remise annuelle | ~~17%~~ Supprimée — tarif unique | 18/06/2026 |
| CRM dans Essentiel | Non. Essentiel = devis + facturation uniquement | 11/06/2026 |
| Documents partagés dans Essentiel | Non. Uniquement avec espace collaboratif (Complet+) | 11/06/2026 |
| Multi-user dans Essentiel | Non. Uniquement Complet+ | 11/06/2026 |
| Adhérents LMDJ Découverte | Réponse PDF + coordonnées enseignant sur demandes LMDJ | 11/06/2026 |
| LMDJ paye LIAVO | Non. Gratuit en échange de l'acquisition masse | 11/06/2026 |
| Stripe | Écarté (souveraineté numérique) | 11/06/2026 |
| Prestataire paiement | À trancher : Mollie (EU) vs Frisbii/PayPlug (FR) | En attente |

---

**Aucun code modifié dans le cadre de ce document.**
