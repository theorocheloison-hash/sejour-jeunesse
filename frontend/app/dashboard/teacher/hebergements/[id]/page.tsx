'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getHebergement } from '@/src/lib/hebergement';
import type { Hebergement } from '@/src/lib/hebergement';

export default function HebergementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [hebergement, setHebergement] = useState<Hebergement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'TEACHER')) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'TEACHER' && params.id) {
      setLoading(true);
      getHebergement(params.id as string)
        .then(setHebergement)
        .catch(() => setError('Hébergement introuvable.'))
        .finally(() => setLoading(false));
    }
  }, [user, params.id]);

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">Détail hébergement</span>
            </div>
            <Link href="/dashboard/teacher/hebergements" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              ← Retour au catalogue
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        )}

        {!loading && hebergement && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Image */}
            {hebergement.image && (
              <img src={hebergement.image} alt={hebergement.nom} className="w-full h-56 object-cover" />
            )}

            {/* En-tête */}
            <div className="p-6 sm:p-8 border-b border-gray-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{hebergement.nom}</h1>
                  <p className="mt-1 text-sm text-gray-500 flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {hebergement.ville} ({hebergement.departement}), {hebergement.region}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  {hebergement.accessible && (
                    <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-3 py-1 text-sm font-medium">
                      Accessible PMR
                    </span>
                  )}
                  {hebergement.avisSecurite === 'Favorable' && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-sm font-medium">
                      Avis favorable
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sections */}
            <div className="divide-y divide-gray-200">
              {/* Localisation */}
              <Section title="Localisation">
                <Row label="Ville" value={hebergement.ville} />
                <Row label="Code postal" value={hebergement.codePostal} />
                <Row label="Département" value={hebergement.departement} />
                <Row label="Région" value={hebergement.region} />
              </Section>

              {/* Capacité */}
              <Section title="Capacité et accueil">
                <Row label="Lits élèves" value={hebergement.capaciteEleves != null ? `${hebergement.capaciteEleves}` : '—'} />
                <Row label="Lits adultes (encadrement)" value={hebergement.capaciteAdultes != null ? `${hebergement.capaciteAdultes}` : '—'} />
                <Row label="Accessibilité handicap" value={hebergement.accessible ? 'Oui' : 'Non'} />
                <Row label="Avis sécurité" value={hebergement.avisSecurite ?? '—'} />
                <Row label="Période d'ouverture" value={hebergement.periodeOuverture ?? '—'} />
              </Section>

              {/* Contact */}
              {hebergement.contact && (
                <Section title="Contact">
                  <div className="px-6 py-4 text-sm text-gray-700 whitespace-pre-line">
                    {hebergement.contact}
                  </div>
                </Section>
              )}

              {/* Thématiques */}
              {hebergement.thematiques.length > 0 && (
                <div>
                  <div className="bg-gray-50 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Thématiques
                  </div>
                  <div className="px-6 py-4 flex flex-wrap gap-2">
                    {hebergement.thematiques.map((t) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] px-3 py-1 text-sm font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Activités */}
              {hebergement.activites.length > 0 && (
                <div>
                  <div className="bg-gray-50 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Activités proposées
                  </div>
                  <div className="px-6 py-4 flex flex-wrap gap-2">
                    {hebergement.activites.map((a) => (
                      <span key={a} className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-sm font-medium">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {hebergement.description && (
                <Section title="Description">
                  <div className="px-6 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {hebergement.description}
                  </div>
                </Section>
              )}

              {/* Lien fiche officielle */}
              {hebergement.permalien && (
                <div className="px-6 py-4">
                  <a
                    href={hebergement.permalien}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    Voir la fiche officielle
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-gray-50 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-3">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right font-medium">{value}</span>
    </div>
  );
}
