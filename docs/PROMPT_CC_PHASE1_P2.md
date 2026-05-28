# PROMPT CC — Phase 1 Partie 2 : Frontend planning + modale création séjour DIRECT

> **Contexte** : Phase 1 Partie 1 (backend) est déjà déployé. On adapte maintenant le planning hébergeur pour :
> 1. Remplacer le dataset DevisLibres par le nouvel endpoint `getMesSejoursPlanning`
> 2. Afficher les 3 statuts (OPTION / CONVENTION / SIGNE_DIRECTION) avec des couleurs distinctes
> 3. Remplacer la modale par un choix 3 boutons (Nouveau séjour / Nouvel événement / Indisponible)
> 4. Créer le formulaire de création séjour DIRECT avec StructureSearch
>
> **Référence architecture** : `docs/ARCHITECTURE_SEJOUR_DIRECT.md`
> **Règle** : Lire chaque fichier AVANT de le modifier. Ne jamais déduire le contenu.

---

## ÉTAPE 1 — Nouveau type et appel API dans lib/collaboration.ts

Lire `frontend/src/lib/collaboration.ts` en entier.

### 1A. Ajouter le type `SejourPlanning` APRÈS le type `SejourConventionHebergeur` :

```typescript
export interface SejourPlanning {
  id: string;
  titre: string;
  lieu: string;
  dateDebut: string;
  dateFin: string;
  placesTotales: number;
  statut: string;         // 'OPTION' | 'CONVENTION' | 'SIGNE_DIRECTION'
  modeGestion: string;    // 'DIRECT' | 'COLLABORATIF'
  natureSejour: string;   // 'SEJOUR' | 'EVENEMENT'
  typeSejour: string | null;
  clientNom: string | null;
  clientOrganisation: string | null;
  createur?: { prenom: string; nom: string } | null;
  hebergementSelectionne?: { nom: string } | null;
  planningActivites: {
    id: string;
    date: string;
    heureDebut: string;
    heureFin: string;
    titre: string;
    description: string | null;
    responsable: string | null;
    couleur: string | null;
  }[];
}
```

### 1B. Ajouter la fonction d'appel API APRÈS `getMesSejoursConvention` :

```typescript
export async function getMesSejoursPlanning(): Promise<SejourPlanning[]> {
  const { data } = await api.get<SejourPlanning[]>('/collaboration/mes-sejours-planning');
  return data;
}
```

### 1C. Ajouter la fonction de création séjour DIRECT :

```typescript
export async function createSejourDirect(dto: {
  titre: string;
  natureSejour: string;
  typeSejour?: string;
  dateDebut: string;
  dateFin: string;
  nombreParticipants: number;
  clientNom?: string;
  clientPrenom?: string;
  clientEmail?: string;
  clientTelephone?: string;
  clientOrganisation?: string;
  clientOrganisationId?: string;
  description?: string;
}): Promise<SejourPlanning> {
  const { data } = await api.post<SejourPlanning>('/sejours/direct', dto);
  return data;
}
```

### 1D. Ajouter la fonction de suppression séjour :

```typescript
export async function deleteSejourDirect(sejourId: string): Promise<void> {
  await api.delete(`/sejours/${sejourId}`);
}
```

---

## ÉTAPE 2 — Refactoring planning/page.tsx : remplacement du dataset

Lire `frontend/app/dashboard/hebergeur/planning/page.tsx` en entier (fichier ~500 lignes).

### Changements à effectuer :

### 2A. Imports — remplacer les imports DevisLibres

**Supprimer ces lignes :**
```typescript
import { getMesDevisLibres } from '@/src/lib/devis-libres';
import type { DevisLibre } from '@/src/lib/devis-libres';
```

**Remplacer l'import collaboration :**
```typescript
// AVANT :
import { getMesSejoursConvention } from '@/src/lib/collaboration';
import type { SejourConventionHebergeur } from '@/src/lib/collaboration';

// APRÈS :
import { getMesSejoursPlanning, createSejourDirect } from '@/src/lib/collaboration';
import type { SejourPlanning } from '@/src/lib/collaboration';
```

### 2B. Constantes couleurs — remplacer COULEUR_DL

**Supprimer le bloc `COULEUR_DL`.**

