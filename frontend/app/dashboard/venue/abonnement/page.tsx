'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getAbonnementStatut, simulerAbonnement } from '@/src/lib/abonnement';
import type { AbonnementStatut, TypeAbonnement } from '@/src/lib/abonnement';

const PLANS: { type: TypeAbonnement; label: string; prix: string; desc: string }[] = [
  { type: 'MENSUEL', label: 'Mensuel', prix: '19 €/mois', desc: 'Accès complet aux demandes des enseignants' },
  { type: 'ANNUEL', label: 'Annuel', prix: '149 €/an', desc: 'Économisez 20 % par rapport au mensuel' },
];

export default function AbonnementPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [abo, setAbo] = useState<AbonnementStatut | null>(null);
  const [activating, setActivating] = useState<TypeAbonnement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'VENUE')) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === 'VENUE') {
      getAbonnementStatut().then(setAbo).catch(() => {});
    }
  }, [user]);

  const handleActivate = async (type: TypeAbonnement) => {
    setActivating(type);
    setError(null);
    try {
      await simulerAbonnement(type);
      const updated = await getAbonnementStatut();
      setAbo(updated);
    } catch {
      setError('Erreur lors de l\'activation de l\'abonnement.');
    } finally {
      setActivating(null);
    }
  };

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/venue" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Abonnement</h1>
        <p className="text-sm text-gray-500 mb-8">Activez votre abonnement pour accéder aux demandes des enseignants</p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {abo?.statut === 'ACTIF' ? (
          <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                Abonnement actif
              </span>
              <span className="text-sm text-gray-500">Plan {abo.type === 'MENSUEL' ? 'Mensuel' : 'Annuel'}</span>
            </div>
            <p className="text-sm text-gray-700">
              Votre abonnement est actif jusqu&apos;au{' '}
              <strong>
                {abo.actifJusquAu
                  ? new Date(abo.actifJusquAu).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '—'}
              </strong>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PLANS.map((plan) => (
              <div key={plan.type} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
                <h3 className="text-lg font-semibold text-gray-900">{plan.label}</h3>
                <p className="text-2xl font-bold text-indigo-600 mt-2">{plan.prix}</p>
                <p className="text-sm text-gray-500 mt-2 flex-1">{plan.desc}</p>
                <button
                  onClick={() => handleActivate(plan.type)}
                  disabled={activating !== null}
                  className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {activating === plan.type ? 'Activation…' : 'Activer'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
