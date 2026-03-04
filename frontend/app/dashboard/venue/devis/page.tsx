'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesDevis } from '@/src/lib/devis';
import type { Devis, StatutDevis } from '@/src/lib/devis';

const STATUT_BADGE: Record<StatutDevis, { label: string; cls: string }> = {
  EN_ATTENTE: { label: 'En attente', cls: 'bg-orange-100 text-orange-700' },
  ACCEPTE:    { label: 'Accepté',    cls: 'bg-green-100 text-green-700' },
  REFUSE:     { label: 'Refusé',     cls: 'bg-red-100 text-red-700' },
};

export default function VenueDevisPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'VENUE')) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === 'VENUE') {
      getMesDevis()
        .then(setDevisList)
        .catch(() => setError('Impossible de charger les devis.'));
    }
  }, [user]);

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/venue" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Devis envoyés</h1>
        <p className="text-sm text-gray-500 mb-8">Suivez vos propositions et devis en cours</p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {devisList.length === 0 && !error ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <p className="text-sm text-gray-500">Aucun devis envoyé pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {devisList.map((d) => {
              const badge = STATUT_BADGE[d.statut] ?? STATUT_BADGE.EN_ATTENTE;
              return (
                <div key={d.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{d.demande?.titre ?? 'Demande'}</h3>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Total : {d.montantTotal} €</span>
                        <span>Par élève : {d.montantParEleve} €</span>
                        {d.demande?.enseignant && <span>{d.demande.enseignant.prenom} {d.demande.enseignant.nom}</span>}
                        <span>{new Date(d.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                      {d.description && <p className="mt-2 text-sm text-gray-600">{d.description}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
