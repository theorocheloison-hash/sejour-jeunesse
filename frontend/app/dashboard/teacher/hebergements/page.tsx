'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { searchHebergements } from '@/src/lib/hebergement';
import type { Hebergement, SearchHebergementParams } from '@/src/lib/hebergement';

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HebergementsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [hebergements, setHebergements] = useState<Hebergement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [ville, setVille] = useState('');
  const [region, setRegion] = useState('');
  const [capaciteMin, setCapaciteMin] = useState('');
  const [capaciteMax, setCapaciteMax] = useState('');

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
    if (ville.trim()) params.ville = ville.trim();
    if (region.trim()) params.region = region.trim();
    if (capaciteMin) params.capaciteMin = parseInt(capaciteMin, 10);
    if (capaciteMax) params.capaciteMax = parseInt(capaciteMax, 10);
    fetchHebergements(params);
  };

  const handleReset = () => {
    setVille('');
    setRegion('');
    setCapaciteMin('');
    setCapaciteMax('');
    fetchHebergements();
  };

  if (authLoading) return null;

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
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
          Source : catalogue officiel Éducation nationale — data.education.gouv.fr
        </p>

        {/* Filtres */}
        <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Rechercher un hébergement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ville</label>
              <input
                type="text"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                placeholder="Ex : Chamonix"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Région</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Ex : Bretagne"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Capacité min (lits élèves)</label>
              <input
                type="number"
                value={capaciteMin}
                onChange={(e) => setCapaciteMin(e.target.value)}
                min={1}
                placeholder="20"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Capacité max (lits élèves)</label>
              <input
                type="number"
                value={capaciteMax}
                onChange={(e) => setCapaciteMax(e.target.value)}
                min={1}
                placeholder="100"
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
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
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-indigo-200 transition-all group"
                >
                  {/* Image */}
                  {h.image && (
                    <div className="mb-3 -mx-5 -mt-5 overflow-hidden rounded-t-2xl">
                      <img src={h.image} alt={h.nom} className="w-full h-36 object-cover" />
                    </div>
                  )}

                  {/* Nom */}
                  <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-2">
                    {h.nom}
                  </h3>

                  {/* Localisation */}
                  <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {h.ville} ({h.departement})
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
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                        Accessible PMR
                      </span>
                    )}
                    {h.avisSecurite === 'Favorable' && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                        Avis favorable
                      </span>
                    )}
                    {h.thematiques.slice(0, 2).map((t) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-600 px-2 py-0.5 text-xs">
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
