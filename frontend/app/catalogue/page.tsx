'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { searchHebergementsPublic } from '@/src/lib/hebergement';
import type { Hebergement, SearchHebergementParams } from '@/src/lib/hebergement';
import { Logo } from '@/app/components/Logo';

const REGIONS = [
  'Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Bretagne',
  'Centre-Val de Loire','Corse','Grand Est','Hauts-de-France',
  'Île-de-France','Normandie','Nouvelle-Aquitaine','Occitanie',
  'Pays de la Loire',"Provence-Alpes-Côte d'Azur",
];

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

// ─── Autocomplete générique (ville + département via geo.api.gouv.fr) ────────

interface Suggestion { label: string; sub?: string; }

function Autocomplete({ value, onChange, placeholder, fetchSuggestions }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  fetchSuggestions: (q: string) => Promise<Suggestion[]>;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleInput = (val: string) => {
    onChange(val);
    if (val.length < 2) { setSuggestions([]); setOpen(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const r = await fetchSuggestions(val);
      setSuggestions(r);
      setOpen(r.length > 0);
    }, 250);
  };

  const select = (s: Suggestion) => { onChange(s.label); setSuggestions([]); setOpen(false); };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text" value={value} onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        placeholder={placeholder} className={inputCls} autoComplete="off"
      />
      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button type="button" onClick={() => select(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-primary-light)] transition-colors flex items-baseline gap-2">
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

async function fetchVilleSuggestions(q: string): Promise<Suggestion[]> {
  try {
    const params = new URLSearchParams({ nom: q, limit: '8', fields: 'nom,codesPostaux,codeDepartement' });
    const res = await fetch(`https://geo.api.gouv.fr/communes?${params}`);
    const data: { nom: string; codesPostaux: string[]; codeDepartement: string }[] = await res.json();
    return data.map((c) => ({ label: c.nom, sub: `${c.codesPostaux[0]} — dép. ${c.codeDepartement}` }));
  } catch { return []; }
}

async function fetchDepartementSuggestions(q: string): Promise<Suggestion[]> {
  try {
    const params = new URLSearchParams({ nom: q, limit: '8', fields: 'nom,code' });
    const res = await fetch(`https://geo.api.gouv.fr/departements?${params}`);
    const data: { nom: string; code: string }[] = await res.json();
    return data.map((d) => ({ label: d.nom, sub: `Dép. ${d.code}` }));
  } catch { return []; }
}

async function fetchRegionSuggestions(q: string): Promise<Suggestion[]> {
  return REGIONS.filter((r) => r.toLowerCase().includes(q.toLowerCase())).map((r) => ({ label: r }));
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CataloguePage() {
  const [hebergements, setHebergements] = useState<Hebergement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [ville, setVille] = useState('');
  const [departement, setDepartement] = useState('');
  const [region, setRegion] = useState('');

  const fetchData = useCallback(async (params?: SearchHebergementParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchHebergementsPublic(params);
      setHebergements(data.results);
      setTotal(data.total);
    } catch { setError('Erreur lors du chargement.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params: SearchHebergementParams = {};
    if (nom.trim())         params.nom         = nom.trim();
    if (ville.trim())       params.ville       = ville.trim();
    if (departement.trim()) params.departement = departement.trim();
    if (region.trim())      params.region      = region.trim();
    fetchData(params);
  };

  const handleReset = () => {
    setNom(''); setVille(''); setDepartement(''); setRegion('');
    fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/"><Logo size="sm" showTagline={false} /></Link>
            <div className="flex items-center gap-4">
              <Link href="/register?type=hebergeur"
                className="text-sm font-medium text-[var(--color-primary)] hover:underline hidden sm:inline">
                Inscrire mon centre
              </Link>
              <Link href="/appel-offres"
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
                Lancer un appel d&apos;offres
              </Link>
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Source */}
        <p className="text-xs text-gray-400 mb-4">
          Sources : catalogue officiel Éducation nationale — data.education.gouv.fr + centres partenaires LIAVO
        </p>

        {/* Filtres */}
        <form onSubmit={handleSearch}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Rechercher un hébergement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nom</label>
              <input type="text" value={nom} onChange={(e) => setNom(e.target.value)}
                placeholder="Ex : Centre des Alpes" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ville</label>
              <Autocomplete value={ville} onChange={setVille}
                placeholder="Ex : Chamonix" fetchSuggestions={fetchVilleSuggestions} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Département</label>
              <Autocomplete value={departement} onChange={setDepartement}
                placeholder="Ex : Haute-Savoie" fetchSuggestions={fetchDepartementSuggestions} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Région</label>
              <Autocomplete value={region} onChange={setRegion}
                placeholder="Ex : Bretagne" fetchSuggestions={fetchRegionSuggestions} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit"
              className="inline-flex items-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity">
              Rechercher
            </button>
            <button type="button" onClick={handleReset}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
              Réinitialiser
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        )}

        {!loading && hebergements.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucun hébergement trouvé avec ces critères.
            <br />
            <Link href="/appel-offres"
              className="text-[var(--color-primary)] font-medium hover:underline mt-2 inline-block">
              Lancer un appel d&apos;offres dans cette zone →
            </Link>
          </div>
        )}

        {!loading && hebergements.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {hebergements.length} affiché{hebergements.length > 1 ? 's' : ''} sur {total} résultat{total > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hebergements.map((h) => (
                <Link key={h.id} href={`/catalogue/${h.id}`}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-[var(--color-border-strong)] transition-all group">
                  {h.image && (
                    <div className="mb-3 -mx-5 -mt-5 overflow-hidden rounded-t-2xl">
                      <img src={h.image} alt={h.nom} className="w-full h-36 object-cover" />
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-900 group-hover:text-[var(--color-primary)] transition-colors line-clamp-2 mb-2">
                    {h.nom}
                  </h3>
                  <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {h.ville}{h.departement ? ` (${h.departement})` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mb-3">{h.region}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    {h.capaciteEleves != null && <span>{h.capaciteEleves} lits élèves</span>}
                    {h.capaciteAdultes != null && <span>{h.capaciteAdultes} lits adultes</span>}
                  </div>
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

      {/* Footer CTA hébergeur */}
      <div className="bg-[var(--color-primary)] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-white font-semibold text-lg mb-1">Votre centre n&apos;est pas encore listé ?</p>
            <p className="text-white/70 text-sm">
              Inscrivez-vous gratuitement et recevez des demandes d&apos;organisateurs dans votre zone.
            </p>
          </div>
          <Link href="/register?type=hebergeur"
            className="shrink-0 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-gray-100 transition-colors">
            Référencer mon centre →
          </Link>
        </div>
      </div>

      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-400">
        Sources : catalogue officiel Éducation nationale · data.education.gouv.fr + centres partenaires LIAVO ·{' '}
        <Link href="/legal/mentions-legales" className="hover:underline">Mentions légales</Link>
      </footer>
    </div>
  );
}
