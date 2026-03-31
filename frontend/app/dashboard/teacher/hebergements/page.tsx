'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';
import { searchHebergements } from '@/src/lib/hebergement';
import type { Hebergement, SearchHebergementParams } from '@/src/lib/hebergement';

// ─── Régions métropolitaines ─────────────────────────────────────────────────

const REGIONS = [
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Corse',
  'Grand Est',
  'Hauts-de-France',
  'Île-de-France',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  'Provence-Alpes-Côte d\'Azur',
];

// ─── Autocomplete générique ──────────────────────────────────────────────────

interface Suggestion {
  label: string;
  sub?: string;
}

function Autocomplete({
  value,
  onChange,
  placeholder,
  fetchSuggestions,
  inputCls,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  fetchSuggestions: (query: string) => Promise<Suggestion[]>;
  inputCls: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleInput = (val: string) => {
    onChange(val);
    if (val.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(val);
      setSuggestions(results);
      setOpen(results.length > 0);
    }, 250);
  };

  const select = (s: Suggestion) => {
    onChange(s.label);
    setSuggestions([]);
    setOpen(false);
  };

  // Fermer quand on clique ailleurs
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        placeholder={placeholder}
        className={inputCls}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => select(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-primary-light)] transition-colors flex items-baseline gap-2"
              >
                <span className="font-medium text-gray-900">{s.label}</span>
                {s.sub && <span className="text-xs text-gray-400">{s.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Helpers fetch suggestions ───────────────────────────────────────────────

async function fetchVilleSuggestions(query: string): Promise<Suggestion[]> {
  try {
    const params = new URLSearchParams({ nom: query, limit: '8', fields: 'nom,codesPostaux,codeDepartement' });
    const res = await fetch(`https://geo.api.gouv.fr/communes?${params}`);
    const data: { nom: string; codesPostaux: string[]; codeDepartement: string }[] = await res.json();
    return data.map((c) => ({
      label: c.nom,
      sub: `${c.codesPostaux[0]} — dép. ${c.codeDepartement}`,
    }));
  } catch {
    return [];
  }
}

async function fetchNomSuggestions(query: string): Promise<Suggestion[]> {
  try {
    const { data } = await api.get<{ id: string; nom: string; ville: string }[]>('/centres/search-public', { params: { search: query } });
    return data.map((c) => ({ label: c.nom, sub: c.ville }));
  } catch {
    return [];
  }
}

async function fetchDepartementSuggestions(query: string): Promise<Suggestion[]> {
  try {
    const params = new URLSearchParams({ nom: query, limit: '8', fields: 'nom,code' });
    const res = await fetch(`https://geo.api.gouv.fr/departements?${params}`);
    const data: { nom: string; code: string }[] = await res.json();
    return data.map((d) => ({ label: d.nom, sub: `Dép. ${d.code}` }));
  } catch {
    return [];
  }
}

async function fetchRegionSuggestions(query: string): Promise<Suggestion[]> {
  const q = query.toLowerCase();
  return REGIONS
    .filter((r) => r.toLowerCase().includes(q))
    .map((r) => ({ label: r }));
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HebergementsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [hebergements, setHebergements] = useState<Hebergement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [nom, setNom] = useState('');
  const [ville, setVille] = useState('');
  const [departement, setDepartement] = useState('');
  const [region, setRegion] = useState('');

  const fetchHebergements = useCallback(async (params?: SearchHebergementParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchHebergements(params);
      setHebergements(data.results);
      setTotal(data.total);
    } catch {
      setError('Erreur lors du chargement des hébergements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'TEACHER')) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'TEACHER') {
      fetchHebergements();
    }
  }, [user, fetchHebergements]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params: SearchHebergementParams = {};
    if (nom.trim()) params.nom = nom.trim();
    if (ville.trim()) params.ville = ville.trim();
    if (departement.trim()) params.departement = departement.trim();
    if (region.trim()) params.region = region.trim();
    fetchHebergements(params);
  };

  const handleReset = () => {
    setNom('');
    setVille('');
    setDepartement('');
    setRegion('');
    fetchHebergements();
  };

  if (authLoading) return null;

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">Catalogue officiel des hébergements</span>
            </div>
            <Link href="/dashboard/teacher" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              ← Retour au tableau de bord
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Source */}
        <p className="text-xs text-gray-400 mb-4">
          Sources : catalogue officiel Éducation nationale — data.education.gouv.fr + centres partenaires Liavo
        </p>

        {/* Filtres */}
        <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Rechercher un hébergement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nom</label>
              <Autocomplete
                value={nom}
                onChange={setNom}
                placeholder="Ex : Centre des Alpes"
                fetchSuggestions={fetchNomSuggestions}
                inputCls={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ville</label>
              <Autocomplete
                value={ville}
                onChange={setVille}
                placeholder="Ex : Chamonix"
                fetchSuggestions={fetchVilleSuggestions}
                inputCls={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Département</label>
              <Autocomplete
                value={departement}
                onChange={setDepartement}
                placeholder="Ex : Haute-Savoie"
                fetchSuggestions={fetchDepartementSuggestions}
                inputCls={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Région</label>
              <Autocomplete
                value={region}
                onChange={setRegion}
                placeholder="Ex : Bretagne"
                fetchSuggestions={fetchRegionSuggestions}
                inputCls={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            >
              Rechercher
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              Réinitialiser
            </button>
          </div>
        </form>

        {/* Erreur */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        )}

        {/* Résultats */}
        {!loading && hebergements.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucun hébergement trouvé avec ces critères.
          </div>
        )}

        {!loading && hebergements.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {hebergements.length} affiché{hebergements.length > 1 ? 's' : ''} sur {total} résultat{total > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hebergements.map((h) => (
                <Link
                  key={h.id}
                  href={`/dashboard/teacher/hebergements/${h.id}`}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-[var(--color-border-strong)] transition-all group"
                >
                  {/* Image */}
                  {h.image && (
                    <div className="mb-3 -mx-5 -mt-5 overflow-hidden rounded-t-2xl">
                      <img src={h.image} alt={h.nom} className="w-full h-36 object-cover" />
                    </div>
                  )}

                  {/* Nom */}
                  <h3 className="font-semibold text-gray-900 group-hover:text-[var(--color-primary)] transition-colors line-clamp-2 mb-2">
                    {h.nom}
                  </h3>

                  {/* Localisation */}
                  <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {h.ville}{h.departement ? ` (${h.departement})` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mb-3">{h.region}</p>

                  {/* Capacité */}
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    {h.capaciteEleves != null && <span>{h.capaciteEleves} lits élèves</span>}
                    {h.capaciteAdultes != null && <span>{h.capaciteAdultes} lits adultes</span>}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {h.accessible && (
                      <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2 py-0.5 text-xs font-medium">
                        Accessible PMR
                      </span>
                    )}
                    {h.avisSecurite === 'Favorable' && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                        Avis favorable
                      </span>
                    )}
                    {h.thematiques.slice(0, 2).map((t) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] px-2 py-0.5 text-xs">
                        {t}
                      </span>
                    ))}
                    {h.thematiques.length > 2 && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-500 px-2 py-0.5 text-xs">
                        +{h.thematiques.length - 2}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
