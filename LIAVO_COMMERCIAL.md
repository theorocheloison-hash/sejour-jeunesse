# LIAVO — Stratégie commerciale
> Dernière mise à jour : 2 avril 2026

---

## Contacts clés

| Personne | Rôle | Organisation | Email | Notes |
|---|---|---|---|---|
| Anaïtis Mangeon | Directrice | LAMDJ (La Montagne des Juniors) | contact@lamdj.com | Prescriptrice principale, a invité Robin |
| Isabelle Louat | CDI | LAMDJ | isabelle.louat@lamdj.com | Gère la centrale manuellement |
| Marie Charvolin | CDI | LAMDJ | marie.charvolin@lamdj.com | Gère la centrale manuellement |
| Robin Baladi | Directeur | IDDJ (Isère Drôme Destination Juniors) | robin@iseredrome-juniors.fr | Observateur critique, a répondu en 19h |

---

## Démo commune LAMDJ + IDDJ

**Date :** 28 avril après-midi (à confirmer par Anaïtis — 30 avril en alternative)
**Format :** Visio

### Données APIDAE disponibles

| Réseau | apiKey | projetId | selectionId | Statut |
|---|---|---|---|---|
| IDDJ | mr8RQgOh | 3217 | 67523 | ✅ Importé en base (54 centres) |
| LMDJ | — | — | — | ⏳ En attente réponse Anaïtis |

**Variables Railway à poser dès réception credentials LMDJ :**
- `APIDAE_LMDJ_API_KEY`
- `APIDAE_LMDJ_PROJET_ID`
- `APIDAE_LMDJ_SELECTION_ID`

**Prompt CC prêt :** ajouter entrée `LMDJ` dans le `CREDENTIALS` map de `syncApidae()` dans `backend/src/admin/admin.service.ts`. Modification strictement limitée au map, rien d'autre.

### Données terrain IDDJ (Robin)
- 200 demandes/an
- 20% de concrétisation déclarée (40 séjours réellement finalisés)
- 30% des adhérents n'utilisent pas la plateforme mais paient quand même
- Tarif actuel adhérents : 325€ fixe + 3,25€/lit/an
- Suivi à 30 jours manuel, reporting mensuel centres manuel
- Flux : enseignant recherche → diffusion auto centres → réponse email type + devis → direct. IDDJ relance à 30j.

### Données terrain LAMDJ
- 109 hébergeurs (Savoie + Haute-Savoie), 195 adhérents totaux
- 503 demandes via centrale en 2024 (89% du total)
- 564 demandes totales 2024 : 244 scolaires + 269 colonies + 51 groupes adultes
- Résultat 2024 : -11 010€. Budget : 279K€ dont 52% masse salariale
- Plateforme `adherent.lamdj.com` : Rails ~2015-2018, quasi-amortie (55K€ brut / 4,7K€ net)
- Flux : demandes enseignants → centrale LAMDJ valide manuellement → accès coordonnées centres

### Objectifs de la démo (par ordre de priorité)
1. **Non-négociable** : obtenir un engagement concret daté avant de raccrocher (next step, pas "on réfléchit")
2. **Prioritaire** : qualifier Robin — allié, neutre, ou frein ?
3. **Important** : faire toucher leurs propres données dans l'interface (dashboard IDDJ live, LMDJ si credentials reçus)

### Ce qui n'est PAS un objectif de cette démo
- Closer le pricing
- Présenter toutes les fonctionnalités
- Critiquer leur plateforme actuelle

### Structure de la démo (60 min max)
1. **Ouverture (10 min)** — questions sur flux actuels et points de friction. Ne pas parler de LIAVO.
2. **Démo (25 min)** — flux enseignant → hébergeur → validation directeur → dashboard collaboratif pré-rempli (séjour Sauvageon) → constructeur devis avec catalogue → facture. Puis dashboard réseau avec données APIDAE réelles.
3. **Questions / échanges (15 min)**
4. **Proposition (10 min)** — seulement si signal d'intérêt explicite.

