# LIAVO — Résumé Business Model

> **Dernière mise à jour** : 03/06/2026 — Document confidentiel
> **LIAVO SASU** — SIREN 102 994 910 — RCS Annecy — 472 Route du Mas Devant, 74440 Morillon

---

## Produit

Plateforme SaaS B2B de coordination des séjours jeunesse (classes découvertes, colos) et événements privés (mariages, séminaires). Gère tout le cycle : **devis → signature électronique → facturation → espace collaboratif hébergeur/enseignant** (planning, messagerie, documents, participants).

## Positionnement

**Couche post-mise-en-relation.** On ne remplace pas les réseaux qui mettent en contact hébergeurs et enseignants — on outille la gestion une fois que le contact est fait. Aucun concurrent direct identifié sur ce positionnement en France.

## Cible

Hébergeurs de séjours collectifs (chalets, centres de vacances, villages vacances). Profils variés : sociétés (SAS/SARL), associations loi 1901, collectivités territoriales. Taille typique : 1 à 5 centres, 30 à 150 séjours/an par centre.

---

## Briques de valeur

### 1. Catalogue public de centres
Référence ~650 centres d'hébergement (données Éducation Nationale + réseaux partenaires). Un enseignant recherche un centre par zone, thématique, capacité. L'hébergeur revendique sa fiche pour gérer son profil.

### 2. Appel d'offres / demandes
Un enseignant ou un réseau publie une demande de séjour (dates, effectif, thématique). Les centres éligibles reçoivent la demande et peuvent répondre avec un devis. Le réseau partenaire (LMDJ, IDDJ) peut dispatcher les demandes à ses adhérents.

### 3. Gestion du séjour
Une fois le contact fait, tout le cycle est géré : devis, signature électronique (enseignant + direction), facturation conforme (Factur-X, Chorus Pro pour collectivités), suivi des paiements (acompte, solde, avoirs).

### 4. Espace collaboratif hébergeur/enseignant
Planning d'activités, messagerie, documents partagés, liste des participants, groupes, journal de séjour pour les parents.

### 5. CRM hébergeur
Gestion des clients (prospects, établissements scolaires, CE, associations), pipeline dérivé automatiquement des devis, rappels, activités, import CSV.

### 6. Dashboard réseau
Visibilité post-dispatch pour les réseaux d'hébergeurs (KPIs : conversion, nb élèves, fidélisation enseignants). Le réseau voit sans gérer.

---

## Modèle de revenus

**Abonnement mensuel ou annuel par centre d'hébergement.**

| Plan | Mensuel HT | Annuel HT | Inclut |
|------|-----------|-----------|--------|
| Découverte | Gratuit | Gratuit | Profil public, visibilité demandes |
| Essentiel | 29€/mois | 24€/mois (290€/an) | Devis, facturation, Chorus Pro |
| Complet | 59€/mois | 49€/mois (590€/an) | Tout + collab, planning, CRM |

Annuel = 2 mois offerts (~17% de réduction). Question ouverte : pricing du 2e/3e centre (même hébergeur). Idée initiale : 39€/mois le centre supplémentaire.

### Sources de revenus supplémentaires envisagées

**Académies / collectivités :** faire payer l'académie (ou la DSDEN, ou le département) pour donner accès à la plateforme à tous ses établissements scolaires. Modèle licence institutionnelle : un seul contrat couvre des centaines d'établissements. Le budget séjours scolaires est souvent piloté au niveau académique.

**Réseaux partenaires :** aujourd'hui le dashboard réseau est gratuit (contrepartie = acquisition hébergeurs). Potentiel de monétisation : abonnement réseau, commission par séjour, ou fonctionnalités premium réseau.

**Événements privés :** mariages et séminaires gérés sur la même plateforme. Même pricing ou grille séparée — à définir.

---

## État commercial (03/06/2026)

- 1 centre en production propre (Chalet Le Sauvageon, Morillon — opéré par le fondateur, proof of concept)
- 1 client externe en test 6 mois (Pôle Montagne, 2 centres actifs en Haute-Savoie, engagement abonnement 1-2 centres après le test, trial jusqu'au 01/12/2026)
- 2 réseaux partenaires ciblés : LMDJ (109 centres Savoie/Haute-Savoie, fondateur élu admin du réseau) et IDDJ (54 centres, attentiste post-démo)
- Marché adressable France : ~650 centres référencés au catalogue Éducation Nationale

## Canaux d'acquisition

- Réseaux partenaires (LMDJ, IDDJ) : le réseau recommande LIAVO à ses adhérents
- Catalogue public + SEO : hébergeurs revendiquent leur fiche
- Académies : approche top-down, un contrat = tous les établissements du territoire
- Bouche-à-oreille hébergeurs

---

## Stack technique & outils

**Fondateur solo, pas de salariés.** L'IA (Claude, Anthropic) remplace une équipe dev/product : architecture, code review, prompts de développement, analyse stratégique.

### Frontend
Next.js 15, React 19, TypeScript 5, Tailwind CSS 4. Hébergé sur Scalingo Paris (container M).

### Backend
NestJS 11, Prisma ORM, PostgreSQL 17. Hébergé sur Scalingo Paris (container M + PostgreSQL Starter 512M).

### Infrastructure
- Hébergement : Scalingo (PaaS français, datacenter Paris)
- Stockage fichiers : OVH Object Storage (S3, Gravelines)
- Emails transactionnels : Brevo (serveurs FR)
- DNS + domaine : OVH
- Repo code : GitHub (migration forge française envisagée)
- Facturation : Factur-X intégré, export Chorus Pro (PEPPOL UBL 2.1)

### Outils de développement
- Claude (Anthropic) — plan Max : sparring partner architecture + stratégie, code review, prompts Claude Code
- Claude Code : exécution git, modifications code, déploiements
- VS Code + TypeScript : IDE principal
- Scalingo CLI : déploiement + accès console PostgreSQL

### Conformité & sécurité
- 100% données hébergées en France (Scalingo Paris + OVH Gravelines)
- JWT + bcrypt pour l'authentification
- Facturation conforme Art. L441-9 (mentions légales, numérotation séquentielle, PDF non modifiable, avoirs)
- Signature électronique intégrée (enseignant + direction d'établissement)

---

## Coûts d'infrastructure & outils

| Service | Coût HT/mois | Détail |
|---------|-------------|--------|
| Scalingo | 37,81€ | 2 containers M + PostgreSQL Starter 512M |
| Anthropic (Claude Max) | 90€ | IA dev + architecture + stratégie |
| OVH | ~0€ | Object Storage + DNS + domaine |
| Brevo | 0€ | Free tier (300 emails/jour) |
| GitHub | 0€ | Free tier |
| **TOTAL** | **~128€** | |

**Point d'attention scaling :** Brevo free plafonné à 300 emails/jour (~19€/mois au premier palier payant). Scalingo augmentera avec le trafic. Budget infra estimé à 10-15 clients actifs : ~80-120€ HT/mois hors Anthropic.

---

## Points pricing à explorer

- Freemium → payant : où placer le gate exactement ?
- Multi-centre : dégressif ou pas ?
- Licence académie : quel modèle (par élève, par établissement, forfait annuel) ?
- Réseaux : gratuit vs payant, à quel moment basculer ?
- Événements privés : même grille ou séparée ?
- Paiement : Stripe Checkout prévu avant novembre 2026, SEPA Direct Debit envisagé à 18-24 mois
