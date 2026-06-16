# Prompt CC — Refonte UX dashboard réseau (effet wow démo 18/06)

## CONTEXTE

Le dashboard réseau (`/dashboard/reseau`) fonctionne mais ne convainc pas :
- Les KPI cards exposent des données privées des hébergeurs (CA total, demandes totales)
- Les cartes sont statiques (pas cliquables, pas de description)
- Pas de pipeline funnel visuel
- L'onglet Centres est en premier au lieu de Demandes (les salariées travaillent sur les demandes)
- Les salariées LMDJ doivent pouvoir voir les demandes, appeler les enseignants, suivre le pipeline

Objectif : que les salariées LMDJ ouvrent ce dashboard et se disent "cet outil est indispensable".

## RÈGLES ABSOLUES

- Lire `frontend/app/dashboard/reseau/page.tsx` EN ENTIER avant de modifier
- Lire `frontend/src/lib/admin.ts` pour les types
- Proposer → attendre "ok" → modifier
- `tsc --noEmit` + `npm run build` à 0 erreurs
- NE PAS toucher au backend (les endpoints sont déjà bons)
- Fix à la source, pas de patch

---

# ÉTAPE 1 — Supprimer les données privées + descriptions KPI

## 1A — Supprimer les données privées

Dans la section KPI "Apport du réseau" (ligne 1 de cards) :

- **"Demandes via réseau"** : afficher UNIQUEMENT `demandesReseau`. Supprimer le `/ {demandesRecues}` qui expose le total hors-réseau.
- **"CA via réseau"** : afficher UNIQUEMENT `formatEuros(caReseau)`. Supprimer le `/ {formatEuros(caTotal)}` qui expose le CA privé des hébergeurs.

Dans la table des centres (onglet Centres) :

- Supprimer les colonnes **"Demandes"** (total), **"Devis"** (total), **"Retenus"** (total), **"CA généré"** (total). Ce sont des données privées de chaque hébergeur — LMDJ n'a pas à voir le CA direct d'un centre.
- Garder uniquement la colonne **"Via réseau"** (`demandesReseau`) qui montre ce que LMDJ a apporté à ce centre.
- Garder : Nom, Ville/Dép., Capacité, Statut, Profil (onboarding), Via réseau, Dernière activité.

Dans l'export CSV : même principe — supprimer demandesRecues, devisEnvoyes, devisSelectionnes, caGenere. Garder demandesReseau.

## 1B — Descriptions sur les KPI cards

Remplacer le composant `KpiCard` actuel par un composant enrichi qui accepte une `description: string` affichée sous la valeur en petit texte gris :

```tsx
function KpiCard({ label, value, description, accent, onClick }: {
  label: string;
  value: number | string;
  description?: string;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 ${onClick ? 'cursor-pointer hover:border-[var(--color-primary)] hover:shadow-md transition-all' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</p>
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
    </div>
  );
}
```

Descriptions pour chaque carte :

Ligne "Apport du réseau" :
- "Demandes via réseau" → description: "Demandes d'enseignants arrivées via votre réseau"
- "Devis convertis" → description: "Devis retenus suite à une demande réseau"
- "CA via réseau" → description: "Chiffre d'affaires généré par vos demandes"
- "Taux de conversion" → description: "Demandes réseau transformées en séjour"

Ligne "Vue d'ensemble" :
- "Centres membres" → description: "Centres rattachés à votre réseau sur Liavo"
- "Centres actifs" → description: "Centres avec un compte actif"
- "Enseignants acquis" → description: "Enseignants inscrits via votre réseau"
- "Enseignants fidélisés" → description: "Enseignants revenus pour un 2e séjour"

## 1C — KPI cards cliquables

Ajouter un state `activeTab` pour gérer les onglets (déjà existant probablement). Les 4 cartes de la ligne "Apport du réseau" sont cliquables :

- Clic sur "Demandes via réseau" → bascule vers onglet Demandes
- Clic sur "Devis convertis" → bascule vers onglet Demandes, filtré sur les demandes qui ont un devis retenu
- Clic sur "CA via réseau" → bascule vers onglet Demandes, filtré sur les demandes converties
- Clic sur "Taux de conversion" → bascule vers onglet Demandes

Les cartes cliquables ont un `cursor-pointer` + `hover:border` (déjà dans le composant KpiCard enrichi ci-dessus).

### Commit étape 1
```
fix(reseau-dashboard): suppression données privées + descriptions KPI + cards cliquables
```

---

# ÉTAPE 2 — Pipeline funnel visuel

## 2A — Composant FunnelPipeline

Créer un composant visuel en haut de l'onglet Demandes (pas en haut de toute la page — dans l'onglet Demandes spécifiquement) qui montre le funnel :

```
┌─────────────────┐    ┌──────────────────────┐    ┌───────────────────┐    ┌──────────────┐
│   Demandes      │───▸│  Avec proposition(s)  │───▸│ Séjours confirmés │───▸│  CA généré   │
│      12         │    │         8             │    │        3          │    │  45 000 €    │
│   reçues        │    │  ≥1 centre a répondu  │    │  devis signé      │    │              │
└─────────────────┘    └──────────────────────┘    └───────────────────┘    └──────────────┘
```

Visuellement : 4 blocs horizontaux connectés par des flèches/chevrons. Couleurs dégradées (bleu clair → bleu → vert → or). Chaque bloc cliquable → filtre la liste des demandes en dessous.

