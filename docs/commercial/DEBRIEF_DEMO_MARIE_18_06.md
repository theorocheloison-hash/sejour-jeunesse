# Débrief démo Marie Charvolin (LMDJ) — 18 juin 2026

> **Date** : 18/06/2026, visio
> **Interlocutrice** : Marie Charvolin, salariée CDI LMDJ
> **Durée** : ~1h
> **Contexte** : Marie est admin LMDJ, porte le dossier LIAVO en interne. Démo fonctionnelle de la plateforme (dashboard réseau, appel d'offres, facturation, catalogue).

---

## Signal commercial

Marie se projette dans la collaboration. Elle a confirmé le process interne :
1. Présentation aux salariées de l'association
2. Rédaction d'une note de synthèse collective
3. Transmission au bureau de l'association
4. Le bureau décide s'il met le sujet à l'ODJ d'un CA
5. Si oui → démo formelle devant le CA

**Timeline estimée** : plusieurs semaines/mois. On ne les attend pas pour avancer.

**Posture LIAVO** : on note tout, on ne code rien de spécifique LMDJ tant qu'il n'y a pas d'accord de principe du CA. Le produit générique continue d'avancer.

---

## Demandes fonctionnelles

### BLOC 1 — Workflow réseau (le plus structurant)

#### 1. Validation réseau avant dispatch aux centres

**Besoin** : les demandes via LMDJ doivent atterrir sur le dashboard réseau EN ATTENTE DE VALIDATION, pas partir directement aux centres. LMDJ appelle 100% des enseignants pour requalifier chaque demande (vérifier les infos, les dates, le budget, le projet pédagogique). Ensuite elles poussent manuellement la demande au réseau des adhérents.

**Impact technique** : nouveau statut intermédiaire sur DemandeDevis (ex: `EN_VALIDATION_RESEAU`). Le dispatch aux centres ne se fait qu'après validation réseau. Bouton "Valider et dispatcher" sur le dashboard réseau.

**Estimation** : 2-3j backend + frontend.

#### 2. Capture des demandes Savoie/Haute-Savoie hors LMDJ

**Besoin** : les demandes pour les départements 73/74 qui arrivent sur LIAVO sans passer par LMDJ devraient aussi remonter sur le dashboard réseau pour requalification. LMDJ veut capter toutes les demandes de sa zone, pas seulement celles qui passent par leur landing page.

**Impact technique** : filtre par départementsCibles en plus de sourceReseau. Attention : ne pas mélanger avec les demandes ciblées directement vers un centre (centreDestinataireId non null).

**Estimation** : 0.5-1j. Conditionné à un accord clair sur le périmètre géographique.

#### 3. Motif obligatoire de refus

**Besoin (côté centre)** : si un centre choisit de ne pas répondre à une demande, il doit écrire pourquoi (pas de place, dates incompatibles, hors thématique, etc.). Ce motif remonte sur le dashboard réseau.

**Besoin (côté enseignant)** : si un enseignant reçoit des devis mais ne choisit aucun séjour, il doit dire pourquoi (trop cher, dates pas bonnes, projet annulé, etc.).

**Impact technique** : champ `motifRefus` sur DemandeIgnoree (centre) et sur la demande elle-même (enseignant). Visible dans le CRM réseau.

**Estimation** : 1j.

### BLOC 2 — Formulaire appel d'offres

#### 4. Multi-classes

**Besoin** : pouvoir sélectionner plusieurs niveaux de classe dans une même demande (ex: 4ème + 5ème pour les associations sportives UNSS du collège).

**Impact technique** : transformer `niveauClasse` de string en string[] (array). Migration + mise à jour formulaire + affichage.

**Estimation** : 0.5j.

#### 5. Split maternelle / non-maternelle (PMI)

**Besoin** : si l'enseignant s'identifie comme école primaire, il doit indiquer le nombre d'élèves maternelle vs élémentaire. La présence d'élèves maternelle déclenche un agrément PMI obligatoire pour le centre d'accueil.

**Impact technique** :
- 2 nouveaux champs sur la demande : `nombreElevesMaternelle`, `nombreElevesElementaire`
- Filtre automatique : si `nombreElevesMaternelle > 0`, seuls les centres avec `agrementPMI = true` reçoivent la demande
- Nouveau champ booléen `agrementPMI` sur CentreHebergement (à renseigner dans le profil)
- Modification de `findOpen()` et `notifierCentresInscrits()` pour intégrer ce filtre

**Estimation** : 1-1.5j.

### BLOC 3 — Dashboard réseau enrichi

#### 6. GRC demandes / enseignants

**Besoin** : vrai outil de gestion de la relation avec les enseignants côté réseau. Suivi des demandes, relances, historique des échanges, statut de chaque enseignant (premier contact, récurrent, perdu).

**Impact technique** : extension significative du dashboard réseau. Modèle ActiviteReseau ou réutilisation d'ActiviteClient adapté au contexte réseau.

**Estimation** : 3-5j (scope à préciser).

#### 7. CRM hébergeurs côté réseau

**Besoin** : LMDJ veut gérer ses adhérents ET ses prospects (centres pas encore adhérents qu'elles veulent démarcher). Les prospects seraient remontés via APIDAE (centres dans la zone 73/74 qui ne sont pas encore adhérents LMDJ).

**Impact technique** : distinction adhérent / prospect dans le dashboard réseau. Import APIDAE filtré (centres zone 73/74 sans champ `reseau = 'LMDJ'`). Pipeline de prospection.

**Estimation** : 2-3j.

#### 8. Ratio demandes/devis par centre

**Besoin** : KPI par centre = nombre de demandes reçues vs nombre de devis envoyés. Permet à LMDJ de dire à un centre "tu as reçu 50 demandes mais envoyé 1 seul devis, pourquoi ?".

**Impact technique** : déjà partiellement disponible (`demandesRecues` et `devisEnvoyes` existent par centre dans getReseauStats). Il manque le ratio calculé et l'affichage dédié.

**Estimation** : 0.5j.

#### 9. Tableaux de bord personnalisés par utilisateur

**Besoin** : Marie et Isabelle n'ont pas les mêmes responsabilités. Chacune voudrait un dashboard adapté à ses tâches (Marie = commercial/prospection, Isabelle = suivi opérationnel des séjours).

**Impact technique** : système de widgets configurables ou de rôles/vues par utilisateur réseau. Complexe si on veut le faire proprement.

**Estimation** : 3-5j (scope à définir précisément avec LMDJ).

### BLOC 4 — Commercial / pricing

#### 10. Abonnement LIAVO bundlé dans l'adhésion LMDJ

**Besoin** : LMDJ intégrerait le coût LIAVO dans le tarif d'adhésion. Trois formules possibles :
- Adhérent seul (cotisation classique)
- Adhérent + centrale (cotisation + frais de gestion centrale)
- Adhérent + centrale + accès LIAVO (complet ou par module)

**Impact** : stratégiquement majeur. Si LMDJ revend l'abonnement LIAVO, c'est un canal d'acquisition passif de 80+ centres. Nécessite un pricing réseau dédié (marge LMDJ intégrée), différent du pricing B2C hébergeur direct.

**Estimation technique** : facturation via le réseau (pas Stripe direct) → modèle économique à définir avant le code.

---

## Priorisation si accord CA

| Priorité | Demande | Estimation | Justification |
|----------|---------|------------|---------------|
| P0 | Validation réseau avant dispatch (#1) | 2-3j | Bloquant — LMDJ ne peut pas opérer sans ça |
| P0 | Motif refus centre (#3) | 1j | Essentiel pour le pilotage réseau |
| P1 | Split maternelle/PMI (#5) | 1-1.5j | Conformité réglementaire |
| P1 | Multi-classes (#4) | 0.5j | Quick win, demandé |
| P1 | Ratio demandes/devis (#8) | 0.5j | Quick win, forte valeur pilotage |
| P2 | Capture 73/74 hors LMDJ (#2) | 0.5-1j | Élargissement périmètre |
| P2 | CRM hébergeurs réseau (#7) | 2-3j | Prospection LMDJ |
| P3 | GRC enseignants (#6) | 3-5j | Nice to have, scope flou |
| P3 | Dashboards personnalisés (#9) | 3-5j | Nice to have, complexe |
| — | Pricing bundlé (#10) | — | Business decision, pas du code |

**Total si tout est fait** : ~15-20j de développement. Échelonnable en 3-4 sprints.

---

## Actions immédiates (pas de code)

- [x] Documenter les 10 demandes (ce fichier)
- [x] Mentionner le closing Les Choucas à Marie (fait pendant la démo)
- [ ] Préparer un one-pager pricing réseau pour le bundling (#10)
- [ ] Attendre le retour du process interne LMDJ (bureau → CA)
- [ ] Continuer à avancer le produit générique (pilotage, facturation, UX)
