# LIAVO — Positionnement stratégique & Architecture des flux réseau

> **Rédigé le 10 juin 2026** — Document de cadrage stratégique interne.
> **Statut** — Validé par Théo. Architecture à implémenter.
> **Échéances** — Démo Marie Charvolin 18/06. CA LMDJ 30/06.
> **Référence** — Ce document remplace la section positionnement de `partenariat_LAMDJ_IDDJ.html` et complète `BUSINESS_MODEL.md`.

---

## 0. Contexte décisionnel

### La situation LMDJ au 10 juin 2026

LMDJ est une association fragile financièrement. 71% de ses revenus (183 750€) proviennent de subventions publiques, dont la subvention Savoie annoncée en baisse de 20 000€ en 2026. L'exercice 2025 se clôt sur un déficit de 6 530€ (après un déficit de 11 010€ en 2024). Les membres fondateurs (FDTAS 73, GHC, FDTS 74) sont partis fin 2025. L'équipe permanente compte 5 personnes, a subi des départs difficiles, et manque de temps.

La centrale de demandes — service payant facturé aux hébergeurs adhérents — a généré 28 051€ en 2025 (10,8% des produits) pour 522 demandes accompagnées, en baisse de 7%. Les classes de neige, principal moteur, sont en recul de 38% sur 2 ans.

L'AG du 2 juin 2026 a voté un nouveau modèle de cotisation pour 2027 : adhésion simplifiée (152€ fixe + 3€/lit, plafonné 150 lits) avec la Centrale corrélée à l'adhésion.

Les orientations 2026 de LMDJ sont : (1) élargir le réseau, (2) moderniser les outils et relancer le remplissage, (3) consolider la position institutionnelle.

### Ce que LIAVO apporte dans ce contexte

LIAVO répond directement à l'orientation n°2 de LMDJ : moderniser les outils sans que l'association ait à investir dans du développement technique. LIAVO remplace un stack vieillissant (Rails/jQuery 2.2.4, espace adhérent adherent.lamdj.com) par une plateforme moderne, sans coût pour LMDJ, sans perte de revenu, et avec un gain de temps opérationnel pour l'équipe.

---

## 1. Positionnement — Formulation définitive

### Ce que LIAVO est

LIAVO est l'infrastructure technique qui modernise la centrale de demande des réseaux (LMDJ, IDDJ) et fournit des outils de gestion de séjour aux hébergeurs.

### Ce que LIAVO n'est pas

LIAVO ne remplace pas le rôle humain des réseaux (accompagnement, qualification, conseil, lobbying, animation de réseau). LIAVO ne concurrence pas la centrale — il la modernise. LIAVO ne remplace pas les salariées de la centrale — il leur libère du temps.

### Baseline

*"Du projet pédagogique à la facturation finale."*

### Tagline

*"Coordonnez vos séjours."*

### Résumé en une phrase pour le CA LMDJ

*"LIAVO rend visible la valeur que LMDJ crée — chaque demande réseau est tracée, chaque conversion mesurée, et vos équipes récupèrent du temps pour ce que personne d'autre ne peut faire."*

---

## 2. Architecture des flux

### 2.1 Flux enseignant via réseau (LMDJ/IDDJ)