Les valeurs viennent des KPIs :
- "Demandes" = `kpis.demandesReseau`
- "Avec proposition(s)" = nombre de demandes réseau ayant `nombreReponses > 0` (à calculer depuis les données `demandes[]` déjà chargées côté frontend)
- "Séjours confirmés" = `kpis.devisReseau` (devis retenus = séjours confirmés)
- "CA généré" = `kpis.caReseau`

ATTENTION : "Avec proposition(s)" n'existe pas directement dans les KPIs backend. Il faut le calculer côté frontend à partir de la liste `demandes[]` retournée par `getReseauDemandes()` : `demandes.filter(d => d.nombreReponses > 0).length`. C'est un calcul dérivé, pas un nouveau KPI backend.

## 2B — Filtrage pipeline

Quand on clique sur un bloc du funnel :
- "Demandes" → toutes les demandes (pas de filtre)
- "Avec proposition(s)" → `demandes.filter(d => d.nombreReponses > 0)`
- "Séjours confirmés" → `demandes.filter(d => d.reponses.some(r => ['SELECTIONNE','SIGNE_DIRECTION','FACTURE_ACOMPTE','FACTURE_SOLDE'].includes(r.statut)))`
- "CA généré" → même filtre que "Séjours confirmés"

Ajouter un state `funnelFilter: 'all' | 'avec_reponse' | 'confirmes'` et appliquer le filtre sur la liste affichée.

Le bloc actif du funnel a un style distinct (bordure plus épaisse, fond légèrement coloré).

### Commit étape 2
```
feat(reseau-dashboard): pipeline funnel visuel cliquable sur onglet Demandes
```

---

# ÉTAPE 3 — Onglet Demandes en premier + slide-over enrichi

## 3A — Onglet Demandes en premier

Inverser l'ordre des onglets : **Demandes** puis Centres (pas Centres puis Demandes). L'onglet par défaut au chargement = Demandes.

C'est le flow quotidien des salariées : elles ouvrent le dashboard, voient les demandes récentes, appellent si besoin.

## 3B — Slide-over demande enrichi (DemandeSlideOver)

Vérifier que le slide-over existant (quand on clique sur une demande) affiche bien :

1. **Coordonnées enseignant visibles et actionnables** :
   - Nom complet en gras
   - Email en lien `mailto:`
   - Téléphone en lien `tel:` avec style visible (pas gris microscopique — c'est l'action principale)
   - Organisation + ville

2. **Détails de la demande** : titre, dates/période, effectif + accompagnateurs, niveau de classe, type contexte, description

3. **Réponses hébergeurs** : liste des devis reçus avec centre nom + ville, statut (badge), montant TTC, date

Si le slide-over existe déjà avec ces éléments, vérifier juste que le téléphone est suffisamment visible (taille text-base minimum, pas text-xs).

## 3C — Badge source dans le slide-over centre

Dans le `CentreSlideOver` (quand on clique sur un centre dans l'onglet Centres), les devis qui proviennent d'une demande réseau doivent afficher un petit badge "via réseau".

Vérifier que le backend `getReseauCentreDetail` retourne `devis[].demande?.sourceReseau`. Si c'est le cas, afficher conditionnellement :

```tsx
{devis.sourceReseau && (
  <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">via réseau</span>
)}
```

Si le backend ne retourne pas ce champ, l'ajouter dans le select du endpoint `/reseau/centres/:id` (backend touché dans ce cas — exception justifiée).

### Commit étape 3
```
feat(reseau-dashboard): onglet Demandes en premier + slide-over enrichi + badge source
```

---

## VÉRIFICATIONS GLOBALES

- `tsc --noEmit` frontend : 0 erreurs
- `npm run build` : 0 erreurs
- Tester visuellement avec le compte `demo-lmdj@liavo.fr` / `LMDJ2026!` :
  - Les KPI cards n'affichent plus de données privées (pas de /total)
  - Les descriptions sont visibles sous chaque valeur
  - Clic sur une card "Apport du réseau" → bascule vers onglet Demandes
  - Le funnel pipeline s'affiche en haut de l'onglet Demandes
  - Clic sur un bloc du funnel → filtre la liste
  - L'onglet Demandes est actif par défaut au chargement
  - Le slide-over demande montre les coordonnées enseignant de façon visible
  - L'export CSV ne contient plus les données privées
- Empty state : si 0 demandes réseau, le funnel affiche "0 → 0 → 0 → 0 €" (pas de crash)
- Division par zéro : taux de conversion quand demandesReseau = 0 → afficher "—"

## PIÈGES CASCADE

1. Le filtre période (`periode` state) doit s'appliquer aux demandes ET aux KPIs. Quand on change la période, recharger les deux (stats + demandes). Vérifier que `useEffect` dépend bien de `periode`.

2. Le state `activeTab` (Centres/Demandes) et le state `funnelFilter` sont indépendants. Quand on change d'onglet, ne pas reset le filtre du funnel. Quand on change la période, reset le filtre du funnel à 'all'.

3. Les `demandes[]` chargées par `getReseauDemandes(periode)` sont la source de vérité pour le funnel. Si la période change, le funnel doit se recalculer à partir des nouvelles demandes, pas des anciens KPIs.

4. L'export CSV des centres ne doit plus contenir demandesRecues, devisEnvoyes, devisSelectionnes, caGenere. Mettre à jour la fonction `exportCSV` en conséquence.

5. Le `SortableHeader` pour les colonnes supprimées (Demandes, Devis, Retenus, CA) doit être retiré. Si le `sortCol` par défaut est une colonne supprimée (ex: 'ca'), le changer en 'nom'.