**Ajouter à la place :**
```typescript
// Couleurs par statut planning
const COULEUR_STATUT: Record<string, { bg: string; text: string; style?: string }> = {
  OPTION:           { bg: '#F59E0B', text: '#fff', style: 'hachures' },
  CONVENTION:       { bg: '', text: '#fff' },        // utilise la palette par défaut
  SIGNE_DIRECTION:  { bg: '', text: '#fff' },        // utilise la palette + badge ✓
};

// Couleur spécifique événements en OPTION
const COULEUR_EVENEMENT_OPTION = { bg: '#7B3FA0', text: '#fff' };
```

### 2C. State — remplacer devisLibres par le dataset unifié

**Dans la fonction `PlanningContent`, remplacer :**

```typescript
// SUPPRIMER :
const [sejours, setSejours] = useState<SejourConventionHebergeur[]>([]);
// ...
const [devisLibres, setDevisLibres] = useState<DevisLibre[]>([]);

// REMPLACER PAR :
const [sejours, setSejours] = useState<SejourPlanning[]>([]);
```

**Supprimer les states :**
- `filterDevisLibreId` et son setter
- `devisLibres` et son setter

**Ajouter un nouveau state pour la modale de création :**
```typescript
const [showCreateModal, setShowCreateModal] = useState(false);
const [createType, setCreateType] = useState<'SEJOUR' | 'EVENEMENT'>('SEJOUR');
```

### 2D. loadData — remplacer l'appel

```typescript
// AVANT :
const loadData = useCallback(async () => {
  try {
    const [s, d, dl] = await Promise.all([
      getMesSejoursConvention(),
      getDisponibilites(),
      getMesDevisLibres(),
    ]);
    setSejours(s);
    setDispos(d);
    setDevisLibres(dl.filter(dl => dl.statut !== 'BROUILLON' && dl.statut !== 'REFUSE'));
  } catch {} finally {
    setLoading(false);
  }
}, []);

// APRÈS :
const loadData = useCallback(async () => {
  try {
    const [s, d] = await Promise.all([
      getMesSejoursPlanning(),
      getDisponibilites(),
    ]);
    setSejours(s);
    setDispos(d);
  } catch {} finally {
    setLoading(false);
  }
}, []);
```

### 2E. Couleurs par séjour — adapter la logique

Remplacer le bloc `couleurBySejour` :

```typescript
// AVANT :
const couleurBySejour = Object.fromEntries(
  sejours.map((s, i) => [s.id, PALETTE[i % PALETTE.length]])
);

// APRÈS :
const couleurBySejour = Object.fromEntries(
  sejours.map((s, i) => {
    if (s.statut === 'OPTION') {
      // Événements en option → violet, séjours en option → orange
      if (s.natureSejour === 'EVENEMENT') return [s.id, COULEUR_EVENEMENT_OPTION];
      return [s.id, COULEUR_STATUT.OPTION];
    }
    // CONVENTION et SIGNE_DIRECTION → palette standard
    return [s.id, PALETTE[i % PALETTE.length]];
  })
);
```

### 2F. Filtres — supprimer la logique devisLibres

**Supprimer :**
```typescript
const sejoursFiltres = filterSejourId
  ? sejours.filter(s => s.id === filterSejourId)
  : sejours;

const devisLibresFiltres = filterDevisLibreId
  ? devisLibres.filter(dl => dl.id === filterDevisLibreId)
  : devisLibres;
```

**Remplacer par :**
```typescript
const sejoursFiltres = filterSejourId
  ? sejours.filter(s => s.id === filterSejourId)
  : sejours;
```

### 2G. Fonctions `sejoursForDay` — le filtre existant fonctionne déjà

La fonction `sejoursForDay(ds)` compare `dateDebut` et `dateFin` — elle fonctionne sans changement car `SejourPlanning` a les mêmes champs.

### 2H. Combobox recherche — remplacer la section devisLibres

Dans le combobox dropdown, **supprimer tout le bloc** qui affiche les `filteredDevisLibres` (la section avec `<p>...Événements</p>` et le `filteredDevisLibres.map(dl => ...)`).

**Remplacer par une séparation Séjours / Événements dans la recherche :**