```
lamdj.com                          liavo.fr
┌──────────────────┐    redirect    ┌──────────────────────────────────────┐
│ "Confier ma      │ ──────────────→│ /appel-offres?source=lmdj            │
│  demande de      │  (lien dédié   │                                      │
│  séjour"         │   ou UTM)      │ L'enseignant remplit sa demande :    │
│                  │                │ · dates, effectif, zone, thématique  │
│  [BOUTON CTA]    │                │ · sélection établissement (annuaire  │
│                  │                │   EN/SIRENE via OrganisationSearch)   │
│                  │                │ · création de compte automatique     │
└──────────────────┘                └──────────────┬───────────────────────┘
                                                   │
                                                   ▼
                                    ┌──────────────────────────────────────┐
                                    │ Demande créée dans LIAVO             │
                                    │ · source = "LMDJ" (tag automatique) │
                                    │ · reseauId = LMDJ                   │
                                    │ · visible par hébergeurs LMDJ       │
                                    └──────────────┬───────────────────────┘
                                                   │
                              ┌─────────────────────┴─────────────────────┐
                              ▼                                           ▼
               ┌──────────────────────────┐            ┌──────────────────────────┐
               │ VUE HÉBERGEUR            │            │ VUE RÉSEAU (Dashboard)   │
               │                          │            │                          │
               │ ┌──────────────────────┐ │            │ KPIs agrégés :           │
               │ │ 🏔️ via LMDJ         │ │            │ · Nb demandes reçues     │
               │ │                      │ │            │ · Taux de réponse        │
               │ │ Classe de neige      │ │            │ · Taux de conversion     │
               │ │ CM2 · 48 élèves     │ │            │ · CA réseau généré       │
               │ │ 3-7 mars 2027       │ │            │ · Scoring par centre     │
               │ │ Zone : Chablais     │ │            │                          │
               │ │                      │ │            │ Stats par hébergeur :    │
               │ │ [Voir détails]       │ │            │ · Demandes reçues        │
               │ │ [Répondre]           │ │            │ · Devis envoyés          │
               │ └──────────────────────┘ │            │ · Séjours confirmés      │
               └──────────────────────────┘            └──────────────────────────┘
```

**Le badge "via LMDJ"** est affiché sur chaque demande issue du réseau. Il matérialise la valeur de l'adhésion LMDJ dans l'interface quotidienne de l'hébergeur.

**Rôle des salariées LMDJ :** support, pas saisie. Si un enseignant appelle au téléphone, Isabelle peut le guider vers le formulaire en ligne ("Je vous envoie le lien, vous remplissez en 3 minutes") ou, en dernier recours, créer la demande pour lui via le rôle RESEAU. Le flow par défaut est self-service. Cela libère du temps pour l'accompagnement, l'animation réseau et le lobbying.

### 2.2 Flux enseignant direct (hors réseau)

```
liavo.fr                           liavo.fr
┌──────────────────┐                ┌──────────────────────────────────────┐
│ Catalogue public │ ──────────────→│ /appel-offres                        │
│ SEO / Google     │                │                                      │
│ Bouche-à-oreille │                │ Même parcours, mais :                │
│ Partenariats     │                │ · source = "LIAVO_ORGANIQUE"         │
│   académiques    │                │ · pas de reseauId                    │
│                  │                │ · visible par TOUS les hébergeurs    │
└──────────────────┘                └──────────────────────────────────────┘
```

Ce canal est développé indépendamment et en parallèle. Il n'est pas mentionné au CA LMDJ — c'est le business propre de LIAVO. Les demandes organiques n'ont pas de badge réseau.