### Séjour démo pré-créé
Classe de montagne 5ème B — Morillon 2026, Chalet Le Sauvageon. Script SQL : `scripts/seed-demo-sejour.sql`. Contient planning complet, accompagnateurs, autorisations parentales, devis avec lignes détaillées, messagerie.

### Points de vigilance en démo
- Ne jamais soulever le coût de la plateforme Rails LAMDJ en démo — uniquement en one-to-one avec Anaïtis post-démo si intérêt confirmé
- Préserver les rôles d'Isabelle et Marie dans le pitch — ne pas suggérer que LIAVO les remplace
- Chorus Pro : ne pas promettre une démo live (SIRET non encore assigné, PISTE non enregistré)
- Supprimer toute formulation défensive type "qui n'engage rien financièrement je vous rassure"

---

## Arguments commerciaux réseau (par interlocuteur)

### Argument 1 — Pour Anaïtis et Robin (directeurs de réseau)
**"Un outil de pilotage réel, pas un tableur."**
Aujourd'hui IDDJ a 80% d'opacité post-demande, un reporting mensuel manuel, 30% de non-utilisation invisible. LAMDJ connaît ses volumes mais pas ce qui se passe après la mise en relation. LIAVO leur donne un dashboard live : taux de réponse, taux de concrétisation, CA réseau, scoring d'activation centre par centre, filtres par période. Des données qu'ils n'ont qu'à moitié aujourd'hui, disponibles en temps réel sans relancer personne.

### Argument 2 — Pour Isabelle et Marie (CDI LAMDJ, absentes de la décision mais présentes dans la tête d'Anaïtis)
**"LIAVO n'automatise pas leur rôle — il automatise ce qui l'encombre."**
Les relances manuelles, la collecte de données, la validation administrative disparaissent. Isabelle et Marie se concentrent sur ce que la machine ne peut pas faire : accompagnement pédagogique, relation hébergeurs, conseil aux enseignants. Le pitch doit le dire explicitement en démo.

### Argument 3 — Pour les hébergeurs adhérents (absents de la salle, présents dans la tête des directeurs)
**"Le réseau offre en Y1 un outil qui n'existe pas sur le marché."**
Appel d'offres numérique, constructeur de devis avec catalogue, dashboard collaboratif séjour, facturation Chorus Pro — rien de comparable n'existe dans le marché des séjours scolaires EN. Ce n'est pas une mise à jour de la plateforme existante, c'est un saut de génération. Pour les centres non-adhérents, le tarif réseau devient une raison de rejoindre LAMDJ ou IDDJ. Le réseau gagne en attractivité sans investissement supplémentaire.

### Argument 4 — L'argument institutionnel (à sortir en dernier, si le signal est bon)
**"Vous co-construisez la plateforme nationale, pas une solution locale."**
LAMDJ et IDDJ ont l'opportunité d'être les réseaux fondateurs d'une plateforme qui a vocation à être déployée à l'échelle nationale et intégrée aux académies. Être premiers, c'est peser sur le roadmap, pas subir une solution imposée par le haut. Formuler avec conviction, jamais au conditionnel.

### Ce qu'il ne faut pas dire
- "Faciliter l'accès pour les enseignants" — trop loin de leurs préoccupations directes. Reformuler : "réduire le temps de traitement d'une demande pour votre équipe et vos hébergeurs"
- "Qui sera peut-être déployée dans toute la France" — le conditionnel tue l'argument. Conviction ou silence.
- Toute formulation qui suggère que leur plateforme actuelle est mauvaise

---

## Pricing hébergeurs

### Plans

| Plan | Tarif mensuel | Tarif annuel | Économie annuel |
|---|---|---|---|
| **Découverte** | Gratuit | Gratuit | — |
| **Essentiel** | 29€ HT/mois | 290€ HT/an | 58€ (2 mois offerts) |
| **Complet** | 59€ HT/mois | 590€ HT/an | 118€ (2 mois offerts) |

### Contenu des plans

**Découverte — Gratuit**
- Création compte et profil public du centre
- Visibilité des demandes de séjour sur sa zone géographique
- Pas de réponse possible aux demandes

