# Prompt CC — Dashboard réseau : KPIs par source + Vue demandes opérationnelle

## CONTEXTE

Le dashboard réseau (`/dashboard/reseau`) existe et affiche des KPIs globaux + une table des centres.
Il manque :
1. La distinction par source (demandes "via LMDJ" vs total) dans les KPIs
2. Une vue opérationnelle des demandes pour les salariées du réseau (voir les demandes, coordonnées enseignant, statut)
3. La fidélité enseignants (acquis via réseau, fidélisés)
4. Le badge source dans le détail centre

Le rôle RESEAU doit pouvoir voir les demandes issues de son réseau, avec les coordonnées complètes de l'enseignant (nom, email, téléphone) pour pouvoir l'appeler et requalifier si besoin.

## RÈGLES ABSOLUES

- Lire chaque fichier AVANT de modifier
- Proposer le contenu exact → attendre "ok" → puis modifier
- `tsc --noEmit` + `npm run build` à 0 erreurs avant commit
- Fix à la source, pas de patch

---

# ÉTAPE 1 — BACKEND : Enrichir l'endpoint stats + nouveau endpoint demandes

## Fichiers à lire d'abord

```
backend/src/centres/centre.service.ts (chercher getReseauStats ou getMyReseauStats)
backend/src/centres/centre.controller.ts (chercher /reseau/stats)
backend/src/demandes/demande.service.ts (comprendre le modèle DemandeDevis et ses relations)
backend/prisma/schema.prisma (modèle DemandeDevis : sourceReseau, relations sejour/user)
```

## 1A — Enrichir getMyReseauStats avec KPIs par source

Dans la méthode qui calcule les stats réseau (probablement dans centre.service.ts), ajouter au retour :

```typescript
kpis: {
  // ... existants ...
  // NOUVEAU : KPIs filtrés par sourceReseau
  demandesReseau: number;      // count demandes où sourceReseau = nom du réseau
  devisReseau: number;         // count devis issus de ces demandes (statut SELECTIONNE+)
  caReseau: number;            // CA TTC des devis retenus issus de demandes réseau
  tauxConversionReseau: number; // demandesReseau → devisReseau en %
  enseignantsAcquis: number;   // count distinct users avec sourceReseau = ce réseau
  enseignantsFidelises: number; // parmi eux, ceux qui ont 2+ séjours
}
```

Pour calculer ces KPIs, requêter `DemandeDevis` avec filtre `sourceReseau` = le réseau du user connecté.
Le nom du réseau est dans `User.reseauNom` ou dérivé du mapping (vérifier comment le backend identifie le réseau du user RESEAU).

ATTENTION : bien filtrer par la période sélectionnée (30j/90j/saison/tout) comme pour les KPIs existants.

Ajouter aussi par centre dans le tableau :
```typescript
centres[i].demandesReseau: number; // demandes sourceReseau pour CE centre spécifiquement
```

## 1B — Nouveau endpoint GET /reseau/demandes

Créer un endpoint `GET /reseau/demandes` (rôle RESEAU) qui retourne les demandes taggées avec le sourceReseau du réseau connecté.

Retour attendu :
```typescript
interface DemandeReseau {
  id: string;
  createdAt: string;
  statut: string; // OUVERTE, FERMEE, ANNULEE
  titre: string;
  dateDebut: string | null;
  dateFin: string | null;
  moisSouhaite: number | null;
  anneeSouhaitee: number | null;
  dureeNuits: number | null;
  placesTotales: number;
  nombreAccompagnateurs: number | null;
  niveauClasse: string | null;
  typeContexte: string;
  departementsCibles: string[];
  regionCible: string;
  description: string | null;
  enseignant: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
    telephone: string | null;
  };
  organisation: { nom: string; ville: string | null; uai: string | null } | null;
  nombreReponses: number;
  reponses: Array<{
    centreNom: string;
    centreVille: string;
    statut: string;
    montantTTC: number | null;
    dateReponse: string;
  }>;
}
```

La query Prisma doit :
- Filtrer `DemandeDevis` par `sourceReseau` = réseau du user connecté
- Inclure le `sejour` (titre, dates, effectif, etc.)
- Inclure le `user` (enseignant : prenom, nom, email, telephone)
- Inclure l'organisation principale du user (via memberships isPrimary)
- Inclure les devis liés à cette demande (pour compter les réponses et voir les statuts)
- Ordonner par `createdAt DESC`
- Supporter un filtre période optionnel (query param `periode`)