```typescript
// Combobox : séparer séjours et événements
const q = normalise(searchQuery.trim());
const filteredSejoursList = q
  ? sejours.filter(s => s.natureSejour === 'SEJOUR').filter(s =>
      normalise(s.titre).includes(q) ||
      (s.createur && normalise(`${s.createur.prenom} ${s.createur.nom}`).includes(q)) ||
      (s.clientNom && normalise(s.clientNom).includes(q)) ||
      (s.clientOrganisation && normalise(s.clientOrganisation).includes(q))
    )
  : sejours.filter(s => s.natureSejour === 'SEJOUR');

const filteredEvenements = q
  ? sejours.filter(s => s.natureSejour === 'EVENEMENT').filter(s =>
      normalise(s.titre).includes(q) ||
      (s.clientNom && normalise(s.clientNom).includes(q))
    )
  : sejours.filter(s => s.natureSejour === 'EVENEMENT');
```

**Adapter le dropdown pour afficher ces deux listes** avec les headers "Séjours" et "Événements" (même pattern visuel qu'avant, mais sur les sous-listes de `sejours` au lieu de `devisLibres`).

### 2I. Bandeau all-day — supprimer le rendu devisLibres

Dans le bandeau all-day (la `div` avec `{/* Bandeau all-day séjours */}`), **supprimer** tout le bloc `{devisLibresFiltres.filter(dl => ...).map(dl => ...)}`.

Les séjours OPTION apparaîtront naturellement via `sejoursForDay(ds)` puisqu'ils sont maintenant dans le même dataset `sejours`.

**Adapter le style du bandeau** : pour les séjours en OPTION, ajouter un effet visuel hachures. Modifier le rendu de chaque séjour dans le bandeau :

```typescript
{sj.map(s => {
  const c = couleurBySejour[s.id];
  const isStart = s.dateDebut.split('T')[0] === ds;
  const isEnd = s.dateFin.split('T')[0] === ds;
  const isOption = s.statut === 'OPTION';
  return (
    <Link
      key={s.id}
      href={`/dashboard/sejour/${s.id}`}
      onClick={e => e.stopPropagation()}
      className={`block text-xs px-1.5 py-0.5 truncate ${isOption ? 'border border-dashed' : ''}`}
      style={{
        backgroundColor: isOption ? `${c.bg}33` : c.bg,  // 20% opacity si option
        color: isOption ? c.bg : c.text,
        borderColor: isOption ? c.bg : 'transparent',
        marginLeft: isStart ? 2 : 0,
        marginRight: isEnd ? 2 : 0,
        borderRadius: isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : '0',
      }}
    >
      {isStart ? `${isOption ? '⏳ ' : ''}${s.titre}` : ''}
    </Link>
  );
})}
```

### 2J. Vue mois — même adaptation

Dans la vue mois, **supprimer** le bloc `{devisLibresFiltres.filter(dl => ...).map(dl => ...)}`.

Adapter le rendu séjours dans la vue mois de la même façon (opacité réduite + bordure dashed pour les OPTION).

### 2K. selectSejour / selectDevisLibre — simplifier

**Supprimer** `selectDevisLibre` et `resetFilters` qui gère `filterDevisLibreId`.

**Simplifier `resetFilters` :**
```typescript
const resetFilters = () => {
  setFilterSejourId(null);
  setSearchQuery('');
  setShowDropdown(false);
};
```

---

## ÉTAPE 3 — Modale planning : 3 boutons au lieu de 2

Remplacer la modale actuelle (le bloc `{showDispoModal && (...)}` en fin de page) par :

```typescript
{/* Modale choix action planning */}
{showDispoModal && !showCreateModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDispoModal(false)}>
    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
      <h2 className="text-base font-semibold text-gray-900 mb-1">
        {new Date(dispoForm.dateDebut + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </h2>
      <p className="text-xs text-gray-400 mb-5">Que souhaitez-vous faire ?</p>

      <div className="space-y-3">
        {/* Nouveau séjour */}
        <button
          onClick={() => { setCreateType('SEJOUR'); setShowCreateModal(true); }}
          className="w-full flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:border-[var(--color-primary)] hover:bg-blue-50/50 transition-colors"
        >
          <span className="text-2xl">🏫</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Nouveau séjour</p>
            <p className="text-xs text-gray-400">Classe de découverte, colonie, camp sportif…</p>
          </div>
        </button>

        {/* Nouvel événement */}
        <button
          onClick={() => { setCreateType('EVENEMENT'); setShowCreateModal(true); }}
          className="w-full flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:border-[#7B3FA0] hover:bg-purple-50/50 transition-colors"
        >
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Nouvel événement</p>
            <p className="text-xs text-gray-400">Mariage, séminaire, anniversaire, team building…</p>
          </div>
        </button>

        {/* Marquer indisponible */}
        <button
          onClick={() => {
            // Afficher directement le mini-formulaire indisponibilité
            setShowCreateModal(false);
            handleAddDispoQuick();
          }}
          className="w-full flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:border-red-400 hover:bg-red-50/50 transition-colors"
        >
          <span className="text-2xl">🚫</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Marquer indisponible</p>
            <p className="text-xs text-gray-400">Maintenance, fermeture, réservé…</p>
          </div>
        </button>
      </div>

      <button onClick={() => setShowDispoModal(false)} className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600">
        Annuler
      </button>
    </div>
  </div>
)}
```

**Ajouter la fonction `handleAddDispoQuick` :**
```typescript
const handleAddDispoQuick = async () => {
  setSaving(true);
  try {
    await createDisponibilite({
      dateDebut: dispoForm.dateDebut,
      dateFin: dispoForm.dateFin,
      capaciteDisponible: 0,
      commentaire: 'Indisponible',
    });
    await loadData();
    setShowDispoModal(false);
  } finally {
    setSaving(false);
  }
};
```

---

## ÉTAPE 4 — Modale création séjour DIRECT

Ajouter cette modale APRÈS la modale choix action :

```typescript
{/* Modale création séjour / événement DIRECT */}
{showCreateModal && (
  <CreateSejourDirectModal
    natureSejour={createType}
    dateDebut={dispoForm.dateDebut}
    dateFin={dispoForm.dateFin}
    onClose={() => { setShowCreateModal(false); setShowDispoModal(false); }}
    onCreated={(sejour) => {
      setShowCreateModal(false);
      setShowDispoModal(false);
      loadData();
      router.push(`/dashboard/sejour/${sejour.id}`);
    }}
  />
)}
```

**Créer le composant `CreateSejourDirectModal` dans le même fichier, AVANT le `export default` :**

> Ce composant est une modale avec :
> - Sélecteur de sous-type (selon natureSejour)
> - Champs titre, dates (pré-remplies), nb participants
> - StructureSearch (recherche SIRENE / API EN / LIAVO) — réutiliser la logique de `inviter-enseignant/page.tsx`
> - Champs email contact, nom contact, téléphone
> - Bouton "Créer le séjour"

```typescript
const SOUS_TYPES_SEJOUR = [
  { value: 'CLASSE_DECOUVERTE', label: 'Classe de découverte' },
  { value: 'COLONIE_VACANCES', label: 'Colonie de vacances' },
  { value: 'CAMP_SPORTIF', label: 'Camp sportif' },
  { value: 'SEJOUR_LINGUISTIQUE', label: 'Séjour linguistique' },
  { value: 'AUTRE_SEJOUR', label: 'Autre séjour' },
];

const SOUS_TYPES_EVENEMENT = [
  { value: 'MARIAGE', label: 'Mariage' },
  { value: 'ANNIVERSAIRE', label: 'Anniversaire' },
  { value: 'SEMINAIRE', label: 'Séminaire' },
  { value: 'TEAM_BUILDING', label: 'Team building' },
  { value: 'REUNION_FAMILLE', label: 'Réunion de famille' },
  { value: 'AUTRE_EVENEMENT', label: 'Autre événement' },
];

function CreateSejourDirectModal({ natureSejour, dateDebut, dateFin, onClose, onCreated }: {
  natureSejour: 'SEJOUR' | 'EVENEMENT';
  dateDebut: string;
  dateFin: string;
  onClose: () => void;
  onCreated: (sejour: any) => void;
}) {
  const [form, setForm] = useState({
    titre: '',
    typeSejour: natureSejour === 'SEJOUR' ? 'CLASSE_DECOUVERTE' : 'MARIAGE',
    dateDebut,
    dateFin,
    nombreParticipants: '',
    clientNom: '',
    clientPrenom: '',
    clientEmail: '',
    clientTelephone: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // StructureSearch state
  const [structNom, setStructNom] = useState('');
  const [structVille, setStructVille] = useState('');
  const [structResults, setStructResults] = useState<Array<{
    nom: string; adresse: string | null; ville: string | null;
    siren: string | null; siret: string | null; source: string;
  }>>([]);
  const [structSearching, setStructSearching] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<{
    nom: string; adresse: string | null; ville: string | null; id?: string;
  } | null>(null);
  const structDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const structAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (structDebounceRef.current) clearTimeout(structDebounceRef.current);
      if (structAbortRef.current) structAbortRef.current.abort();
    };
  }, []);

  const fireStructSearch = (nom: string, ville: string) => {
    if (structDebounceRef.current) clearTimeout(structDebounceRef.current);
    const q = [nom.trim(), ville.trim()].filter(Boolean).join(' ');
    if (q.length < 2) { setStructResults([]); return; }

    structDebounceRef.current = setTimeout(async () => {
      if (structAbortRef.current) structAbortRef.current.abort();
      const controller = new AbortController();
      structAbortRef.current = controller;
      setStructSearching(true);
      try {
        const res = await api.get('/organisations/search', { params: { q }, signal: controller.signal });
        setStructResults(res.data?.results ?? []);
      } catch { /* aborted */ }
      finally { if (!controller.signal.aborted) setStructSearching(false); }
    }, 300);
  };

  const selectStruct = (r: typeof structResults[0]) => {
    setSelectedOrg({ nom: r.nom, adresse: r.adresse, ville: r.ville });
    setStructResults([]);
    setStructNom(r.nom);
    setStructVille(r.ville ?? '');
  };

  const clearStruct = () => {
    setSelectedOrg(null);
    setStructNom('');
    setStructVille('');
    setStructResults([]);
  };

  const sousTypes = natureSejour === 'SEJOUR' ? SOUS_TYPES_SEJOUR : SOUS_TYPES_EVENEMENT;
  const labelParticipants = natureSejour === 'SEJOUR' ? 'Nombre de participants' : 'Nombre de personnes';
  const labelContact = natureSejour === 'SEJOUR' ? 'Structure organisatrice' : 'Client';

  const handleSubmit = async () => {
    if (!form.titre.trim()) { setError('Le titre est obligatoire'); return; }
    if (!form.dateDebut || !form.dateFin) { setError('Les dates sont obligatoires'); return; }

    setSaving(true);
    setError(null);
    try {
      const sejour = await createSejourDirect({
        titre: form.titre.trim(),
        natureSejour,
        typeSejour: form.typeSejour,
        dateDebut: form.dateDebut,
        dateFin: form.dateFin,
        nombreParticipants: parseInt(form.nombreParticipants) || 0,
        clientNom: form.clientNom.trim() || undefined,
        clientPrenom: form.clientPrenom.trim() || undefined,
        clientEmail: form.clientEmail.trim() || undefined,
        clientTelephone: form.clientTelephone.trim() || undefined,
        clientOrganisation: selectedOrg?.nom || undefined,
      });
      onCreated(sejour);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          {natureSejour === 'SEJOUR' ? '📋 Nouveau séjour' : '🎉 Nouvel événement'}
        </h2>
        <p className="text-xs text-gray-400 mb-5">Les dates seront bloquées au planning dès la création.</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        <div className="space-y-4">
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select value={form.typeSejour} onChange={set('typeSejour')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
              {sousTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Titre */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Titre</label>
            <input type="text" value={form.titre} onChange={set('titre')}
              placeholder={natureSejour === 'SEJOUR' ? 'ex: Classe de neige 4ème' : 'ex: Mariage Dupont-Martin'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date début</label>
              <input type="date" value={form.dateDebut} onChange={set('dateDebut')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date fin</label>
              <input type="date" value={form.dateFin} onChange={set('dateFin')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
          </div>

          {/* Nb participants */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{labelParticipants}</label>
            <input type="number" min="0" value={form.nombreParticipants} onChange={set('nombreParticipants')}
              placeholder="ex: 48"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>

          {/* Séparateur */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">{labelContact}</p>
          </div>

          {/* StructureSearch */}
          {!selectedOrg ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={structNom} placeholder="Nom de la structure"
                  onChange={e => { setStructNom(e.target.value); fireStructSearch(e.target.value, structVille); }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                <input type="text" value={structVille} placeholder="Ville"
                  onChange={e => { setStructVille(e.target.value); fireStructSearch(structNom, e.target.value); }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              {structSearching && <p className="text-xs text-gray-400">Recherche en cours…</p>}
              {structResults.length > 0 && (
                <div className="rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
                  {structResults.map((r, i) => (
                    <button key={i} type="button" onClick={() => selectStruct(r)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
                      <span className="font-medium text-gray-900">{r.nom}</span>
                      {r.ville && <span className="text-gray-400"> — {r.ville}</span>}
                      <span className="text-gray-300 ml-1">({r.source === 'API_SIRENE' ? 'SIRENE' : r.source})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedOrg.nom}</p>
                {selectedOrg.ville && <p className="text-xs text-gray-400">{selectedOrg.adresse ? `${selectedOrg.adresse}, ` : ''}{selectedOrg.ville}</p>}
              </div>
              <button type="button" onClick={clearStruct} className="text-xs text-red-500 hover:underline">Changer</button>
            </div>
          )}

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom du contact</label>
              <input type="text" value={form.clientNom} onChange={set('clientNom')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prénom</label>
              <input type="text" value={form.clientPrenom} onChange={set('clientPrenom')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.clientEmail} onChange={set('clientEmail')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
              <input type="tel" value={form.clientTelephone} onChange={set('clientTelephone')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={saving || !form.titre.trim()}
            className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Création…' : natureSejour === 'SEJOUR' ? 'Créer le séjour' : 'Créer l\'événement'}
          </button>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
```

**IMPORTANT** : Le composant `CreateSejourDirectModal` utilise `api` (axios) et `useRef`/`useEffect`/`useState`. Vérifier que `api` est importé dans le fichier. Ajouter si manquant :
```typescript
import api from '@/src/lib/api';
```

---

## ÉTAPE 5 — Légende planning

Ajouter une légende en bas de la grille (APRÈS le `</main>` et AVANT la modale) :

```typescript
{/* Légende */}
{!loading && (
  <div className="px-4 pb-4">
    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm border border-dashed border-[#F59E0B]" style={{ backgroundColor: '#F59E0B33' }} />
        Option (séjour)
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm border border-dashed border-[#7B3FA0]" style={{ backgroundColor: '#7B3FA033' }} />
        Option (événement)
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#1B6CA8' }} />
        Confirmé
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'repeating-linear-gradient(45deg, #fee2e2, #fee2e2 2px, #fef2f2 2px, #fef2f2 4px)' }} />
        Indisponible
      </div>
    </div>
  </div>
)}
```

---

## ÉTAPE 6 — Nettoyage imports inutilisés

Vérifier qu'il ne reste aucune référence à :
- `DevisLibre` (type)
- `getMesDevisLibres` (fonction)
- `devisLibres` (state)
- `filterDevisLibreId` (state)
- `devisLibresFiltres` (computed)
- `COULEUR_DL` (constante)
- `selectDevisLibre` (fonction)

Supprimer toutes les références restantes.

---

## ÉTAPE 7 — Build et vérification

```bash
cd frontend
npm run build
```

Vérifier : 0 erreur TypeScript. Les warnings ESLint sur les hooks sont acceptables (ne pas bloquer pour ça).

---

## RÉSUMÉ DES FICHIERS MODIFIÉS

| Fichier | Action |
|---|---|
| `frontend/src/lib/collaboration.ts` | Ajout SejourPlanning type + getMesSejoursPlanning() + createSejourDirect() + deleteSejourDirect() |
| `frontend/app/dashboard/hebergeur/planning/page.tsx` | Remplacement dataset DevisLibres → SejourPlanning, modale 3 boutons, formulaire création, légende, couleurs |

## FICHIERS À NE PAS MODIFIER
- `frontend/src/lib/devis-libres.ts` — sera supprimé en Phase 5 (pas maintenant)
- `frontend/app/dashboard/hebergeur/devis-libres/**` — sera supprimé en Phase 5
- `frontend/app/dashboard/sejour/[id]/page.tsx` — sera adapté en Phase 3
