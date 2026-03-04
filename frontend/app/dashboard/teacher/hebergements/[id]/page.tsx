'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getHebergement } from '@/src/lib/hebergement';
import type { Hebergement } from '@/src/lib/hebergement';

const TYPE_LABELS: Record<string, string> = {
  chalet: 'Chalet',
  tente: 'Tente',
  auberge: 'Auberge',
  hotel: 'Hôtel',
  gite: 'Gîte',
  autre: 'Autre',
};

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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
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
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        )}

        {!loading && hebergement && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
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
                    {hebergement.ville}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 px-3 py-1 text-sm font-medium">
                    {TYPE_LABELS[hebergement.type] ?? 'Autre'}
                  </span>
                  {hebergement.agrement && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-sm font-medium">
                      Agréé
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
                <Row label="Adresse" value={hebergement.adresse ?? '—'} />
              </Section>

              {/* Caractéristiques */}
              <Section title="Caractéristiques">
                <Row label="Type" value={TYPE_LABELS[hebergement.type] ?? 'Autre'} />
                <Row label="Capacité" value={`${hebergement.capacite} places`} />
                <Row label="Prix par jour" value={hebergement.prixParJour != null ? `${hebergement.prixParJour} €` : '—'} />
                <Row label="Agrément" value={hebergement.agrement ? 'Oui' : 'Non'} />
              </Section>

              {/* Contact */}
              {(hebergement.telephone || hebergement.email) && (
                <Section title="Contact">
                  {hebergement.telephone && <Row label="Téléphone" value={hebergement.telephone} />}
                  {hebergement.email && <Row label="Email" value={hebergement.email} />}
                </Section>
              )}

              {/* Activités */}
              {hebergement.activites.length > 0 && (
                <div>
                  <div className="bg-gray-50 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Activités proposées
                  </div>
                  <div className="px-6 py-4 flex flex-wrap gap-2">
                    {hebergement.activites.map((a) => (
                      <span key={a} className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-sm font-medium">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {hebergement.description && (
                <Section title="Description">
                  <div className="px-6 py-4 text-sm text-gray-700 leading-relaxed">
                    {hebergement.description}
                  </div>
                </Section>
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
