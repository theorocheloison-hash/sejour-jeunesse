# LIAVO — Stratégie commerciale
> Dernière mise à jour : 04/05/2026 (post-démo LMDJ+IDDJ 28/04)

---

## Contacts clés

| Personne | Rôle | Organisation | Email | Notes |
|---|---|---|---|---|
| Anaïtis Mangeon | Directrice | LMDJ (La Montagne des Juniors) | contact@lamdj.com | Prescriptrice principale, intéressée post-démo — visio suivi à caler |
| Isabelle Louat | CDI | LMDJ | isabelle.louat@lamdj.com | Gère la centrale manuellement — rôle à préserver dans le pitch |
| Marie Charvolin | CDI | LMDJ | marie.charvolin@lamdj.com | Gère la centrale manuellement — rôle à préserver dans le pitch |
| Robin Baladi | Directeur | IDDJ (Isère Drôme Destination Juniors) | robin@iseredrome-juniors.fr | Attentiste post-démo — CA à consulter |

---

## Résultats démo LMDJ + IDDJ (28/04/2026)

**Format :** Visio commune LMDJ + IDDJ

**LMDJ (Anaïtis Mangeon) :**
- Intéressée
- Prochaine étape : visio de suivi à caler

**IDDJ (Robin Baladi) :**
- Attentiste — doit consulter son CA avant tout engagement
- Pas de frein explicite identifié, pas de signal d'engagement non plus

**Credentials APIDAE :**

| Réseau | apiKey | projetId | selectionId | Statut |
|---|---|---|---|---|
| IDDJ | mr8RQgOh | 3217 | 67523 | ✅ Importé en base (54 centres) |
| LMDJ | — | — | — | ⏳ Non reçus — à demander lors de la visio suivi |

> ⚠️ Variables Scalingo à poser dès réception credentials LMDJ :
> `APIDAE_LMDJ_API_KEY`, `APIDAE_LMDJ_PROJET_ID`, `APIDAE_LMDJ_SELECTION_ID`
> Puis ajouter entrée `LMDJ` dans le `CREDENTIALS` map de `syncApidae()` dans `backend/src/admin/admin.service.ts`

---

## Positionnement validé post-démo

**LIAVO = couche post-mise-en-relation.**
- L'hébergeur invite l'enseignant directement (pas d'appel d'offres via LMDJ)
- LMDJ/IDDJ continuent la mise en relation — LIAVO prend le relais après
- Isabelle/Marie gardent leur rôle : mise en relation, accompagnement, conseil
- Dashboard réseau = visibilité post-dispatch (taux de réponse, taux de concrétisation, CA réseau)
- **Pitch pour la visio suivi LMDJ :** "La plateforme développée par les hébergeurs, pour les hébergeurs."

**Ce qu'il ne faut PAS dire :**
- "Faciliter l'accès pour les enseignants" — trop loin de leurs préoccupations. Reformuler : "réduire le temps de traitement d'une demande pour votre équipe et vos hébergeurs"
- Tout ce qui suggère que la plateforme actuelle est mauvaise
- Toute formulation qui suggère que LIAVO remplace Isabelle et Marie
- "Qui sera peut-être déployée dans toute la France" — conviction ou silence

---

## Données terrain

### IDDJ (Robin Baladi)
- 200 demandes/an
- 20% de concrétisation déclarée (40 séjours réellement finalisés)
- 30% des adhérents n'utilisent pas la plateforme mais paient quand même
- Tarif actuel adhérents : 325€ fixe + 3,25€/lit/an
- Suivi à 30 jours manuel, reporting mensuel centres manuel
- Flux : enseignant recherche → diffusion auto centres → réponse email type + devis → direct. IDDJ relance à 30j.

### LMDJ (Anaïtis Mangeon)
- 109 hébergeurs (Savoie + Haute-Savoie), 195 adhérents totaux
- 503 demandes via centrale en 2024 (89% du total)
- 564 demandes totales 2024 : 244 scolaires + 269 colonies + 51 groupes adultes
- Résultat 2024 : -11 010€. Budget : 279K€ dont 52% masse salariale
- Plateforme `adherent.lamdj.com` : Rails ~2015-2018, quasi-amortie (55K€ brut / 4,7K€ net)
- Flux : demandes enseignants → centrale LMDJ valide manuellement → accès coordonnées centres

---

## Arguments commerciaux réseau

### Pour Anaïtis et Robin (directeurs de réseau)
**"Un outil de pilotage réel, pas un tableur."**
Aujourd'hui IDDJ a 80% d'opacité post-demande, un reporting mensuel manuel, 30% de non-utilisation invisible. LMDJ connaît ses volumes mais pas ce qui se passe après la mise en relation. LIAVO donne un dashboard live : taux de réponse, taux de concrétisation, CA réseau, scoring d'activation centre par centre, filtres par période.