**Essentiel — 29€ HT/mois**
- Tout Découverte
- Réponse aux demandes
- Constructeur de devis avec catalogue produits
- Signature directeur électronique
- Génération facture
- Export Chorus Pro

**Complet — 59€ HT/mois**
- Tout Essentiel
- Dashboard collaboratif séjour (planning, messagerie, documents, participants)
- CRM hébergeur (gestion clients, contacts, rappels)

### Tarif réseau partenaire (LAMDJ / IDDJ)

- **Y1 (2026)** : accès gratuit plan Complet pour tous les hébergeurs du réseau, dans le cadre d'un accord de partenariat **signé** précisant les conditions Y2
- **Y2 (2027+)** : tarif grand public (à renégocier selon traction)
- **Commission réseau** : 10% sur chaque abonnement actif des hébergeurs de leur réseau, reversée mensuellement
  - Sur Essentiel : 2,90€/centre/mois
  - Sur Complet : 5,90€/centre/mois
  - Sur 100 centres actifs : 290-590€/mois par réseau

⚠️ **Point de vigilance** : la gratuité Y1 doit être conditionnée à un accord signé avec clause de bascule Y2. Sans document, aucun levier de renouvellement.

---

## Positionnement deals réseaux

### Hiérarchie de statut (à maintenir en démo)
- LAMDJ = **réseau fondateur** : accès prioritaire nouvelles fonctionnalités, co-construction roadmap, tarif fondateur garanti 2 ans
- IDDJ = **réseau partenaire** : mêmes fonctionnalités, statut distinct

Ne pas mettre en concurrence explicite. La distinction est symbolique mais réelle.

### Argument LIAVO pour les réseaux (au-delà de la commission)
LIAVO devient un outil de **recrutement de nouveaux membres** : un hébergeur non-adhérent qui veut le tarif réseau doit passer par LAMDJ ou IDDJ. Le réseau gagne des membres, LIAVO gagne des centres.

### Ce qu'on ne sait pas encore (à qualifier en démo)
- Taux de concrétisation réel côté LAMDJ (503 demandes connues, séjours finalisés inconnus)
- Budget maintenance annuel plateforme Rails LAMDJ (à poser en one-to-one post-démo)
- Profil exact de Robin : décideur autonome ou dépendant de son CA ?
- Credentials APIDAE LMDJ (en attente Anaïtis)

---

## Séquence de revenus (prévisionnel Réseau Entreprendre)

| Scénario | Hypothèse | ARR fin Y1 | ARR fin Y2 |
|---|---|---|---|
| Pessimiste | 15% activation LAMDJ+IDDJ ≈ 27 centres × 29€ | ~9 400€ | ~18 000€ |
| Médian (cible) | 40% activation ≈ 72 centres + 20 directs | ~25 000€ | ~36 000€ |
| Haut | 150+ centres actifs × 35€ moyen | — | ~54 000€ |

Seuil rentabilité opérationnelle : ~30-35 centres actifs (infra ≤ 150€/mois).

---

## Séquence de financement

1. **Initiative Faucigny Mont-Blanc** — prêt taux zéro, Théo CA membre. Immédiat.
2. **Start-up & Go Emergence** — post-SIREN (SIREN obtenu, SIRET en attente INSEE)
3. **Réseau Entreprendre Haute-Savoie** — ~6 mois avec traction LAMDJ/IDDJ
4. **BPI** — 12-18 mois avec pilote rectorat. Pas avant.

---

## Comptes démo

| Email | Rôle | Mot de passe | Notes |
|---|---|---|---|
| demo-lmdj@liavo.fr | RESEAU | LMDJ2026! | reseauNomComplet = La Montagne des Juniors |
| enseignant@test.fr | TEACHER | Test1234! | UAI 0750001A — Collège Victor Hugo Paris |
| directeur@test.fr | DIRECTOR | Test1234! | |
| contact@chalet-sauvageon.fr | VENUE | Test1234! | Sauvageon tagué reseau=LMDJ |
| admin@sejour-jeunesse.fr | ADMIN | Admin2026! | |