### 2.3 Flux hébergeur direct (appel entrant)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Un enseignant appelle directement un centre (Google, bouche-à-oreille) │
│                                                                      │
│ L'hébergeur crée un séjour DIRECT dans LIAVO :                      │
│ · Renseigne les infos client (établissement, contact)                │
│ · Crée le devis, envoie par email                                    │
│ · L'enseignant signe en ligne → espace collaboratif ouvert           │
│                                                                      │
│ Source = "DIRECT" · Pas de badge réseau                              │
└──────────────────────────────────────────────────────────────────────┘
```

Ce flux existe et fonctionne en production (Pôle Montagne, Sauvageon, Lycée Les Bruyères).

### 2.4 Synthèse des sources

| Source | Badge affiché | Qui paye LIAVO ? | Qui paye le réseau ? |
|---|---|---|---|
| **LMDJ** | 🏔️ via LMDJ | Hébergeur (abo outils gestion) | Hébergeur (cotisation LMDJ + forfait centrale) |
| **IDDJ** | 🏔️ via IDDJ | Hébergeur (abo outils gestion) | Hébergeur (cotisation IDDJ) |
| **LIAVO organique** | *(pas de badge)* | Hébergeur (abo outils gestion) | — |
| **DIRECT** | *(pas de badge)* | Hébergeur (abo outils gestion) | — |

**Principe clé :** l'accès aux demandes (les voir, y répondre) est gratuit sur LIAVO. L'hébergeur ne paye que s'il utilise les outils de gestion (devis, facturation, convention, CRM, collaboratif). La centrale LMDJ reste payante — c'est le service humain d'accompagnement et de qualification qui a de la valeur, pas l'outil technique.

---

## 3. Ce que chaque acteur gagne

### 3.1 Pour LMDJ (et tout réseau partenaire)

| Gain | Détail |
|---|---|
| **Modernisation sans investissement** | Remplacement du stack Rails/jQuery par une plateforme moderne, sans coût de développement ni de maintenance. |
| **Gain de temps opérationnel** | L'enseignant remplit sa demande en self-service. Les salariées passent du rôle de saisie/dispatch à un rôle de support/accompagnement. |
| **Traçabilité post-dispatch** | Aujourd'hui, 80% de ce qui se passe après le dispatch est invisible. Avec LIAVO : taux de réponse, taux de conversion, CA généré par le réseau — sans relancer personne. |
| **Argument de recrutement** | "Adhérez à LMDJ et recevez des demandes qualifiées sur un outil professionnel." Le badge "via LMDJ" rend la valeur du réseau visible à chaque demande. |
| **Argument de rétention** | L'hébergeur voit concrètement combien de demandes LMDJ lui apporte. Au moment du renouvellement, il a un chiffre, pas une impression. |
| **Revenus préservés** | La cotisation asso et le forfait centrale restent inchangés. LIAVO ne touche pas aux 28K€ de revenus centrale. |
| **Commission future** | 10% des abonnements LIAVO de ses adhérents à partir de 2027. |

### 3.2 Pour l'hébergeur

| Gain | Détail |
|---|---|
| **Réception des demandes dans un outil pro** | Fini les emails perdus et les relances manuelles. Chaque demande est tracée, avec historique. |
| **Outils de gestion intégrés** | Devis, signature électronique, convention, facturation (Chorus Pro pour le scolaire), planning, CRM — tout sur une plateforme. |
| **Espace collaboratif** | Messagerie, documents partagés, liste de participants, planning d'activités — avec l'enseignant, sur chaque séjour. |
| **Multi-source unifié** | Demandes LMDJ + demandes directes + demandes organiques LIAVO, toutes au même endroit. |
| **Gratuit en 2026** | Plan Complet offert aux hébergeurs des réseaux partenaires. |

### 3.3 Pour l'enseignant

| Gain | Détail |
|---|---|
| **Parcours self-service** | Remplit sa demande une seule fois, reçoit des propositions ciblées de centres adaptés. |
| **Compte et espace collaboratif** | Création automatique d'un compte → accès au suivi de la demande, aux devis, à l'espace collaboratif avec l'hébergeur choisi. |
| **Workflow de validation intégré** | Signature directeur, convention scolaire, transmission rectorat — sans ressaisie. |
| **Support humain disponible** | Les salariées LMDJ restent joignables par téléphone pour accompagner les enseignants qui préfèrent le contact humain. |
| **Gratuit** | Toujours, sans condition. |

### 3.4 Pour LIAVO

| Gain | Détail |
|---|---|
| **Volume de demandes** | 522+ demandes/an (LMDJ seul) comme top-of-funnel gratuit. |
| **Découverte par les hébergeurs** | 107 hébergeurs LMDJ accèdent à la plateforme pour voir les demandes → conversion naturelle vers les outils payants. |
| **Crédibilité institutionnelle** | Partenariat avec un réseau reconnu par les Départements, la Région, les DSDEN et les académies. |
| **Canal d'acquisition** | Chaque hébergeur qui utilise LIAVO via LMDJ est un utilisateur potentiel pour les outils de gestion payants. |
| **Données terrain** | Validation du produit avec de vrais flux, de vrais hébergeurs, de vrais enseignants. |

---

## 4. Modèle économique

### 4.1 Grille tarifaire LIAVO (inchangée)

| Plan | Mensuel HT | Annuel HT | Inclut |
|---|---|---|---|
| Découverte | Gratuit | Gratuit | Profil public, voir les demandes, y répondre |
| Essentiel | 29€/mois | 24€/mois (290€/an) | Devis, facturation, Chorus Pro |
| Complet | 59€/mois | 49€/mois (590€/an) | Tout + collab, planning, CRM |

### 4.2 Ce que l'hébergeur LMDJ paye

| À qui | Quoi | Montant estimé |
|---|---|---|
| **LMDJ** | Cotisation asso + forfait centrale | ~250 à 1 000€/an (selon taille, nouveau barème 2027) |
| **LIAVO** | Rien en 2026 (gratuit réseau). Abo outils gestion à partir de 2027 si choisi. | 0€ en 2026, puis 290-590€/an |

### 4.3 Ce que LMDJ paye à LIAVO

Rien. Zéro. Le dashboard réseau est offert. L'accès hébergeurs est offert en 2026. À partir de 2027, LMDJ reçoit une commission de 10% sur les abonnements LIAVO de ses adhérents.

### 4.4 Seuil de rentabilité LIAVO

30-35 centres payants au plan Essentiel (29€/mois) = ~1 000€/mois de MRR, couvrant les coûts d'infrastructure (~128€/mois). Objectif atteignable si 30% des 107 hébergeurs LMDJ convertissent en 2027.

---

## 5. Réponse à l'objection Alticlub

### L'objection

*"Si on paye pour LIAVO, pourquoi on repaye pour LMDJ ? Tu proposes le même service mais en mieux."*

### La réponse

L'hébergeur qui utilise LIAVO voit deux types de demandes dans son interface :
- Les demandes avec badge **"via LMDJ"** → qualifiées par le réseau, issues du travail de prospection LMDJ (newsletters 55 000 contacts, brochures, relations académiques, salons, lobbying)
- Les demandes sans badge → issues de ses propres canaux (appels directs, SEO)

Le badge rend la valeur mesurable. L'hébergeur peut voir : "LMDJ m'a apporté 14 demandes ce trimestre, dont 8 converties en devis, dont 5 en séjours confirmés, pour X€ de CA." C'est un chiffre, pas une impression.

LIAVO = l'outil. LMDJ = le canal. L'un ne remplace pas l'autre. C'est comme dire "pourquoi je paye mon commercial si j'ai un CRM" — le CRM gère, le commercial prospecte.

---

## 6. Risques identifiés et parades

### Risque 1 — Adoption par les salariées LMDJ

**Risque :** Isabelle (20 ans dans l'asso) résiste au changement d'outil.

**Parade :** Le flow est conçu pour leur simplifier la vie, pas pour les remplacer. En self-service enseignant, elles n'ont plus à saisir. Le rôle RESEAU existe comme fallback (elles peuvent créer une demande si l'enseignant appelle et refuse de remplir en ligne). Accompagnement direct par Théo pendant le pilote.

### Risque 2 — Perception de conflit d'intérêts

**Risque :** Théo est admin LMDJ depuis 9 jours et pousse un partenariat avec sa propre SASU.

**Parade :** Marie Charvolin porte le message au CA, pas Théo. La démo du 18/06 est avec Marie. Le CA du 30/06 entend Marie présenter les KPIs et le modèle. Théo répond aux questions techniques, il ne vend pas.

### Risque 3 — Désintermédiation côté enseignant

**Risque :** L'enseignant qui a un compte LIAVO revient directement sur LIAVO la prochaine fois, sans passer par lamdj.com. LMDJ perd le contact enseignant.

**Parade :** Le flag source persiste. Un enseignant "source LMDJ" reste visible dans le dashboard réseau. Le branding LMDJ est intégré dans le parcours enseignant (logo, mention "Votre demande est accompagnée par La Montagne des Juniors", contact support LMDJ). L'enseignant sait que le réseau existe derrière l'outil.

### Risque 4 — La traçabilité révèle la faible valeur de la centrale pour certains hébergeurs

**Risque :** Un hébergeur voit "3 demandes LMDJ cette année, 0 convertie" et quitte le réseau.

**Parade :** Le dashboard réseau (côté LMDJ) montre les stats agrégées, pas individuelles. LMDJ peut utiliser les stats individuelles pour de l'accompagnement ciblé ("votre taux de réponse est bas, on peut vous aider").

### Risque 5 — Le CA du 30/06 bloque

**Risque :** Le bureau ou des administrateurs voient LIAVO comme une menace et refusent tout partenariat.

**Parade :** Le modèle ne menace rien. LMDJ ne paye rien, ne perd aucun revenu, ne cède aucune donnée. LIAVO offre un upgrade technique gratuit. Si malgré tout le CA bloque, LIAVO continue avec ses canaux organiques (catalogue public, SEO, flow DIRECT) et ses clients existants (Pôle Montagne, Sauvageon). Le partenariat LMDJ est un accélérateur, pas une dépendance.

---

## 7. Ce qui est en production vs ce qu'il faut construire

### En production (montrable le 18/06)

- ✅ Flow appel d'offres `/appel-offres` avec sélection établissement (OrganisationSearch public)
- ✅ Création de compte enseignant + espace collaboratif
- ✅ Dashboard réseau (KPIs de base, scoring centres, invitation)
- ✅ Flow complet hébergeur : demande → devis → signature → convention → facturation
- ✅ 81 centres LMDJ importés (profils APIDAE)
- ✅ Compte démo réseau : `demo-lmdj@liavo.fr` / LMDJ2026!

### À construire (estimations)

| Fonctionnalité | Effort estimé | Priorité |
|---|---|---|
| **Tag source réseau** sur DemandeDevis (`sourceReseauId`) | 0.5j | Critique (démo 18/06) |
| **Badge "via LMDJ"** dans la vue hébergeur des demandes | 0.5j | Critique (démo 18/06) |
| **Lien dédié LMDJ** (`/appel-offres?reseau=lmdj`) avec branding conditionnel | 0.5j | Critique (démo 18/06) |
| **KPIs réseau enrichis** (demandes par source, taux conversion par source) | 1j | Important (avant 30/06) |
| **SSO APIDAE** (quand credentials reçus) | 0.5j | Post-partenariat |
| **Rôle RESEAU : création de demande au nom d'un enseignant** (fallback téléphone) | 1j | Post-partenariat |
| **Branding réseau dans le parcours enseignant** (logo, mention, contact support) | 0.5j | Post-partenariat |

**Chemin critique pour le 18/06 : tag source + badge + lien dédié = 1.5j de dev.**

---

## 8. Plan d'exécution

### Semaine du 10-13 juin

- [ ] Développer tag source réseau + badge "via LMDJ" + lien dédié
- [ ] Enrichir le dashboard réseau avec stats par source
- [ ] Préparer le scénario de démo pour Marie (18/06)

### 18 juin — Démo Marie Charvolin

Objectif : Marie comprend le modèle en 30 secondes et peut le pitcher au CA.

Montrer :
1. Parcours enseignant : lien depuis lamdj.com → formulaire /appel-offres brandé LMDJ → demande créée
2. Vue hébergeur : demande reçue avec badge "via LMDJ", réponse avec devis
3. Dashboard réseau : KPIs agrégés, stats par centre, traçabilité

Marie repart avec : les KPIs Pôle Montagne (conversion, élèves, fidélisation) + une compréhension claire du modèle.

### 30 juin — CA LMDJ

Message porté par Marie, pas par Théo.

Trois points :
1. "LIAVO modernise vos outils sans rien vous coûter" (orientation 2026 n°2)
2. "Vos équipes récupèrent du temps" (réponse au problème RH)
3. "La valeur de LMDJ devient mesurable" (badge, KPIs, argument de recrutement/rétention)

Proposition : pilote 5 centres volontaires, 3 mois, accompagnement direct Théo. Gratuit.

---

## 9. Décisions de référence

| Sujet | Décision |
|---|---|
| Positionnement | LIAVO = infrastructure technique qui modernise la centrale, pas un remplacement |
| Centrale LMDJ | Reste payante, revenus préservés (28K€/an). LIAVO ne touche pas à ce flux de revenus |
| Accès aux demandes | Gratuit sur LIAVO (voir + répondre). Monétisation sur les outils de gestion uniquement |
| Flow enseignant | Self-service par défaut (l'enseignant remplit lui-même). Saisie RESEAU en fallback |
| Badge source | Affiché sur chaque demande réseau côté hébergeur. Matérialise la valeur du réseau |
| Canaux organiques | Développés indépendamment (catalogue, SEO, académies). Non mentionnés au CA LMDJ |
| Gratuité 2026 | Plan Complet offert aux hébergeurs des réseaux partenaires |
| Commission | 10% reversés à chaque réseau sur les abonnements actifs dès 2027 |
| Porteur du message CA | Marie Charvolin, pas Théo |
| Exclusivité | Aucune. LIAVO travaille avec LMDJ et IDDJ sur un pied d'égalité, et reste ouvert à tout réseau |

---

**Aucun code modifié dans le cadre de ce document.**