ATTENTION cascades :
- Le `user` de la DemandeDevis est l'enseignant qui a créé la demande (pas l'hébergeur). Vérifier la relation dans le schema.
- Les "réponses" sont les Devis créés en réponse à cette DemandeDevis. Vérifier la relation DemandeDevis → Devis (probablement via `sejourId` ou direct).
- Le téléphone de l'enseignant est sur `User.telephone` (pas sur la demande). Le champ `telephone` sur DemandePubliqueDto est sauvé sur le User à la création.

## 1C — Vérifications

- L'endpoint /reseau/stats existant ne doit PAS casser (rétro-compat : les nouveaux champs sont ajoutés, les anciens inchangés)
- Le nouveau endpoint /reseau/demandes doit être protégé par @Roles(Role.RESEAU, Role.ADMIN)
- `tsc --noEmit` backend avant de passer à l'étape 2

### Commit message étape 1
```
feat(reseau): KPIs par source + endpoint GET /reseau/demandes avec coordonnées enseignant
```

---

# ÉTAPE 2 — FRONTEND : KPIs enrichis + onglet Demandes + badges source

## Fichiers à lire d'abord

```
frontend/app/dashboard/reseau/page.tsx (le dashboard actuel — ~600 lignes)
frontend/src/lib/admin.ts (types ReseauStats, ReseauCentre + fonctions API)
```

## 2A — Mettre à jour les types frontend

Dans `admin.ts`, enrichir `ReseauStats.kpis` avec les 6 nouveaux champs.
Enrichir `ReseauCentre` avec `demandesReseau: number`.
Ajouter le type `DemandeReseau` et la fonction `getReseauDemandes(periode?)`.

## 2B — Enrichir les KPI cards

Remplacer les 7 KPI cards actuelles par un layout à 2 lignes :

**Ligne 1 — KPIs réseau (ce que LMDJ apporte) :**
- "Demandes via réseau" : demandesReseau / demandesRecues (fraction ou barre)
- "Devis convertis via réseau" : devisReseau
- "CA via réseau" : formatEuros(caReseau) / formatEuros(caTotal)
- "Taux de conversion réseau" : tauxConversionReseau %

**Ligne 2 — KPIs globaux :**
- Centres membres, Centres actifs, Enseignants acquis, Enseignants fidélisés

Ligne 1 = ce que Marie regarde en premier. Ligne 2 = contexte.

## 2C — Onglet Demandes dans le dashboard

Ajouter un système de 2 onglets : "Centres" (vue actuelle) et "Demandes" (nouvelle vue).

L'onglet **Demandes** affiche la liste des demandes sourceReseau :
- Chaque ligne : date, enseignant (nom + organisation), téléphone (cliquable tel:), effectif, dates/période, statut, nb réponses
- Clic sur une ligne → slide-over avec détails + liste réponses hébergeurs
- Tri par date DESC, filtre par statut (Toutes / Ouvertes / Répondues / Converties)
- Coordonnées enseignant VISIBLES (nom, email, téléphone) pour appel/requalification

## 2D — Colonne "Via réseau" dans la table centres

Ajouter colonne `demandesReseau` dans la table.

## 2E — Badge source dans le slide-over centre

Les devis issus d'une demande réseau affichent un petit tag "via LMDJ".

## 2F — Vérifications

- Empty states (0 demandes) ne plantent pas
- KPIs à 0 : pas de NaN, pas de division par 0
- Filtre période appliqué aux demandes ET aux KPIs
- Export CSV inclut demandesReseau par centre
- `tsc --noEmit` + `npm run build` frontend

### Commit message étape 2
```
feat(reseau): KPIs par source + onglet demandes + coordonnées enseignant + badges source
```

---

## PIÈGES À ANTICIPER

1. Nom réseau : comment le backend identifie que le user RESEAU connecté est "lmdj" ? Via `user.reseauNom` ? Vérifier. Si c'est "LMDJ" (majuscules) vs "lmdj" (minuscules dans sourceReseau), le filtre ne matchera pas → normaliser.

2. Relation DemandeDevis → réponses hébergeurs : passe par quoi ? `DemandeDevis.devis[]` directe ? Via Sejour ? Vérifier le schema.

3. Demandes sans séjour : une DemandeDevis via /appel-offres crée un séjour immédiatement ? Ou le séjour est créé quand un hébergeur répond ? Impact sur les jointures.

4. Performance : LIMIT 100 + filtre période pour le MVP.

5. `tauxConversionReseau = devisReseau / demandesReseau * 100`. Si demandesReseau = 0 → retourner 0.
