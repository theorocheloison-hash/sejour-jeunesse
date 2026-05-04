'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { searchCentresPublics } from '@/src/lib/public';
import type { CentrePublic } from '@/src/lib/public';
import { Logo } from '@/app/components/Logo';

const REGIONS = [
  'Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Bretagne',
  'Centre-Val de Loire','Corse','Grand Est','Hauts-de-France',
  'Île-de-France','Normandie','Nouvelle-Aquitaine','Occitanie',
  'Pays de la Loire',"Provence-Alpes-Côte d'Azur",
];

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

export default function CataloguePage() {
  const [search, setSearch] = useState('');
  const [centres, setCentres] = useState<CentrePublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setCentres([]); setHasSearched(false); return; }
    setLoading(true);
    setHasSearched(true);
    try {
      const results = await searchCentresPublics(q);
      setCentres(results);
    } catch { setCentres([]); }
    finally { setLoading(false); }
  }, []);

  const handleChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/"><Logo size="sm" showTagline={false} /></Link>
            <div className="flex items-center gap-4">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Hero recherche */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Trouvez votre hébergement de séjour scolaire
          </h1>
          <p className="text-gray-500 mb-6 max-w-xl mx-auto">
            Catalogue officiel — centres labellisés Éducation Nationale et partenaires LIAVO.
            Comparez, contactez, organisez.
          </p>
          <div className="max-w-xl mx-auto relative">
            <input
              type="text"
              value={search}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Rechercher par nom, ville, département…"
              className={`${inputCls} py-3 pl-10 text-base`}
              autoFocus
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* CTA appel d'offres */}
        <div className="bg-[var(--color-primary-light)] border border-[var(--color-border-strong)] rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-[var(--color-primary)]">Vous ne savez pas encore où aller ?</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Lancez un appel d&apos;offres géographique — les centres de votre zone vous répondent directement.
            </p>
          </div>
          <Link href="/appel-offres"
            className="shrink-0 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
            Lancer un appel d&apos;offres →
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        )}

        {/* État vide initial */}
        {!loading && !hasSearched && (
          <div className="text-center py-16 text-gray-400">
            <svg className="h-12 w-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">Tapez au moins 2 caractères pour rechercher</p>
          </div>
        )}

        {/* Aucun résultat */}
        {!loading && hasSearched && centres.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucun centre trouvé pour « {search} ».
            <br />
            <Link href="/appel-offres" className="text-[var(--color-primary)] font-medium hover:underline mt-2 inline-block">
              Lancer un appel d&apos;offres dans cette zone →
            </Link>
          </div>
        )}

        {/* Grille résultats */}
        {!loading && centres.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {centres.map((c) => (
              <Link key={c.id} href={`/catalogue/${c.id}`}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-[var(--color-border-strong)] transition-all group">
                {c.imageUrl && (
                  <div className="mb-3 -mx-5 -mt-5 overflow-hidden rounded-t-2xl">
                    <img src={c.imageUrl} alt={c.nom} className="w-full h-36 object-cover" />
                  </div>
                )}
                <h3 className="font-semibold text-gray-900 group-hover:text-[var(--color-primary)] transition-colors line-clamp-2 mb-2">
                  {c.nom}
                </h3>
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {c.ville}{c.departement ? ` (${c.departement})` : ''}
                </p>
                {c.capacite && (
                  <p className="text-xs text-gray-400 mb-3">{c.capacite} lits</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {c.agrementEducationNationale && (
                    <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2 py-0.5 text-xs font-medium">
                      Agréé EN
                    </span>
                  )}
                  {c.accessiblePmr && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium">
                      PMR
                    </span>
                  )}
                  {(c.thematiquesCentre ?? c.thematiques ?? []).slice(0, 2).map((t) => (
                    <span key={t} className="inline-flex items-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] px-2 py-0.5 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer minimal */}
      <footer className="border-t border-gray-200 mt-16 py-6 text-center text-xs text-gray-400">
        Sources : catalogue officiel Éducation nationale · data.education.gouv.fr + centres partenaires LIAVO ·{' '}
        <Link href="/legal/mentions-legales" className="hover:underline">Mentions légales</Link>
      </footer>
    </div>
  );
}
