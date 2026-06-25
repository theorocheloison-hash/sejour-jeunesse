# LIAVO — Plan de monétisation : Pricing, Gating & Paiement

> **Rédigé le 11/06/2026** — Document de cadrage complet
> **Dernière mise à jour** : 25/06/2026 — PSP tranché : Mollie. Pricing mensuel + annuel réintroduit (remise ~17%, prix ronds).
> **Statut** — Grille pricing validée par Théo. Compte Mollie créé. Aucun code modifié.
> **Référence complémentaire** — `docs/commercial/BUSINESS_MODEL.md` (modèle historique)
> **Prochaine étape** — Intégration backend Mollie SEPA + migration Prisma PILOTAGE

---

## 1. Grille tarifaire validée

### 1.1 Plans

| | Découverte | Essentiel | Complet | Pilotage |
|---|---|---|---|---|
| **Mensuel HT** | Gratuit | 29 €/mois | 49 €/mois | 69 €/mois |
| **Annuel HT** | Gratuit | 290 €/an | 490 €/an | 690 €/an |
| **Économie annuelle** | — | 58 € (2 mois offerts) | 98 € (2 mois offerts) | 138 € (2 mois offerts) |

Pilotage = palier tout inclus (inclut toutes les features Complet + module pilotage). Ce n'est PAS un add-on facturé en plus du Complet.

L'hébergeur choisit sa fréquence (mensuel ou annuel) au moment de la souscription. Même mandat SEPA, seule la fréquence de prélèvement change. Prix annuels = montants ronds adaptés aux bons de commande assos/mairies.

### 1.2 Multi-centre

- Disponible uniquement à partir du plan **Complet**
- Prix : **+39 € HT/mois** ou **+390 € HT/an** par centre supplémentaire
- Le centre supplémentaire hérite du plan de l'hébergeur (Complet ou Pilotage)
- Pas de remise dégressive pour le moment (à réévaluer à 5+ centres)
- Exemple Pôle Montagne (Complet + 1 centre supp) : 88 €/mois ou 880 €/an

### 1.3 Historique tarifaire

> **Grille v2 (18/06/2026 → 25/06/2026)** — tarif unique mensuel, pas de distinction mensuel/annuel :
>
> | | Découverte | Essentiel | Complet | Pilotage |
> |---|---|---|---|---|
> | Prix mensuel HT | 0€ | 29€ | 49€ | 69€ |
>
> Raison du changement v3 : réintroduction de l'option annuelle avec prix ronds (290/490/690/390€) pour faciliter les bons de commande assos/mairies. Remise ~17% = 2 mois offerts.

> **Grille v1 (11/06/2026 → 18/06/2026)** — supprimée pour simplification :
>
> | | Découverte | Essentiel | Complet | Pilotage |
> |---|---|---|---|---|
> | Prix mensuel HT | 0€ | 39€ | 59€ | 79€ |
> | Prix annuel HT | 0€ | 32€/mois (390€/an) | 49€/mois (590€/an) | 66€/mois (790€/an) |
>
> Raison du changement v2 : trop de complexité, confusion en démo, prix trop élevés.

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

**Décision : Mollie.** SEPA B2B prélèvement automatique uniquement (pas CB récurrente). 0,25€ fixe par transaction quel que soit le montant — le tarif le plus avantageux sur des montants B2B (ex : 0,04% sur 700€ annuel). EU (NL, agréé ACPR), pas de data US. Mandat électronique natif, nom LIAVO visible sur relevé client. Plafond par défaut 1 000€ — demander extension à 5 000€ dès l'ouverture du compte (pour abonnements annuels Pilotage multi-centre). PayPlug écarté (pas de SEPA B2B natif). Frisbii écarté (API insuffisamment documentée).

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
# Mollie (PSP retenu)
MOLLIE_API_KEY=test_xxxxxxxx
MOLLIE_WEBHOOK_SECRET=xxxxx