### Pour Isabelle et Marie (CDI LMDJ — absentes de la décision, présentes dans la tête d'Anaïtis)
**"LIAVO n'automatise pas leur rôle — il automatise ce qui l'encombre."**
Les relances manuelles, la collecte de données, la validation administrative disparaissent. Isabelle et Marie se concentrent sur ce que la machine ne peut pas faire : accompagnement pédagogique, relation hébergeurs, conseil aux enseignants. Le pitch doit le dire explicitement.

### Pour les hébergeurs adhérents (absents de la salle, présents dans la tête des directeurs)
**"Le réseau offre en Y1 un outil qui n'existe pas sur le marché."**
Constructeur de devis avec catalogue, dashboard collaboratif séjour, facturation Chorus Pro — rien de comparable n'existe dans le marché des séjours scolaires EN. Pour les centres non-adhérents, le tarif réseau devient une raison de rejoindre LMDJ ou IDDJ.

### L'argument institutionnel (en dernier, si signal positif)
**"Vous co-construisez la plateforme nationale, pas une solution locale."**
LMDJ et IDDJ ont l'opportunité d'être les réseaux fondateurs d'une plateforme nationale intégrée aux académies. Formuler avec conviction, jamais au conditionnel.

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
- Profil public du centre + disponibilités
- Aperçu des demandes (pas de détail enseignant, pas de réponse)

**Essentiel — 29€ HT/mois**
- Tout Découverte
- Détail complet des demandes + réponse
- Constructeur de devis avec catalogue produits
- Signature directeur électronique, génération facture, export Chorus Pro

**Complet — 59€ HT/mois**
- Tout Essentiel
- Dashboard collaboratif séjour (planning, messagerie, documents, participants)
- CRM hébergeur (gestion clients, contacts, rappels)

### Tarif réseau partenaire (LMDJ / IDDJ)

- **Y1 (2026)** : accès gratuit plan Complet pour tous les hébergeurs du réseau, conditionné à un **accord signé** précisant les conditions Y2 — sans document, aucun levier de renouvellement
- **Y2 (2027+)** : tarif grand public (à renégocier selon traction)
- **Commission réseau** : 10% sur chaque abonnement actif des hébergeurs de leur réseau, reversée mensuellement
  - Sur Essentiel : 2,90€/centre/mois
  - Sur Complet : 5,90€/centre/mois
  - Sur 100 centres actifs : 290-590€/mois par réseau

---

## Positionnement deals réseaux

### Hiérarchie de statut
- LMDJ = **réseau fondateur** : accès prioritaire nouvelles fonctionnalités, co-construction roadmap, tarif fondateur garanti 2 ans
- IDDJ = **réseau partenaire** : mêmes fonctionnalités, statut distinct

Ne pas mettre en concurrence explicite. La distinction est symbolique mais réelle.

---

## Ce qu'on ne sait pas encore (à qualifier en visio suivi LMDJ)

- Taux de concrétisation réel côté LMDJ (503 demandes connues, séjours finalisés inconnus)
- Budget maintenance annuel plateforme Rails LMDJ (à poser en one-to-one avec Anaïtis)
- Credentials APIDAE LMDJ
- Calendrier décision côté IDDJ (quand le CA se réunit ?)

---

## Séquence de revenus (prévisionnel)

| Scénario | Hypothèse | ARR fin Y1 | ARR fin Y2 |
|---|---|---|---|
| Pessimiste | 15% activation LMDJ+IDDJ = 27 centres x 29€ | ~9 400€ | ~18 000€ |
| Médian (cible) | 40% activation = 72 centres + 20 directs | ~25 000€ | ~36 000€ |
| Haut | 150+ centres actifs x 35€ moyen | — | ~54 000€ |

Seuil rentabilité opérationnelle : ~30-35 centres actifs (infra ≤ 150€/mois).

---

## Séquence de financement

1. **Initiative Faucigny Mont-Blanc** — prêt taux zéro, Théo CA membre. Immédiat.
2. **Start-up & Go Emergence** — post-SIREN (SIREN obtenu)
3. **Réseau Entreprendre Haute-Savoie** — ~6 mois avec traction LMDJ/IDDJ
4. **BPI** — 12-18 mois avec pilote rectorat. Pas avant.

---

## Comptes démo

| Email | Rôle | Mot de passe | Notes |
|---|---|---|---|
| demo-lmdj@liavo.fr | RESEAU | LMDJ2026! | reseauNomComplet = La Montagne des Juniors |
| enseignant@test.fr | ORGANISATEUR | Test1234! | UAI 0750001A — Collège Victor Hugo Paris |
| directeur@test.fr | SIGNATAIRE | Test1234! | |
| resa@lesauvageon.com | HEBERGEUR | Test1234! | Sauvageon, compte prod hébergeur |
| contact@liavo.fr | ADMIN | Admin2026! | Admin production LIAVO |

---

## Séjour démo pré-créé

Classe de montagne 5ème B — Morillon 2026, Chalet Le Sauvageon.
Script SQL : `scripts/seed-demo-sejour.sql`.
Contient planning complet, accompagnateurs, autorisations parentales, devis avec lignes détaillées, messagerie.