# URLs de redirection
FRONTEND_URL=https://liavo.fr
```

Produits/Prix à créer chez le PSP (mode test puis live) :
- LIAVO Essentiel mensuel : 2900 centimes (29€/mois)
- LIAVO Essentiel annuel : 29000 centimes (290€/an)
- LIAVO Complet mensuel : 4900 centimes (49€/mois)
- LIAVO Complet annuel : 49000 centimes (490€/an)
- LIAVO Pilotage mensuel : 6900 centimes (69€/mois)
- LIAVO Pilotage annuel : 69000 centimes (690€/an)
- Centre supplémentaire mensuel : 3900 centimes (39€/mois)
- Centre supplémentaire annuel : 39000 centimes (390€/an)

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

- [x] **Durée du trial** : 30 jours en Pilotage complet.
- [x] **Souveraineté** : EU acceptable → Mollie retenu.
- [x] **Mode de paiement** : SEPA B2B uniquement, mandat électronique Mollie.
- [x] **Multi-centre annuel** : +390€/an/centre supplémentaire.
- [x] **Fréquence** : mensuel + annuel au choix, remise ~17% sur l'annuel.
- [x] **Upgrade mid-cycle** : nouveau prix appliqué au prélèvement suivant, pas de prorata.
- [x] **Downgrade** : possible, sur demande manuelle uniquement (contact LIAVO). Effectif en fin de période. Données en lecture seule sur les modules désactivés.
- [ ] **CRM simplifié dans Essentiel** : rien validé. Mais un hébergeur Essentiel qui fait des devis voudra retrouver ses clients. Risque UX à surveiller.
- [ ] **Licence réseau** : LMDJ pourrait-il payer un forfait LIAVO (inclus dans cotisation) pour offrir un plan Essentiel à ses adhérents ? À explorer post-CA 30/06.

---

## 9. Décisions prises (référence)

| Sujet | Décision | Date |
|---|---|---|
| Nombre de plans | 4 (Découverte, Essentiel, Complet, Pilotage) | 11/06/2026 |
| Pilotage | Palier tout inclus à 69€, pas un add-on | 18/06/2026 |
| **Simplification pricing** | ~~Tarif unique mensuel~~ → réintroduit mensuel+annuel (v3) | 18/06 → 25/06 |
| **Pricing v3** | **Mensuel (29/49/69€) + Annuel ronds (290/490/690€), remise ~17%** | **25/06/2026** |
| **Essentiel** | **29€/mois ou 290€/an** | **25/06/2026** |
| **Complet** | **49€/mois ou 490€/an** | **25/06/2026** |
| **Pilotage** | **69€/mois ou 690€/an** | **25/06/2026** |
| **Centre supp** | **39€/mois ou 390€/an** | **25/06/2026** |
| Remise annuelle | **~17% réintroduite** — prix annuels ronds | 25/06/2026 |
| CRM dans Essentiel | Non. Essentiel = devis + facturation uniquement | 11/06/2026 |
| Documents partagés dans Essentiel | Non. Uniquement avec espace collaboratif (Complet+) | 11/06/2026 |
| Multi-user dans Essentiel | Non. Uniquement Complet+ | 11/06/2026 |
| Adhérents LMDJ Découverte | Réponse PDF + coordonnées enseignant sur demandes LMDJ | 11/06/2026 |
| LMDJ paye LIAVO | Non. Gratuit en échange de l'acquisition masse | 11/06/2026 |
| Stripe | Écarté (souveraineté numérique) | 11/06/2026 |
| Prestataire paiement | **Mollie** (EU/NL, agréé ACPR) | 25/06/2026 |
| Mode de paiement | **SEPA B2B prélèvement automatique uniquement** (pas CB récurrente) | 25/06/2026 |
| **TVA** | Franchise de base art. 293 B CGI (1er exercice LIAVO SASU) | 25/06/2026 |
| **Trial** | 30j Pilotage complet, blocage souple à expiration | 25/06/2026 |
| **Upgrade mid-cycle** | Nouveau prix au prélèvement suivant, pas de prorata | 25/06/2026 |
| **Downgrade** | Sur demande manuelle, fin de période, données en lecture seule | 25/06/2026 |
| **Tarif Mollie SEPA** | **0,35€ fixe par transaction** (SEPA Core) | 25/06/2026 |

---

**Aucun code modifié dans le cadre de ce document.**
